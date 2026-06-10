Findings
Critical
Critical-1 — Các luồng nghiệp vụ lâm sàng quan trọng vẫn chưa dùng transactional audit logging
File/function/line

backend/src/modules/clinical-decision/infrastructure/adapters/blockchain-medical-conclusion-integrity.anchor.ts
BlockchainMedicalConclusionIntegrityAnchor.anchorChange(): lines 25–79
backend/src/modules/medical-order/application/use-cases/create-medical-result.use-case.ts
CreateMedicalResultUseCase.execute(): lines 19–47
backend/src/infrastructure/audit/audit-logger.service.ts
AuditLoggerService.record(params, tx?): đã hỗ trợ tx
Grep evidence:
nhiều call-site audit.record({ ... }) vẫn không truyền tx.
Phase

Phase 3
Phase 10
Bug/Risk

Finding trong bug2.md là đúng và hiện tại chỉ partially fixed.

Code đã sửa phần nền tảng:

ts
async record(params: {...}, tx?: Prisma.TransactionClient)
và có advisory transaction lock:

ts
await client.$executeRaw`
  SELECT pg_advisory_xact_lock(hashtext('blockchain_logger_chain'))
`;
Nhưng các clinical critical path vẫn chưa được nối vào transaction này.

Trong blockchain-medical-conclusion-integrity.anchor.ts, flow hiện tại vẫn là:

ts
await this.prisma.medicalConclusion.update({
  where: { id: conclusion.id },
  data: { hash256: hash, dataSalt: salt },
});
sau đó mới:

ts
await this.audit.record({
  entity: 'MedicalConclusion',
  ...
});
Không truyền tx.

Trong CreateMedicalResultUseCase.execute():

ts
return this.repo.createResultWithTransitions(
  {
    orderId,
    performedById: user.sub,
    note: dto.note?.trim() || undefined,
    files: dto.files.map(...)
  },
  order.visitId,
);
Không thấy audit record trong đoạn code đã review.

Why dangerous

Ảnh hưởng trực tiếp tới:

MedicalConclusion: kết luận y khoa có thể được ghi thành công nhưng audit log thất bại.
MedicalResult: kết quả xét nghiệm/chẩn đoán hình ảnh có thể tồn tại mà không có audit trail.
Visit: trạng thái visit có thể chuyển tiếp mà thiếu bằng chứng toàn vẹn.
Patient: audit liên quan hồ sơ bệnh nhân có thể không atomic với mutation.
Audit integrity: tạo khả năng domain write thành công nhưng audit fail.
Blockchain anchoring: không có BlockchainLogger thì không có leaf để anchor.
Privacy: nếu retry thủ công, có nguy cơ log sai snapshot hoặc snapshot không nhất quán.
Evidence

Code MedicalConclusion hiện vẫn tách transaction:

ts
await this.prisma.medicalConclusion.update(...);
await this.audit.record({
  entity: 'MedicalConclusion',
  entityId: conclusion.id,
  ...
});
Không có:

ts
await this.prisma.$transaction(async (tx) => {
  ...
  await this.audit.record(..., tx);
});
Reproduce / Missing test

Thiếu test:

ts
it('rolls back MedicalConclusion hash update when audit.record fails')
Cách tái hiện:

Mock audit.record() throw.
Gọi anchorChange().
Kiểm tra MedicalConclusion.hash256/dataSalt vẫn có thể đã được update.
Request không fail.
Fix proposed

Bắt buộc đưa clinical mutation + audit vào cùng transaction:

ts
await this.prisma.$transaction(async (tx) => {
  const snapshot = buildMedicalConclusionSnapshot(conclusion);
  if (!snapshot) {
    throw new Error('Cannot build MedicalConclusion audit snapshot');
  }
  const { salt, hash } = this.audit.hashSnapshot(snapshot);
  await tx.medicalConclusion.update({
    where: { id: conclusion.id },
    data: { hash256: hash, dataSalt: salt },
  });
  await this.audit.record(
    {
      entity: 'MedicalConclusion',
      entityId: conclusion.id,
      action,
      actorId,
      dataHash: hash,
      dataSalt: salt,
      before: before ?? null,
      after: snapshot,
      onChainStatus: 'PENDING',
    },
    tx,
  );
});
await this.auditAnchor.anchorNow();
Áp dụng tương tự cho:

Patient
Visit
MedicalResult
MedicalConclusion
Department
Staff
Doctor
Status

Partially fixed
API đã có tx.
Critical workflows chưa dùng.
Critical-2 — Lỗi audit bị cố ý bỏ qua trong MedicalConclusion anchoring
File/function/line

