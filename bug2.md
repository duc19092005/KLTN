Phát hiện
Mức độ Nghiêm trọng (Critical)
Critical-1 — Các luồng nghiệp vụ lâm sàng quan trọng vẫn chưa sử dụng ghi log kiểm toán theo giao dịch (transactional audit logging)

Tệp/hàm/dòng:

blockchain-medical-conclusion-integrity.anchor.ts:L25-L79
create-medical-result.use-case.ts:L33-L47
Các vị trí gọi audit.record() tìm được từ grep vẫn gọi mà không truyền tx.

Giai đoạn: Phase 3, Phase 10

Lỗi/Rủi ro

AuditLoggerService.record(params, tx?) hiện đã hỗ trợ Prisma.TransactionClient, nhưng các adapter/use-case quan trọng hiện tại chưa được nối để sử dụng.

BlockchainMedicalConclusionIntegrityAnchor.anchorChange():

cập nhật MedicalConclusion.hash256/dataSalt riêng biệt,
sau đó ghi BlockchainLogger riêng biệt,
bắt lỗi rồi bỏ qua.

CreateMedicalResultUseCase.execute():

tạo kết quả,
tạo file,
tạo transition,

nhưng không thấy bản ghi audit trong luồng đã xem xét.

Tại sao nguy hiểm trong môi trường bệnh viện

MedicalConclusion và MedicalResult là bằng chứng pháp lý/lâm sàng.

Một kết luận y khoa có thể được hoàn tất trong khi ghi audit thất bại âm thầm, dẫn tới hồ sơ lâm sàng không có bằng chứng chống giả mạo đáng tin cậy.

Ngược lại, log audit có thể được tạo cho các thay đổi mà sau đó bị rollback nếu các transaction khác thất bại.

Cách tái hiện / Thiếu kiểm thử

Buộc audit.record() ném exception sau khi medicalConclusion.update() thành công.

Hành vi an toàn mong đợi:

Toàn bộ thay đổi rollback.
Hoặc request thất bại.

Hiện tại:

Lỗi chỉ được ghi ra console.
Hash lâm sàng vẫn có thể được cập nhật.
Đề xuất sửa

Đưa:

thay đổi dữ liệu lâm sàng,
cập nhật hash,
audit.record(..., tx)

vào cùng một transaction:

await this.prisma.$transaction(async (tx) => {
  const snapshot = buildMedicalConclusionSnapshot(conclusion);
  const { salt, hash } = this.audit.hashSnapshot(snapshot);

  await tx.medicalConclusion.update({
    where: { id: conclusion.id },
    data: { hash256: hash, dataSalt: salt },
  });

  await this.audit.record({
    entity: 'MedicalConclusion',
    entityId: conclusion.id,
    action,
    actorId,
    dataHash: hash,
    dataSalt: salt,
    before,
    after: snapshot,
    onChainStatus: 'PENDING',
  }, tx);
});

await this.auditAnchor.anchorNow();

Không được bỏ qua lỗi audit trên các luồng quan trọng.

anchorNow() chỉ được gọi sau khi transaction commit thành công.

Critical-2 — Lỗi audit bị cố ý bỏ qua trong quá trình neo (anchoring) kết luận y khoa

Tệp/hàm/dòng:

blockchain-medical-conclusion-integrity.anchor.ts:L38-L69

Giai đoạn: Phase 3, Phase 10

Lỗi/Rủi ro
Nếu cập nhật hash thất bại → đặt onChainStatus = 'UNANCHORED' rồi tiếp tục.
Nếu ghi audit thất bại → bắt lỗi và chỉ console.error().

Người gọi vẫn nhận kết quả thành công mặc dù tính toàn vẹn audit lâm sàng đã thất bại.

Tại sao nguy hiểm

Một chẩn đoán đã được bác sĩ hoàn tất có thể hiển thị là thành công nhưng không có audit record bất biến.

Điều này vi phạm bất biến (invariant) của dự án:

Mọi thay đổi lâm sàng quan trọng phải sinh ra BlockchainLogger.

Cách tái hiện

Mock:

this.audit.record()

ném lỗi.

Xác nhận:

anchorChange()

vẫn resolve mà không throw.

Đề xuất sửa

Đối với:

MedicalConclusion
Visit
MedicalResult

phải fail closed.

Ném:

InternalServerErrorException

hoặc domain error nếu ghi hash/audit thất bại.

Chỉ cho phép chế độ giảm cấp (UNANCHORED) đối với các thực thể vận hành không quan trọng.

Critical-3 — Chưa triển khai kiểm thử tích hợp toàn bộ tính toàn vẹn lâm sàng ở Phase 10
Không thấy kiểm thử tích hợp

