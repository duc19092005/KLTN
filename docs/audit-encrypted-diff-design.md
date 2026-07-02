Mục Tiêu
Hệ thống audit phải làm được 4 việc:

1. Người dùng hiểu được: ai sửa, sửa entity nào, field nào, từ gì thành gì.
2. Dữ liệu nhạy cảm không lộ ra DB plain text nếu không cần.
3. Hash-chain + Merkle + blockchain chứng minh audit log không bị sửa.
4. Có thể verify lại raw before/after khi có quyền decrypt.
Nguyên Tắc Cốt Lõi
Không hash ciphertext AES.

Raw before/after -> canonical JSON -> HMAC/SHA256 hash
Raw before/after -> AES-256-GCM -> encrypted storage
entryHash -> băm hash + metadata ổn định
Merkle root -> băm entryHash
Blockchain -> chỉ lưu root/hash/metadata batch
Nếu hash ciphertext, sau này rotate key hoặc re-encrypt thì ciphertext đổi, entryHash đổi, Merkle root hỏng.

Schema Nên Có
Bổ sung vào BlockchainLogger:

beforeHash        String?
afterHash         String?
diffHash          String?
hashVersion       String  // AUDIT_ENTRY_V2

beforeEncrypted   Json?
afterEncrypted    Json?
encryptionVersion String?
encryptionKeyId   String?

diffJson          Json?   // diff an toàn để hiển thị
fieldsChanged     Json?   // ['fullName', 'avatarUrl']
Giữ lại:

seq
prevHash
entryHash
dataHash
entity
entityId
action
actorId
batchId
txHash
blockNumber
Công Thức Hash
Dùng key riêng:

AUDIT_HASH_KEY          dùng cho HMAC hash
AUDIT_ENCRYPTION_KEY    dùng cho AES-256-GCM
Không dùng chung 1 key.

Với mỗi audit event:

beforeCanonical = canonicalize(rawBefore)
afterCanonical = canonicalize(rawAfter)

beforeHash = HMAC_SHA256(
  AUDIT_HASH_KEY,
  'KLTN_AUDIT_BEFORE_V1|' + entity + '|' + entityId + '|' + beforeCanonical
)

afterHash = HMAC_SHA256(
  AUDIT_HASH_KEY,
  'KLTN_AUDIT_AFTER_V1|' + entity + '|' + entityId + '|' + afterCanonical
)

diffHash = HMAC_SHA256(
  AUDIT_HASH_KEY,
  'KLTN_AUDIT_DIFF_V1|' + canonicalize(diffJson)
)

dataHash = HMAC_SHA256(
  AUDIT_HASH_KEY,
  canonicalize({
    schema: 'KLTN_AUDIT_DATA_V2',
    entity,
    entityId,
    action,
    beforeHash,
    afterHash,
    diffHash,
    fieldsChanged
  })
)
entryHash:

entryHash = SHA256(
  canonicalize({
    schema: 'KLTN_AUDIT_ENTRY_V2',
    seq,
    prevHash,
    entity,
    entityId,
    action,
    actorId,
    dataHash,
    beforeHash,
    afterHash,
    diffHash,
    createdAtIso
  })
)
seq dùng để nối chuỗi. prevHash là entryHash của seq trước.

AES-256-GCM Storage
Lưu encrypted object dạng:

{
  alg: 'AES-256-GCM',
  keyId: 'audit-key-2026-01',
  iv: 'base64...',
  tag: 'base64...',
  ciphertext: 'base64...'
}
Plaintext là canonical JSON của raw before/after.

AAD nên là metadata cố định:

aad = canonicalize({
  schema: 'KLTN_AUDIT_ENCRYPTION_AAD_V1',
  seq,
  entity,
  entityId,
  action,
  createdAtIso
})
Khi decrypt, AES-GCM sẽ tự phát hiện nếu ciphertext hoặc AAD bị sửa.

Diff Hiển Thị
Tạo diff trước khi encrypt:

diffJson = {
  schema: 'KLTN_AUDIT_DIFF_V1',
  fieldsChanged: ['fullName', 'avatarUrl'],
  changes: [
    {
      field: 'fullName',
      label: 'Họ tên',
      before: 'abc',
      after: 'def',
      sensitivity: 'PII'
    },
    {
      field: 'avatarUrl',
      label: 'Ảnh đại diện',
      before: '[REDACTED]',
      after: '[REDACTED]',
      sensitivity: 'FILE_URL'
    }
  ]
}
Hiển thị theo quyền:

ADMIN + face step-up: thấy fullName abc -> def.
User thường: thấy Họ tên đã thay đổi.
Clinical text: chỉ role được phép mới thấy.
File URL/avatar URL: không show URL, chỉ show “Ảnh đại diện đã thay đổi”.
Luồng Ghi Audit
Ví dụ update tên nhân viên:

1. Load before snapshot.
2. Update StaffProfile trong transaction.
3. Build after snapshot.
4. Build diff: fullName abc -> def.
5. Tính beforeHash, afterHash, diffHash, dataHash.
6. Encrypt before/after bằng AES-256-GCM.
7. Tạo BlockchainLogger với seq + prevHash + entryHash.
8. Batch job gom 500 logs hoặc 5 phút.
9. Tạo Merkle root từ entryHash.
10. Commit root lên blockchain.
Luồng Xem Audit
Audit list:

Seq #120
Nhân viên A
Action: UPDATE
Thay đổi: Họ tên từ abc thành def
Người sửa: admin01
Trạng thái: VERIFIED
Batch: 7
Tx: 0x...
Audit detail nếu đủ quyền:

Decrypt beforeEncrypted/afterEncrypted
Recompute beforeHash/afterHash
Recompute entryHash
Verify Merkle proof
Show full diff
Verify Tamper
Khi scan integrity:

1. Lấy latest anchored audit log của entity.
2. Decrypt afterEncrypted nếu cần.
3. Hash live DB snapshot hiện tại.
4. So sánh với afterHash/dataHash trong audit log.
5. Verify entryHash chain.
6. Verify Merkle proof against on-chain root.
Nếu live DB khác audit log gần nhất:

Status: TAMPERED
Field nghi ngờ: fullName/avatarUrl/...
Chốt Thiết Kế

beforeEncrypted/afterEncrypted: để xem lại dữ liệu gốc khi có quyền.
beforeHash/afterHash: để verify dữ liệu gốc không bị đổi.
diffJson: để UI biết field nào đổi.
entryHash: để nối chuỗi seq.
Merkle root: để neo batch lên blockchain.
Blockchain không lưu raw data, không lưu ciphertext, chỉ lưu root/hash. làm các task này đi