backend/src/modules/clinical-decision/infrastructure/adapters/blockchain-medical-conclusion-integrity.anchor.ts
anchorChange(): lines 38–69
Phase

Phase 3
Phase 10
Bug/Risk

Finding trong bug2.md là đúng và chưa fix đầy đủ.

Code hiện tại:

ts
try {
  const { salt, hash } = this.audit.hashSnapshot(snapshot);
  ...
  await this.prisma.medicalConclusion.update(...);
} catch (err) {
  console.error('Error calculating and saving medical conclusion hash:', err);
  onChainStatus = 'UNANCHORED';
}
Sau đó:

ts
try {
  await this.audit.record(...);
} catch (err) {
  console.error('Error writing audit trail for medical conclusion:', err);
}
Không throw.

Why dangerous

MedicalConclusion: chẩn đoán cuối cùng có thể được xem là hoàn tất nhưng audit trail không tồn tại.
Visit: nếu Visit chuyển COMPLETED, hồ sơ hoàn tất thiếu bằng chứng bất biến.
Audit integrity: fail-open trên clinical critical path.
Blockchain anchoring: không có log thì không anchor được.
Healthcare compliance: không đạt yêu cầu pháp lý về truy vết thay đổi lâm sàng.
Evidence

Có catch và chỉ console.error, không rollback, không throw.

Reproduce / Missing test

Mock:

ts
jest.spyOn(audit, 'record').mockRejectedValue(new Error('DB down'));
Expected:

request fails
no clinical hash update persisted
Current likely behavior:

method resolves
error only printed
Fix proposed

Fail closed:

ts
catch (err) {
  throw new InternalServerErrorException(
    'Không thể ghi audit trail cho kết luận y khoa.',
  );
}
Tốt hơn: bỏ try/catch riêng lẻ, để transaction throw tự nhiên.

Status

Not fixed
Critical-3 — Chưa có integration test end-to-end cho MedicalConclusion audit integrity
File/function/line

Không thấy test tương ứng trong các file đã review.
Existing tests chủ yếu:
audit-hash.util.spec.ts
merkle.util.spec.ts
audit-sanitizer.util.spec.ts
blockchain-action-hash.util.spec.ts
blockchain/test/audit.test.js
Phase

Phase 10
Bug/Risk

Finding trong bug2.md là đúng.

Hiện có unit tests cho utility, nhưng chưa có bằng chứng test end-to-end:

text
MedicalConclusion
 -> BlockchainLogger
 -> AuditBatch
 -> on-chain root
 -> inclusion proof
Why dangerous

Unit tests không đảm bảo wiring production đúng.
Với bệnh viện, audit integrity chỉ có giá trị khi clinical workflow thật sự sinh log, sanitize payload, anchor root, verify proof.
Evidence

Đã thấy utility tests pass, nhưng không thấy integration test tạo clinical conclusion và anchor.

Reproduce / Missing test

Thiếu test:

ts
it('finalizes MedicalConclusion, creates audit log, anchors batch, verifies inclusion proof, and leaks no PII')
Fix proposed

Thêm integration test:

Tạo Patient.
Tạo Visit.
Tạo MedicalOrder.
Tạo MedicalResult.
Tạo/finalize MedicalConclusion.
Assert BlockchainLogger.entity = MedicalConclusion.
Assert dataHash, entryHash, seq tồn tại.
Assert beforeJson/afterJson/metadata không chứa:
diagnosis text
treatment plan
prescription
Cloudinary URL
file name
patient phone/citizenId
Mock hoặc chạy blockchain anchor.
Assert AuditBatch.status = ANCHORED.
Assert inclusion proof verified.
Status

Not fixed
High
High-1 — AuditAnchor.sol v2 có rủi ro không tương thích ngược khi deploy
File/function/line

blockchain/contracts/AuditAnchor.sol
commitRoot(): khoảng lines 52–68
Phase

Phase 7
Phase 8
Deployment/migration gap
Bug/Risk

Finding trong bug2.md là đúng.

Contract mới có:

solidity
require(batchId == latestBatchId + 1, "AuditAnchor: non-sequential batch");
Đây là security improvement, nhưng có deployment risk.

Nếu DB đã có batch cũ, còn contract mới deploy lại với latestBatchId = 0, backend có thể tính:

ts
batchId = max(localMax, onChainLatest) + 1
Nếu localMax = 5, onChainLatest = 0, backend commit 6, contract reject vì expected 1.

Why dangerous

Blockchain anchoring: batch mới không anchor được.
Audit integrity: logs pending tích tụ.
Clinical compliance: critical medical events không được anchored trong SLA.
Evidence