Bao phủ toàn bộ luồng:

MedicalConclusion
    ->
BlockchainLogger
    ->
AuditBatch
    ->
On-chain Root
    ->
Inclusion Proof
Lỗi/Rủi ro

Các unit test chỉ kiểm tra utility.

Không có test chứng minh rằng khi hoàn tất MedicalConclusion:

tạo BlockchainLogger,
payload được sanitize,
batch được anchor,
inclusion proof xác thực,
dữ liệu nhạy cảm không xuất hiện trong audit hoặc on-chain.
Tại sao nguy hiểm

Tính toàn vẹn audit của bệnh viện chỉ có ý nghĩa khi toàn bộ đường đi sản xuất được kiểm thử.

Đề xuất sửa

Viết integration test:

Tạo:
patient
visit
order
result
conclusion
Finalize conclusion.
Kiểm tra:
audit row tồn tại
afterJson không chứa:
diagnosis
treatment
prescription
file URL
Chạy:
anchorNow()
Kiểm tra:
AuditBatch.status === ANCHORED
Inclusion proof xác thực thành công.
Mức độ Cao (High)
High-1 — AuditAnchor.sol mới không tương thích ngược với giả định của hợp đồng v1

Tệp:

AuditAnchor.sol:L52-L68

Lỗi/Rủi ro

Contract hiện yêu cầu:

require(
    batchId == latestBatchId + 1,
    "AuditAnchor: non-sequential batch"
);

Điều này đúng với triển khai v2 sạch nhưng có thể phá vỡ môi trường:

contract cũ có batch không liên tục,
DB có batchId lớn hơn contract,
contract mới deploy lại với latestBatchId = 0.
Nguy hiểm

Anchoring trong production có thể dừng hoàn toàn.

Audit bệnh viện sẽ tích tụ ở trạng thái chưa neo.

Đề xuất

Cần kế hoạch migration rõ ràng:

bootstrap batchId,
reset binding DB,
hoặc đồng bộ trạng thái contract.

Thêm:

AUDIT_ANCHOR_CONTRACT_VERSION
High-2 — algorithmVersion tồn tại nhưng mặc định vẫn sinh batch v1

Tệp:

audit-anchor.service.ts:L30-L33
schema.prisma:L592-L594
Lỗi

Nếu không cấu hình:

AUDIT_MERKLE_ALGORITHM

thì hệ thống vẫn dùng:

MERKLE_SHA256_STRING_V1

Trong khi:

verifyProof()

trên contract chỉ hỗ trợ v2.

Nguy hiểm

Proof Solidity sẽ thất bại mặc dù backend vẫn hoạt động.

Đề xuất

Nếu dùng contract verifier v2:

AUDIT_MERKLE_ALGORITHM=MERKLE_SHA256_BYTES32_V2

Và fail-fast khi cấu hình không khớp.

High-3 — Bộ lọc riêng tư chưa phải allowlist thực sự cho mọi entity

Tệp:

audit-sanitizer.util.ts

Lỗi

Các entity lâm sàng dùng allowlist.

Nhưng các entity khác vẫn dùng denylist theo tên trường.

Ví dụ có thể rò rỉ:

email
username
dob
gender
identityNumber
cloudinaryPublicId
secureUrl
downloadUrl
medicalFile
Đề xuất

Chuyển sang allowlist cho tất cả entity.

Chỉ cho phép:

id
entityId
safe FK IDs
status
role
type
hashes
fieldsChanged
timestamps
High-4 — Cơ chế recovery không xác minh đầy đủ leafCount và tính liên tục

Tệp:

audit-anchor.service.ts:L249-L311

Lỗi

Recovery chỉ kiểm tra:

merkleRoot

khớp với on-chain.

Không kiểm tra:

số log = leafCount
seq liên tục
root tính lại có khớp không
Đề xuất

Trước khi đánh dấu recovered:

assert(logs.length === batch.leafCount);
assert(logs.map(seq) === range(fromSeq, toSeq));
assert(
  computeMerkleRootForAlgorithm(...) === batch.merkleRoot
);
High-5 — BlockchainLogger.batchId vẫn có thể thay đổi nhiều lần
Lỗi

Trigger hiện cho phép cập nhật:

batchId
txHash
blockNumber
onChainStatus

Một admin hoặc ứng dụng bị xâm nhập có thể chuyển log sang batch khác.

Đề xuất

Khi batchId đã có giá trị:

IF OLD."batchId" IS NOT NULL
AND NEW."batchId" IS DISTINCT FROM OLD."batchId"
THEN
    RAISE EXCEPTION
      'BlockchainLogger batchId is immutable once set';
END IF;
High-6 — Canonicalizer chưa xử lý rõ Prisma Decimal và class instance
Lỗi