Backend:

ts
const localMax = await this.prisma.auditBatch.aggregate({ _max: { batchId: true } });
const onChainLatest = (await this.blockchain.getLatestAuditBatchId()) ?? 0;
const batchId = Math.max(localMax._max.batchId ?? 0, onChainLatest) + 1;
Contract:

solidity
require(batchId == latestBatchId + 1, "AuditAnchor: non-sequential batch");
Reproduce / Missing test

Seed DB AuditBatch.batchId = 5.
Deploy fresh contract.
Run anchor.
Contract rejects batch 6.
Fix proposed

Cần deployment plan:

Option A: deploy v2 contract preserving sequence.
Option B: introduce bootstrap method for initial batch ID, owner-only, callable once.
Option C: backend config AUDIT_ANCHOR_SEQUENCE_SOURCE=chain|db.
Add startup sanity check:
ts
if (localMax > 0 && onChainLatest === 0) {
  throw new Error('AuditAnchor v2 sequence mismatch. Run migration/bootstrap.');
}
Status

Partially fixed
Security policy implemented.
Migration safety not solved.
High-2 — algorithmVersion có nhưng default vẫn là v1, trong khi contract verifier chỉ support v2
File/function/line

backend/src/infrastructure/audit/audit-anchor.service.ts
field merkleAlgorithm
backend/prisma/schema.prisma
AuditBatch.algorithmVersion
blockchain/contracts/AuditAnchor.sol
verifyProof()
Phase

Phase 6
Phase 7
Phase 8
Bug/Risk

Finding trong bug2.md là đúng.

Backend default:

ts
private readonly merkleAlgorithm =
  process.env.AUDIT_MERKLE_ALGORITHM ?? MERKLE_SHA256_STRING_V1;
DB default:

prisma
algorithmVersion String @default("MERKLE_SHA256_STRING_V1")
Contract verifier:

solidity
function verifyProof(uint256 batchId, bytes32 entryHash, bytes32[] calldata proof)
chỉ match v2 bytes32 algorithm.

Why dangerous

Backend có thể tạo v1 batch mới.
Solidity verifyProof() không verify được v1 proof.
Auditor/public portal có thể thấy proof fail dù backend nói verified.
Evidence

Backend vẫn fallback v1; Solidity chỉ có v2 byte semantics.

Reproduce / Missing test

Không set AUDIT_MERKLE_ALGORITHM.

Anchor batch.
Batch lưu MERKLE_SHA256_STRING_V1.
Call verifyProof() contract.
Fail.
Fix proposed

Nếu deploy AuditAnchor.sol có verifier v2, bắt buộc env:
bash
AUDIT_MERKLE_ALGORITHM=MERKLE_SHA256_BYTES32_V2
Fail-fast on bootstrap:
ts
if (contractVersion === 'AUDIT_ANCHOR_V2'
    && this.merkleAlgorithm !== MERKLE_SHA256_BYTES32_V2) {
  throw new Error('AuditAnchor v2 requires MERKLE_SHA256_BYTES32_V2');
}
Add contractVersion populated in AuditBatch.
Status

Partially fixed
High-3 — Privacy sanitizer chưa phải allowlist toàn cục cho mọi entity
File/function/line

backend/src/infrastructure/audit/audit-sanitizer.util.ts
whole file
Phase

Phase 2
Phase 10
Bug/Risk

Finding trong bug2.md là đúng.

Clinical entities có allowlist:

ts
if (CLINICAL_ENTITIES.has(entity) && !SAFE_KEYS.has(key)) {
  acc[key] = '[REDACTED]';
}
Nhưng non-clinical entities dùng denylist:

ts
if (SENSITIVE_KEYS.has(key) || shouldRedactByName(key)) {
  acc[key] = '[REDACTED]';
}
Có thể lọt:

email
username
dob
gender
identityNumber
secureUrl
cloudinaryPublicId
downloadUrl
Why dangerous

Patient/Staff/Doctor privacy: email, username, dob là dữ liệu cá nhân.
MedicalResult privacy: URL hoặc file metadata có thể lộ nếu key không match denylist.
Audit integrity: audit table là lâu dài, backup/export/admin UI dễ lộ dữ liệu.
Evidence

shouldRedactByName() không chứa email, username, dob, gender, identity.

Reproduce / Missing test

ts
sanitizeAuditPayload('StaffProfile', {
  email: 'doctor@hospital.vn',
  username: 'doctor01',
  dob: '1990-01-01',
});
Có khả năng giữ nguyên.

Fix proposed

Đổi sang allowlist cho mọi entity:

ts
const GLOBAL_SAFE_KEYS = new Set([
  'id',
  'entity',
  'entityId',
  'actorId',
  'action',
  'status',
  'role',
  'type',
  'departmentId',
  'staffProfileId',
  'doctorProfileId',
  'patientId',
  'visitId',
  'orderId',
  'resultId',
  'medicalConclusionId',
  'dataHash',
  'hash256',
  'fieldsChanged',
  'createdAt',
  'updatedAt',
]);
Default rule:

ts
if (!GLOBAL_SAFE_KEYS.has(key)) {
  acc[key] = '[REDACTED]';
}
Status

Partially fixed
High-4 — Recovery chưa verify leafCount, seq continuity, recomputed root từ logs
File/function/line

backend/src/infrastructure/audit/audit-anchor.service.ts
recoverPendingBatches()
Phase

Phase 4
Bug/Risk

Finding trong bug2.md là đúng.

Recovery hiện kiểm tra:

ts
checkpoint?.committed && onChainRoot === localRootBytes32
rồi update logs theo range:

ts
seq: { gte: batch.fromSeq ?? undefined, lte: batch.toSeq ?? undefined },
batchId: null,
Chưa thấy kiểm tra:

logs count equals leafCount
seq range contiguous
recompute root từ selected logs
exact intended membership
Why dangerous

Audit integrity: có thể attach sai logs vào batch.
Blockchain anchoring: DB membership có thể không match root thật.
MedicalConclusion/MedicalResult/Visit: proof có thể sai hoặc không reconstruct được.
Evidence

select trong recovery không lấy leafCount.

Reproduce / Missing test

Tạo pending batch fromSeq=10, toSeq=12, leafCount=3.
Xóa/missing seq 11 hoặc seq 12 đã batch khác.
Recovery vẫn có thể mark anchored partial.
Fix proposed

Trong recovery transaction:

ts
const logs = await tx.blockchainLogger.findMany({
  where: { seq: { gte: batch.fromSeq, lte: batch.toSeq } },
  orderBy: { seq: 'asc' },
});
if (logs.length !== batch.leafCount) throw ...
assertContiguous(logs, batch.fromSeq, batch.toSeq);
const recomputed = computeMerkleRootForAlgorithm(
  logs.map(l => l.entryHash!),
  batch.algorithmVersion,
);
if (recomputed !== batch.merkleRoot) throw ...
Status

Partially fixed
High-5 — BlockchainLogger.batchId vẫn có thể thay đổi nhiều lần
File/function/line

backend/prisma/migrations/20260531180000_audit_hash_chain_and_batch/migration.sql
append-only trigger function
backend/prisma/schema.prisma
BlockchainLogger.batchId
Phase

Phase 4
Phase 5
Bug/Risk

Finding trong bug2.md là đúng.

Trigger cho phép update metadata anchoring, bao gồm:

onChainStatus
txHash
blockNumber
batchId
Nó không cấm đổi batchId sau khi đã set.

Why dangerous

Audit integrity: batch membership có thể bị sửa sau anchoring.
Blockchain anchoring: proof membership mất tin cậy.
Compliance: chain-of-custody bị phá.
Evidence

Trigger chỉ reject nếu content columns thay đổi. batchId không nằm trong danh sách immutable check.

Reproduce / Missing test

sql
UPDATE "BlockchainLogger"
SET "batchId" = 999
WHERE "seq" = 10;
Nếu chỉ đổi batchId, trigger hiện tại có thể cho qua.

Fix proposed

Sửa trigger:

sql
IF OLD."batchId" IS NOT NULL
   AND NEW."batchId" IS DISTINCT FROM OLD."batchId" THEN
  RAISE EXCEPTION 'BlockchainLogger batchId is immutable once set';
END IF;
IF OLD."txHash" IS NOT NULL
   AND NEW."txHash" IS DISTINCT FROM OLD."txHash" THEN
  RAISE EXCEPTION 'BlockchainLogger txHash is immutable once set';
END IF;
Status

Not fixed
High-6 — Canonicalizer chưa reject Prisma Decimal / class instance / Buffer rõ ràng
File/function/line

backend/src/infrastructure/audit/audit-hash.util.ts
toCanonicalJson()
Phase

Phase 1
Bug/Risk

Finding trong bug2.md là đúng.

Canonicalizer reject tốt:

undefined
BigInt
NaN/Infinity
Map
Set
cyclic
invalid Date
Nhưng mọi object không phải Date/Map/Set/Array đều được xử lý bằng:

ts
const objectValue = value as Record<string, unknown>;
Object.keys(objectValue).sort()
Nghĩa là class instance, Decimal, Buffer có thể bị serialize theo enumerable keys hoặc {}.

Why dangerous

MedicalResult/Visit snapshot có thể hash sai nếu chứa Decimal/custom object.
Audit integrity: semantic data bị mất nhưng hash vẫn sinh.
Regression risk: Prisma query shape thay đổi làm hash đổi.
Evidence

Không thấy check:

ts
Object.getPrototypeOf(value) === Object.prototype
Reproduce / Missing test

ts
canonicalize(Buffer.from('abc'));
canonicalize(new Prisma.Decimal('1.23'));
canonicalize(new SomeDtoClass());
Fix proposed

Chỉ nhận plain object:

ts
const proto = Object.getPrototypeOf(value);
if (proto !== Object.prototype && proto !== null) {
  throw new Error(`Unsupported non-plain object at ${path}`);
}
Nếu cần Decimal:

ts
if (isPrismaDecimal(value)) return value.toString();
nhưng phải có test cố định.

Status

Partially fixed
High-7 — Relation arrays ổn định chỉ khi caller tự sort
File/function/line

backend/src/infrastructure/audit/audit-hash.util.ts
array handling
Snapshot builders cần được review thêm, ví dụ:
buildMedicalConclusionSnapshot()
Phase

Phase 1
Phase 10
Bug/Risk

Finding trong bug2.md là đúng về nguyên tắc.

Canonicalizer giữ nguyên thứ tự mảng:

ts
value.map((item, index) => toCanonicalJson(item, `${path}[${index}]`, seen))
Nếu relation từ Prisma không có orderBy, hash có thể không ổn định.

Why dangerous

Visit tree: orders/results/files có thể đổi thứ tự.
MedicalResult: files nếu không sort có thể làm hash đổi.
Audit integrity: false tampering hoặc false mismatch.
Evidence

Canonicalizer không sort arrays, đúng theo thiết kế. Nhưng chưa thấy bằng chứng tất cả snapshot builders sort relation arrays.

Reproduce / Missing test

Tạo snapshot với orders shuffled:

ts
expect(hash(snapshotA)).toBe(hash(snapshotB));
nếu khác thứ tự nhưng cùng dữ liệu, test sẽ fail.

Fix proposed

Không sort trong canonicalizer chung. Sort ở snapshot builder:

ts
orders.sort(byCreatedAtThenId)
results.sort(byCreatedAtThenId)
files.sort(byCreatedAtThenIdOrId)
Thêm schema-specific snapshot tests.

Status

Partially fixed / needs verification in snapshot builders
Medium
Medium-1 — Thiếu fixed test vector cho Merkle v1
File/function/line

backend/src/infrastructure/audit/merkle.util.spec.ts
Phase

Phase 0
Bug/Risk

Finding đúng.

Tests hiện cover behavior nhưng không có hard-coded expected root/proof.

Why dangerous

Nếu refactor đồng thời computeMerkleRoot() và verifyMerkleProof(), self-consistency tests vẫn có thể pass nhưng v1 historical roots bị phá.

Evidence

Test kiểu:

ts
expect(computeMerkleRoot(leaves)).toBe(computeMerkleRoot([...leaves]));
không khóa thuật toán bằng known vector.

Reproduce / Missing test

Đổi domain prefix leaf: thành leaf-v1: trong cả compute và verify, nhiều test vẫn pass.

Fix proposed

Thêm:

ts
expect(computeMerkleRoot([A])).toBe('<known-root>');
expect(computeMerkleRoot([A, B, C])).toBe('<known-root>');
expect(buildMerkleProof([A, B, C], 2)).toEqual(['<known-sibling>', ...]);
Status

Not fixed
Medium-2 — Thiếu shared fixture Backend ↔ Solidity cho v2 parity
File/function/line

backend/src/infrastructure/audit/merkle.util.spec.ts
blockchain/test/audit.test.js
Phase

Phase 7
Phase 8
Bug/Risk

Finding đúng.

Backend test và Hardhat test tự implement hash v2 riêng. Chưa thấy fixture chung.

Why dangerous

Backend và Solidity có thể drift domain separator hoặc byte semantics.

Evidence

Hardhat test tự có:

js
function hashLeafV2(entryHash) {
  return ethers.sha256(ethers.concat([
    ethers.toUtf8Bytes('KLTN_AUDIT_LEAF_V2'),
    ethers.getBytes(entryHash)
  ]));
}
Backend test dùng implementation TS riêng.

Fix proposed

Tạo test-vectors/audit-merkle-v2.json, import ở cả backend Jest và Hardhat.

Status

Not fixed
Medium-3 — Solidity domain separator dùng dynamic string với abi.encodePacked
File/function/line

blockchain/contracts/AuditAnchor.sol
hashLeaf()
hashPair()
Phase

Phase 7
Bug/Risk

Finding đúng nhưng severity Medium/Low.

Hiện tại dùng fixed string + bytes32, ít rủi ro collision, nhưng future-proof chưa tốt.

Why dangerous

Nếu sau này thêm dynamic field vào abi.encodePacked, có thể sinh ambiguity.

Fix proposed

solidity
bytes32 private constant LEAF_DOMAIN =
    sha256("KLTN_AUDIT_LEAF_V2");
return sha256(abi.encodePacked(LEAF_DOMAIN, entryHash));
hoặc:

solidity
sha256(abi.encode(LEAF_DOMAIN, entryHash));
Status

Not fixed / acceptable with concern
Medium-4 — Event RootCommitted thiếu algorithmVersion, fromSeq, toSeq
File/function/line

blockchain/contracts/AuditAnchor.sol
event RootCommitted(...)
Phase

Phase 6
Phase 7
Bug/Risk

Finding đúng.

Event hiện chỉ có:

solidity
event RootCommitted(
  uint256 indexed batchId,
  bytes32 root,
  uint256 leafCount,
  uint256 timestamp
);
Why dangerous

Nếu DB bị tranh chấp hoặc mất, chain event không cho biết root cover seq nào, algorithm nào.

Fix proposed

V2 event:

solidity
event RootCommitted(
  uint256 indexed batchId,
  bytes32 indexed root,
  uint256 leafCount,
  uint256 fromSeq,
  uint256 toSeq,
  bytes32 algorithm,
  uint256 timestamp
);
Không chứa PII.

Status

Not fixed
Medium-5 — Verification report chưa tách rõ DB proof / chain verification / Solidity verification
File/function/line

backend/src/infrastructure/audit/audit-anchor.service.ts
getInclusionProof()
Phase

Phase 5
Bug/Risk

Finding đúng.

Return hiện có một boolean:

ts
verified
Không tách:

DB proof verified
recomputed root equals DB root
on-chain root equals recomputed root
contract verifier result
Why dangerous

Auditor cần biết fail ở đâu.

Fix proposed

Return:

ts
{
  algorithmVersion,
  dbProofVerified,
  dbRootMatchesRecomputed,
  chainRootMatches,
  contractProofVerified,
  verified,
  reason
}
Status

Partially fixed
Có verification nhưng report chưa audit-grade.
Medium-6 — Hardhat tests đã viết nhưng chưa chạy được trong workspace
File/function/line

blockchain/test/audit.test.js
blockchain/package.json/dependencies
Phase

Phase 7
Phase 10
Bug/Risk

Finding đúng.

Đã thử chạy npm test trong blockchain; npx hardhat test yêu cầu cài Hardhat. Test chưa được validate thực tế.

Why dangerous

Smart contract verifier là security-critical. Test chưa chạy thì không thể production sign-off.

Fix proposed

Pin dependencies.
Install through approved process.
Commit lockfile.
Run:
bash
npm test
Status

Not fixed
Medium-7 — recordActionAsSuperAdmin() canonical rồi nhưng chưa enforce schema/privacy input
File/function/line

backend/src/infrastructure/blockchain/blockchain.service.ts
recordActionAsSuperAdmin()
backend/src/infrastructure/blockchain/blockchain-action-hash.util.ts
Phase

Phase 1
Phase 10
Bug/Risk

Finding đúng một phần.

Đã fix canonical hashing:

ts
computeBackendActionHash(actionPayload)
và domain separation:

ts
KLTN_ACTION_V1:${canonicalPayload}
Nhưng chưa enforce action payload schema, chưa cấm raw Prisma include object.

Why dangerous

Hash only on-chain nên privacy on-chain vẫn ổn.
Nhưng verification semantics yếu nếu caller hash raw clinical object hoặc unordered relation.
Fix proposed

Require typed DTO:

ts
{
  schema: 'KLTN_ACTION_V1',
  entity,
  entityId,
  action,
  actorId,
  dataHash,
  createdAtIso
}
Reject if missing schema.

Status

Partially fixed
Low
Low-1 — AUDIT_PEPPER có thể trống
File/function/line

backend/src/infrastructure/audit/audit-hash.util.ts
getPepper()
Phase

Phase 1
Phase 10
Bug/Risk

Finding đúng.

ts
return process.env.AUDIT_PEPPER || '';
Why dangerous