Các kiểu như:

Prisma.Decimal
Buffer
DTO Class

có thể serialize không ổn định.

Đề xuất

Chỉ chấp nhận plain object:

const proto = Object.getPrototypeOf(value);

if (
  proto !== Object.prototype &&
  proto !== null
) {
  throw ...
}
High-7 — Mảng relation chỉ ổn định nếu caller tự sort
Lỗi

Canonicalizer giữ nguyên thứ tự mảng.

Nếu Prisma trả kết quả theo thứ tự khác nhau:

Visit -> Orders -> Results

hash sẽ thay đổi.

Đề xuất

Sort:

createdAt
id
seq

trước khi hash.

Mức độ Trung bình (Medium)
Medium-1

Thiếu bộ test vector cố định cho Merkle v1.

Medium-2

Thiếu fixture dùng chung giữa backend và Solidity để đảm bảo parity v2.

Medium-3

Nên dùng domain separator dạng bytes32 thay vì chuỗi động trong Solidity.

Medium-4

Event RootCommitted chưa chứa:

algorithmVersion
fromSeq
toSeq
Medium-5

Báo cáo xác minh chưa tách rõ:

DB proof
chain verification
Solidity verification
Medium-6

Hardhat test đã viết nhưng chưa thực sự chạy được trong workspace.

Medium-7

recordActionAsSuperAdmin() chưa có cơ chế bảo vệ quyền riêng tư payload.

Mức độ Thấp (Low)
Low-1

AUDIT_PEPPER có thể để trống mà không fail startup.

Low-2

Merkle v1 cho phép empty root dạng zero hash.

Low-3

Solidity dùng chuỗi trong require() thay vì custom errors.

Các lỗi đã được sửa đúng
Đã khắc phục

✅ Solidity proof verification

✅ Merkle v2 tương thích Solidity

✅ Sanitizer cho payload audit

✅ Canonical JSON cải tiến

✅ DB advisory lock

✅ Pending batch recovery

✅ Full chain verification

✅ Batch ID tuần tự

✅ Xử lý odd leaf

✅ Canonical hashing cho recordActionAsSuperAdmin

✅ Kiểm tra receipt.status

✅ Validation proof input

Các bài kiểm thử hồi quy còn thiếu
Fixed v1 test vectors.
Shared fixture Backend ↔ Solidity.
Hardhat test thực thi thực tế.
Integration test MedicalConclusion end-to-end.
Integration test MedicalResult.
Rollback test cho Patient/Visit/Department/Staff/Doctor.
Crash recovery simulation.
Privacy scanner test.
Test batchId bất biến.
Test fail startup khi thiếu AUDIT_PEPPER.
Rủi ro triển khai và migration
Chưa có Phase 9 rõ ràng

Không nên suy diễn phạm vi công việc.

Rủi ro deploy contract v2

Contract cũ có thể:

không hỗ trợ verifyProof()
không hỗ trợ batch tuần tự
Rủi ro chuyển thuật toán

DB mặc định vẫn là:

MERKLE_SHA256_STRING_V1

Trong khi contract verifier chỉ hỗ trợ v2.

Rủi ro migration Prisma

Chưa có:

rollback script
ràng buộc chống chồng lấn fromSeq/toSeq
Rủi ro trigger append-only

Vẫn cho phép sửa metadata anchoring nhiều lần.

Rủi ro Hardhat

Dependency chưa được cài đặt và khóa phiên bản.

Thiếu tài liệu vận hành

Cần tài liệu:

Migrate DB.
Generate Prisma Client.
Deploy & verify AuditAnchor v2.
Cấu hình ENV.
Smoke test.
Quy trình rollback.
Kết luận cuối cùng
Trạng thái: BLOCK

Mặc dù nhiều lỗi trong bug.md đã được xử lý tốt, hệ thống chưa đủ điều kiện đưa vào production cho môi trường bệnh viện vì:

Các luồng lâm sàng quan trọng vẫn chưa sử dụng audit.record(..., tx) theo transaction.
Lỗi audit của MedicalConclusion vẫn bị bỏ qua.
Chưa có kiểm thử end-to-end cho audit và quyền riêng tư dữ liệu lâm sàng.
Test Solidity/Hardhat đã viết nhưng chưa được thực thi thực tế.
Rủi ro migration khi chuyển sang contract v2 và thuật toán Merkle v2 vẫn chưa được giải quyết đầy đủ.

Đối với hệ thống bệnh viện, tính toàn vẹn kiểm toán (audit integrity) của MedicalConclusion, MedicalResult và Visit phải được đảm bảo bằng transaction trước khi có thể phê duyệt triển khai.