DB-only attacker dễ brute/forge hơn nếu không có pepper.

Fix proposed

Fail-fast production:

ts
if (process.env.NODE_ENV === 'production' && !process.env.AUDIT_PEPPER) {
  throw new Error('AUDIT_PEPPER is required in production');
}
Status

Not fixed
Low-2 — Merkle v1 empty root trả zero hash
File/function/line

backend/src/infrastructure/audit/merkle.util.ts
computeMerkleRoot()
Phase

Phase 0
Bug/Risk

Finding đúng nhưng accepted for compatibility.

v1 giữ:

ts
if (entryHashes.length === 0) return ZERO;
v2 đã throw.

Why dangerous

Zero root có thể bị dùng nhầm bởi tooling.

Fix proposed

Giữ v1 để backward compatibility, nhưng đảm bảo call-site không commit empty batch. Hiện contract reject zero root.

Status

Fixed enough / accepted risk
Low-3 — Solidity dùng require strings thay vì custom errors
File/function/line

blockchain/contracts/AuditAnchor.sol
Phase

Phase 7
Bug/Risk

Finding đúng nhưng không phải security blocker.

Fix proposed

Future optimization:

solidity
error EmptyRoot();
error EmptyBatch();
error NonSequentialBatch(uint256 expected, uint256 actual);
Status

Not fixed / non-blocking
New findings ngoài bug2.md
New-High-1 — AuditBatch thiếu constraint chống overlap sequence range
File/function/line

backend/prisma/schema.prisma
AuditBatch.fromSeq
AuditBatch.toSeq
Bug/Risk

Không có DB constraint để ngăn hai ANCHORED batch overlap fromSeq/toSeq.

Why dangerous

Một log có thể được diễn giải thuộc nhiều batch, gây tranh chấp bằng chứng.

Fix proposed

PostgreSQL exclusion constraint hoặc trigger:

sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "AuditBatch"
ADD CONSTRAINT audit_batch_no_overlap
EXCLUDE USING gist (
  int4range("fromSeq", "toSeq", '[]') WITH &&
)
WHERE ("status" = 'ANCHORED');
Nếu Prisma không support trực tiếp, dùng raw migration SQL.

New-High-2 — AuditBatch row itself not append-only/immutable
File/function/line

backend/prisma/schema.prisma
AuditBatch
migrations: không thấy trigger immutable cho AuditBatch
Bug/Risk

AuditBatch.merkleRoot, fromSeq, toSeq, algorithmVersion có thể bị update sau khi anchored nếu app/admin có DB write.

Why dangerous

Anchor proof phụ thuộc vào AuditBatch. Nếu DB batch metadata bị sửa, report có thể gây nhầm lẫn dù on-chain root còn đúng.

Fix proposed

Add trigger:

forbid delete
forbid changing batchId, merkleRoot, leafCount, fromSeq, toSeq, algorithmVersion after create
allow only status, txHash, blockNumber, anchoredAt, recoveredAt, error transitions with rules
New-Medium-1 — contractVersion added but never populated
File/function/line

schema.prisma
AuditBatch.contractVersion
audit-anchor.service.ts
create batch data
Bug/Risk

Field exists but create uses only:

ts
algorithmVersion: this.merkleAlgorithm
No contractVersion.

Why dangerous

Cannot audit which contract semantics anchored a batch.

Fix proposed

Populate:

ts
contractVersion: process.env.AUDIT_ANCHOR_CONTRACT_VERSION ?? 'AUDIT_ANCHOR_V1'
New-Medium-2 — onChainStatus values inconsistent
File/function/line

schema.prisma
comment: PENDING | ANCHORED | UNANCHORED
code uses:
FAILED
PENDING
ANCHORED
UNANCHORED
Bug/Risk

No enum enforcement. Inconsistent statuses harm audit reports.

Fix proposed

Use Prisma enum:

prisma
enum OnChainStatus {
  PENDING
  ANCHORED
  FAILED
  UNANCHORED
}
or DB check constraint.

Fixed correctly
Có bằng chứng trong code cho các mục sau:

Solidity proof verification
AuditAnchor.sol có verifyProof().
Merkle v2 bytes32
merkle.util.ts có v2 leaf/pair/root/proof.
v1 backward compatibility
v1 functions vẫn còn.
Strict canonical JSON
reject undefined, BigInt, NaN/Infinity, Map, Set, cyclic, invalid Date.
Audit payload sanitizer
audit-logger.service.ts dùng sanitizeAuditPayload() cho beforeJson, afterJson, metadata.
DB advisory lock
AuditLoggerService.appendRecord() dùng pg_advisory_xact_lock.
Receipt status check
commitAuditRoot() check receipt.status.
Pending batch recovery
có recoverPendingBatches().
Full-chain verification
có verifyFullChainBeforeAnchor().
Anchored batch verification
có verifyAllAnchoredBatchesAgainstChain().
Sequential batch policy
contract check batchId == latestBatchId + 1.
Canonical action hash
computeBackendActionHash().
Partially fixed
Transaction-safe audit logging:
API có tx, nhưng clinical call-sites chưa dùng.
Privacy sanitizer:
clinical allowlist tốt hơn, nhưng global allowlist chưa có.
Algorithm migration:
algorithmVersion có, nhưng default/env/contract compatibility chưa fail-fast.
Recovery:
có logic, nhưng chưa verify exact log membership.
Verification report:
có boolean, chưa đủ audit-grade.
Solidity tests:
có file test, chưa chạy được.
Not fixed
Clinical workflows atomic audit.
Fail-closed MedicalConclusion audit.
MedicalResult audit evidence.
Phase 10 end-to-end integration tests.
Hardhat tests runnable/pinned.
Immutable batchId after set.
Immutable AuditBatch.
Fixed v1 test vectors.
Shared backend/Solidity v2 fixtures.
Startup fail nếu thiếu AUDIT_PEPPER.
Deployment/rollback documentation.
Phase 9 undefined/open.
Missing integration tests
MedicalConclusion finalize → audit log → anchor → proof verify.
MedicalResult creation with files → audit log exists and sanitized.
Visit status transition critical path → audit row in same transaction.
Patient mutation rollback with audit failure.
Department/Staff/Doctor mutation rollback with audit failure.
AuditBatch recovery after simulated crash.
Missing E2E tests
Doctor finalizes diagnosis from UI/API and audit proof is available.
Lab manager uploads result and no URL leaks in audit.
Admin audit portal verifies:
DB proof
chain root
contract proof
Blockchain unavailable scenario:
clinical write behavior must be explicit and safe.
Missing migration tests
Existing v1 AuditBatch rows retain algorithmVersion = MERKLE_SHA256_STRING_V1.
New v2 batches created only when env switch enabled.
Fresh v2 contract + existing DB mismatch detection.
Trigger migration for immutable batchId.
Non-overlap sequence constraint.
Missing rollback tests
Failed audit.record(..., tx) rolls back domain write.
Failed domain write rolls back audit row.
Failed commitAuditRoot() marks batch failed and logs retryable.
Crash after on-chain commit before DB update recovers exact batch.
Rollback from contract v2 deployment documented/tested.
Missing privacy tests
Serialized BlockchainLogger.beforeJson/afterJson/metadata scanner.
On-chain event scanner.
MedicalResult file URL/name scanner.
Patient PII scanner:
fullName
phone
citizenId
address
insuranceNumber
Clinical text scanner:
diagnosis
treatmentPlan
prescription
note
Staff/user PII scanner:
email
username
dob
Production Readiness Assessment
Security: 6.5/10
Nhiều nền tảng tốt đã có: canonicalizer, advisory lock, append-only trigger, Merkle v2, receipt checks. Nhưng critical clinical flows chưa fail-closed và chưa transactional.

Privacy: 6/10
Clinical sanitizer có cải thiện, nhưng chưa allowlist toàn cục và thiếu privacy scanner test. Vẫn có risk leak non-clinical PII.

Audit Integrity: 6/10
Hash-chain, Merkle batch, anchored verification đã có. Nhưng batch membership immutability, exact recovery verification, and clinical transaction coupling chưa đủ.

Blockchain Integrity: 6.5/10
Contract verifier v2 tốt hơn nhiều. Nhưng deployment compatibility, algorithm default mismatch, event metadata, and unexecuted Hardhat tests là rủi ro lớn.

Clinical Compliance: 5/10
MedicalConclusion/MedicalResult/Visit critical path chưa được chứng minh atomic + audited + tested. Đây là blocker lớn nhất.

Final Verdict
BLOCK
Lý do:

MedicalConclusion audit failure vẫn fail-open.
Critical workflows chưa dùng audit.record(..., tx) có bằng chứng.
MedicalResult chưa thấy audit log trong path reviewed.
Phase 10 integration/privacy/e2e tests chưa có.
Hardhat verifier tests chưa chạy được.
Migration/deployment risk của contract v2 + Merkle v2 chưa có plan/rollback.
BlockchainLogger.batchId và AuditBatch metadata chưa đủ immutable.
Với tiêu chuẩn bệnh viện và audit pháp lý, chưa đủ điều kiện production.