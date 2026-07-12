# Thuật toán Hash, Mã hóa và Kiểm chứng Audit Log

Tài liệu này mô tả các thuật toán đang dùng trong hệ thống audit log, IPFS và Blockchain. Mục tiêu là giải thích rõ từng giá trị hash dùng để làm gì, được tính từ dữ liệu nào, lưu ở đâu và tham gia vào flow kiểm chứng/phục hồi như thế nào.

Nguồn code chính:

- `backend/src/infrastructure/audit/audit-hash.util.ts`
- `backend/src/infrastructure/audit/audit-encryption.util.ts`
- `backend/src/infrastructure/audit/merkle.util.ts`
- `backend/src/infrastructure/audit/audit-logger.service.ts`
- `backend/src/infrastructure/audit/audit-anchor.service.ts`
- `backend/src/infrastructure/audit/audit-artifact.service.ts`
- `backend/src/infrastructure/audit/audit-recovery-crypto.service.ts`

## 1. Tổng quan

Hệ thống audit không đưa dữ liệu bệnh án trực tiếp lên Blockchain. Backend chỉ đưa các giá trị kiểm chứng lên Blockchain:

- `merkleRoot`: root của nhiều audit log trong một batch.
- `artifactHash`: SHA-256 của file IPFS đã mã hóa.
- `artifactUri`: địa chỉ IPFS để tải artifact.
- `leafCount`: số lượng audit log trong batch.

Dữ liệu phục hồi thật sự nằm ở:

- `BlockchainLogger.beforeEncrypted`
- `BlockchainLogger.afterEncrypted`
- IPFS encrypted artifact, bên trong chứa bản backup của các audit row trong batch.

Flow tổng quát:

```text
Business action
-> tạo rawBefore/rawAfter
-> tạo beforeHash/afterHash
-> mã hóa rawBefore/rawAfter thành beforeEncrypted/afterEncrypted
-> tạo dataHash
-> tạo entryHash nối với prevHash
-> gom nhiều entryHash thành Merkle root
-> tạo IPFS encrypted artifact
-> tính artifactHash
-> commit merkleRoot + artifactHash + artifactUri lên Blockchain
```

## 2. Canonicalize JSON

Trước khi hash, dữ liệu JSON được chuẩn hóa bằng `canonicalize()`.

Mục tiêu:

- Sắp xếp key object theo thứ tự cố định.
- Chuyển `Date` thành ISO string.
- Chặn dữ liệu không ổn định như `undefined`, `function`, `symbol`, `BigInt`, binary, object vòng lặp.
- Đảm bảo cùng một dữ liệu nghiệp vụ luôn tạo cùng một chuỗi JSON, dù thứ tự key khác nhau.

Công thức logic:

```text
canonical = JSON.stringify(toCanonicalJson(value))
```

Ví dụ:

```json
{
  "b": 2,
  "a": 1
}
```

sẽ được chuẩn hóa thành:

```json
{"a":1,"b":2}
```

Ý nghĩa:

```text
Nếu không canonicalize, cùng một JSON nhưng khác thứ tự key có thể tạo hash khác nhau.
```

## 3. `beforeEncrypted` và `afterEncrypted`

Đây là snapshot đầy đủ trước/sau thao tác, được mã hóa bằng AES-256-GCM.

| Field | Ý nghĩa |
|---|---|
| `beforeEncrypted` | Snapshot đầy đủ của entity trước thao tác, đã mã hóa |
| `afterEncrypted` | Snapshot đầy đủ của entity sau thao tác, đã mã hóa |

Format:

```json
{
  "alg": "AES-256-GCM",
  "keyId": "audit-key-v1",
  "iv": "...",
  "tag": "...",
  "ciphertext": "..."
}
```

Công thức khi ghi audit:

```text
rawBefore -> canonicalize(rawBefore) -> AES-256-GCM -> beforeEncrypted
rawAfter  -> canonicalize(rawAfter)  -> AES-256-GCM -> afterEncrypted
```

Key sử dụng:

```env
AUDIT_ENCRYPTION_KEY=64 ký tự hex
AUDIT_ENCRYPTION_KEY_ID=audit-key-v1
```

AAD của AES-GCM:

```text
canonicalize({
  schema: "KLTN_AUDIT_ENCRYPTION_AAD_V1",
  seq,
  entity,
  entityId,
  action,
  createdAtIso
})
```

Ý nghĩa của AAD:

- Ràng buộc ciphertext với đúng audit row.
- Nếu lấy `afterEncrypted` của log này gắn sang log khác, decrypt/verify sẽ fail.

Lưu ý:

```text
beforeEncrypted/afterEncrypted không phải hash.
Đây là dữ liệu mã hóa 2 chiều, backend có key thì giải mã được.
```

## 4. `beforeJson` và `afterJson`

Đây là snapshot đã được sanitize/redaction để UI hiển thị.

| Field | Ý nghĩa |
|---|---|
| `beforeJson` | Bản trước thao tác đã che dữ liệu nhạy cảm |
| `afterJson` | Bản sau thao tác đã che dữ liệu nhạy cảm |

Ví dụ:

```json
{
  "id": "conclusion-1",
  "finalDiagnosis": "SENSITIVE_FIELD_CHANGED",
  "status": "FINALIZED"
}
```

Vai trò:

- Cho Admin xem audit mà không lộ bệnh án plaintext.
- Dùng để hiển thị thay đổi an toàn.
- Không dùng làm nguồn restore chính vì có thể thiếu field nhạy cảm.

Nguồn restore chính là:

```text
afterEncrypted
```

## 5. `beforeHash` và `afterHash`

`beforeHash` và `afterHash` là HMAC-SHA256 của plaintext snapshot trước/sau thao tác.

Chúng không được tính từ ciphertext.

```text
rawBefore -> HMAC-SHA256 -> beforeHash
rawAfter  -> HMAC-SHA256 -> afterHash
```

Key sử dụng:

```env
AUDIT_HASH_KEY=secret dùng để HMAC audit
```

Công thức:

```text
beforeHash = HMAC_SHA256(
  "KLTN_AUDIT_BEFORE_V1|{entity}|{entityId}|{canonicalize(rawBefore)}",
  AUDIT_HASH_KEY
)

afterHash = HMAC_SHA256(
  "KLTN_AUDIT_AFTER_V1|{entity}|{entityId}|{canonicalize(rawAfter)}",
  AUDIT_HASH_KEY
)
```

Ví dụ logic:

```text
rawAfter = {
  id: "conclusion-1",
  finalDiagnosis: "Viêm phổi",
  status: "FINALIZED"
}

afterHash = HMAC_SHA256("KLTN_AUDIT_AFTER_V1|MedicalConclusion|conclusion-1|{...}", AUDIT_HASH_KEY)
```

Vai trò:

- Kiểm tra dữ liệu giải mã từ `beforeEncrypted` và `afterEncrypted` có đúng không.
- Nếu hacker sửa `afterEncrypted`, sau khi decrypt ra dữ liệu khác thì `afterHash` tính lại sẽ lệch.
- Nếu hacker sửa luôn `afterHash`, `entryHash` và Merkle root sẽ lệch với Blockchain.

Flow verify:

```text
afterEncrypted
-> decrypt ra rawAfter
-> tính lại afterHash
-> so với afterHash lưu trong DB
-> khớp thì rawAfter đáng tin ở cấp snapshot
```

## 6. `diffJson`, `fieldsChanged` và `diffHash`

`diffJson` là phần khác biệt giữa `beforeJson` và `afterJson` hoặc giữa snapshot đã được xử lý.

`fieldsChanged` là danh sách field bị thay đổi.

Ví dụ:

```json
{
  "fieldsChanged": ["finalDiagnosis", "treatmentPlan"]
}
```

`diffHash` là HMAC-SHA256 của `diffJson`.

Công thức:

```text
diffHash = HMAC_SHA256(
  "KLTN_AUDIT_DIFF_V1|{canonicalize(diffJson)}",
  AUDIT_HASH_KEY
)
```

Vai trò:

- Validate `diffJson` có bị sửa không.
- Hỗ trợ UI hiển thị field thay đổi.
- Hỗ trợ filter audit theo field thay đổi.

Đánh giá:

```text
diffHash là lớp kiểm chứng phụ.
Core recovery không phụ thuộc diffHash.
Nếu diffJson bị sửa, backend vẫn có thể sinh lại diff từ before/after snapshot.
```

## 7. `dataHash`

`dataHash` là hash tổng của phần nội dung nghiệp vụ trong một audit log.

Nó dùng HMAC-SHA256 với `AUDIT_HASH_KEY`.

Công thức:

```text
dataHash = HMAC_SHA256(
  canonicalize({
    schema: "KLTN_AUDIT_DATA_V2",
    entity,
    entityId,
    action,
    beforeHash,
    afterHash,
    diffHash,
    fieldsChanged
  }),
  AUDIT_HASH_KEY
)
```

Vai trò:

- Gom các hash nghiệp vụ thành một dấu vân tay nội dung.
- Nếu `beforeHash`, `afterHash`, `diffHash`, `fieldsChanged`, `entity`, `entityId` hoặc `action` bị sửa thì `dataHash` sẽ lệch.
- `dataHash` được đưa vào `entryHash`.

Phân biệt:

```text
dataHash kiểm chứng nội dung nghiệp vụ.
entryHash kiểm chứng cả nội dung, thứ tự, actor, thời điểm và liên kết chuỗi.
```

## 8. `prevHash` và `entryHash`

`entryHash` là hash đại diện cho một audit row hoàn chỉnh.

`prevHash` là `entryHash` của audit row đứng trước.

Mục tiêu:

- Tạo hash chain.
- Phát hiện sửa/xóa/đổi thứ tự audit log.
- Làm leaf để tính Merkle root.

Công thức `entryHash` V2:

```text
entryHash = SHA256(
  canonicalize({
    schema: "KLTN_AUDIT_ENTRY_V2",
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
```

Chuỗi liên kết:

```text
log 1:
  prevHash = 000000...
  entryHash = hash(log 1)

log 2:
  prevHash = entryHash của log 1
  entryHash = hash(log 2)

log 3:
  prevHash = entryHash của log 2
  entryHash = hash(log 3)
```

Nếu hacker xóa log 2:

```text
log 3.prevHash không còn nối đúng với log trước
-> hash chain gãy
-> batch verify fail
```

Nếu hacker sửa nội dung log 2:

```text
entryHash log 2 đổi
-> prevHash log 3 không khớp
-> Merkle root tính lại lệch Blockchain
```

## 9. Merkle root

Merkle root dùng để gom nhiều `entryHash` trong một batch thành một root duy nhất đưa lên Blockchain.

Input:

```text
entryHashes = [
  log100.entryHash,
  log101.entryHash,
  log102.entryHash,
  ...
]
```

Thuật toán mới:

```text
MERKLE_SHA256_BYTES32_V2
```

Công thức leaf:

```text
leaf = SHA256("KLTN_AUDIT_LEAF_V2" || bytes32(entryHash))
```

Công thức node:

```text
node = SHA256("KLTN_AUDIT_NODE_V2" || min(left, right) || max(left, right))
```

Nếu số node lẻ:

```text
node cuối được duplicate để ghép cặp
```

Kết quả:

```text
merkleRoot
```

Vai trò:

- Đại diện cho toàn bộ batch audit log.
- Chỉ cần đưa một root lên Blockchain thay vì đưa từng log.
- Nếu bất kỳ `entryHash` nào bị sửa, Merkle root sẽ đổi.

## 10. `artifactHash`

`artifactHash` là SHA-256 của file IPFS artifact đã mã hóa.

Input:

```text
encryptedArtifactBytes
```

Công thức:

```text
artifactHash = "0x" + SHA256(encryptedArtifactBytes)
```

Vai trò:

- Kiểm tra file IPFS có bị sửa không.
- `artifactHash` được lưu trên Blockchain.
- Khi recovery, backend tải IPFS artifact về, tính lại SHA-256, rồi so với `artifactHash` trên Blockchain.

Flow verify IPFS:

```text
1. Lấy artifactUri từ Blockchain checkpoint
2. Tải file IPFS
3. Tính SHA-256(file mã hóa)
4. So với artifactHash trên Blockchain
5. Nếu lệch -> từ chối recovery
6. Nếu khớp -> giải mã artifact
```

## 11. IPFS encrypted artifact

IPFS không lưu plaintext audit log.

IPFS lưu một file đã mã hóa AES-256-GCM.

Format bên ngoài:

```json
{
  "schema": "KLTN_AUDIT_RECOVERY_ENCRYPTED_BUNDLE_V1",
  "alg": "AES-256-GCM",
  "keyId": "...",
  "aad": "KLTN_AUDIT_RECOVERY_BUNDLE_V1|batchId",
  "iv": "...",
  "tag": "...",
  "ciphertext": "...",
  "wrappedDek": {
    "provider": "local",
    "keyId": "...",
    "iv": "...",
    "tag": "...",
    "ciphertext": "..."
  }
}
```

Sau khi backend giải mã artifact, bên trong là recovery bundle:

```json
{
  "schema": "KLTN_AUDIT_RECOVERY_BUNDLE_V1",
  "batch": {
    "batchId": 12,
    "merkleRoot": "...",
    "leafCount": 51,
    "fromSeq": 100,
    "toSeq": 150,
    "algorithmVersion": "MERKLE_SHA256_BYTES32_V2"
  },
  "logs": [
    {
      "seq": 100,
      "prevHash": "...",
      "entryHash": "...",
      "entity": "MedicalConclusion",
      "entityId": "...",
      "action": "UPDATE",
      "actorId": "...",
      "beforeJson": {},
      "afterJson": {},
      "beforeHash": "...",
      "afterHash": "...",
      "diffHash": "...",
      "dataHash": "...",
      "beforeEncrypted": {},
      "afterEncrypted": {},
      "fieldsChanged": [],
      "createdAt": "..."
    }
  ]
}
```

Điểm quan trọng:

```text
IPFS artifact hiện tại đã chứa beforeEncrypted và afterEncrypted của từng audit row.
```

Nghĩa là nếu DB audit bị sửa/mất:

```text
backend tải IPFS artifact
-> verify artifactHash với Blockchain
-> giải mã artifact
-> restore lại BlockchainLogger
-> verify lại hash chain + Merkle root
-> dùng afterEncrypted để restore entity
```

## 12. Blockchain checkpoint

Smart contract nhận checkpoint theo batch.

Input backend gửi lên Blockchain:

```text
batchId
merkleRoot
leafCount
artifactHash
artifactUri
```

Hàm logic:

```solidity
commitCheckpoint(
  uint256 batchId,
  bytes32 merkleRoot,
  uint256 leafCount,
  bytes32 artifactHash,
  string artifactUri
)
```

Blockchain không lưu:

- plaintext bệnh án
- `beforeEncrypted`
- `afterEncrypted`
- API key/token
- key AES
- toàn bộ audit row

Blockchain chỉ lưu thông tin kiểm chứng:

- Root của batch.
- Hash của IPFS artifact.
- URI để tải artifact.
- Số lượng leaf.
- Timestamp/committed status tùy contract.

## 13. Flow ghi audit log

```text
1. Business action xảy ra
2. Backend lấy rawBefore và rawAfter
3. Tạo beforeJson/afterJson đã redaction cho UI
4. Tạo beforeHash/afterHash từ rawBefore/rawAfter
5. Tạo diffJson/fieldsChanged
6. Tạo diffHash
7. Tạo dataHash
8. Tạo entryHash từ dataHash + seq + prevHash + actor + action + time
9. Mã hóa rawBefore/rawAfter thành beforeEncrypted/afterEncrypted
10. Lưu BlockchainLogger
11. Khi đủ điều kiện seal batch, gom entryHash thành Merkle root
12. Tạo recovery bundle chứa audit rows, gồm beforeEncrypted/afterEncrypted
13. Mã hóa bundle
14. Upload IPFS
15. Tính artifactHash của file IPFS đã mã hóa
16. Commit merkleRoot + artifactHash + artifactUri lên Blockchain
17. Mark batch ANCHORED
```

## 14. Flow verify audit row

```text
1. Lấy audit row
2. Kiểm tra format beforeEncrypted/afterEncrypted
3. Decrypt beforeEncrypted/afterEncrypted bằng AUDIT_ENCRYPTION_KEY
4. Tính lại beforeHash/afterHash từ plaintext vừa decrypt
5. So với beforeHash/afterHash đang lưu
6. Tính lại diffHash từ diffJson
7. Tính lại dataHash
8. Tính lại entryHash
9. Tính lại Merkle root của batch
10. So với Merkle root trên Blockchain
11. Nếu tất cả khớp -> audit row trusted
```

## 15. Flow restore entity

```text
1. Admin chọn entity bị warning
2. Backend tìm audit row mới nhất của entity đó đã ANCHORED
3. Verify audit row theo flow ở trên
4. Nếu audit row trusted:
   - decrypt afterEncrypted
   - validate snapshot đủ field
   - update lại đúng entity
   - recompute hash entity nếu có
   - ghi audit AUDIT_ENTITY_RECOVERED
5. Nếu audit row không trusted:
   - không restore entity từ DB audit
   - chạy batch recovery từ IPFS trước
```

## 16. Flow restore audit batch từ IPFS

```text
1. Backend lấy checkpoint trên Blockchain theo batchId
2. Lấy artifactUri và artifactHash
3. Tải artifact từ IPFS
4. Tính SHA-256 file artifact
5. So với artifactHash trên Blockchain
6. Nếu khớp, giải mã artifact
7. Lấy logs trong bundle
8. Restore BlockchainLogger của batch
9. Tính lại hash chain
10. Tính lại Merkle root
11. So với merkleRoot trên Blockchain
12. Nếu khớp, audit history được phục hồi
13. Sau đó mới chạy entity recovery từ afterEncrypted
```

## 17. Nếu hacker sửa dữ liệu thì phát hiện thế nào?

### Case 1: Sửa entity DB

```text
Entity hash/live snapshot lệch
-> warning integrity
-> restore entity từ latest trusted afterEncrypted
```

### Case 2: Sửa `afterEncrypted` trong DB audit

```text
decrypt fail
hoặc afterHash tính lại lệch
-> audit row tampered
-> không restore entity từ DB audit
-> recover audit từ IPFS
```

### Case 3: Sửa `afterEncrypted` và sửa luôn `afterHash`

```text
dataHash/entryHash phải đổi
-> Merkle root tính lại lệch Blockchain
-> audit DB không trusted
-> recover audit từ IPFS
```

### Case 4: Sửa IPFS artifact

```text
SHA-256(file IPFS) != artifactHash trên Blockchain
-> từ chối recovery
```

### Case 5: Sửa DB audit và IPFS artifact

```text
Blockchain vẫn giữ merkleRoot và artifactHash cũ
-> phát hiện sai lệch
-> nếu không còn pin IPFS đúng thì phải dùng PostgreSQL PITR/WAL hoặc backup DB
```

## 18. Các field nên giải thích khi bảo vệ

Để trình bày ngắn gọn, chia field thành 4 nhóm.

### Nhóm hiển thị an toàn

| Field | Vai trò |
|---|---|
| `beforeJson` | Dữ liệu trước thao tác đã redaction |
| `afterJson` | Dữ liệu sau thao tác đã redaction |
| `fieldsChanged` | Field nào bị thay đổi |

### Nhóm phục hồi

| Field | Vai trò |
|---|---|
| `beforeEncrypted` | Snapshot trước thao tác, mã hóa AES |
| `afterEncrypted` | Snapshot sau thao tác, mã hóa AES, nguồn restore entity |

### Nhóm kiểm chứng

| Field | Vai trò |
|---|---|
| `beforeHash` | Kiểm chứng plaintext trước thao tác |
| `afterHash` | Kiểm chứng plaintext sau thao tác |
| `dataHash` | Gom hash nội dung nghiệp vụ |
| `prevHash` | Nối audit row với row trước |
| `entryHash` | Hash hoàn chỉnh của audit row |
| `merkleRoot` | Root của batch đưa lên Blockchain |
| `artifactHash` | Hash của IPFS encrypted artifact |

### Nhóm metadata kỹ thuật

| Field | Vai trò |
|---|---|
| `hashVersion` | Version thuật toán hash |
| `encryptionVersion` | Version thuật toán mã hóa |
| `encryptionKeyId` | ID key mã hóa, không phải key thật |
| `batchId` | Batch chứa audit row |
| `txHash` | Transaction hash trên Blockchain |
| `blockNumber` | Block xác nhận transaction |

## 19. Có cần `beforeEncryptedHash` và `afterEncryptedHash` không?

Hiện tại chưa có field riêng:

```text
beforeEncryptedHash
afterEncryptedHash
```

Hệ thống đang verify ciphertext gián tiếp:

```text
beforeEncrypted/afterEncrypted
-> decrypt
-> tính beforeHash/afterHash từ plaintext
-> so với hash lưu trong audit row
-> verify entryHash + Merkle root
```

Nếu muốn defense-in-depth trong Audit V3, có thể thêm:

```text
beforeEncryptedHash = SHA256(canonicalize(beforeEncrypted))
afterEncryptedHash  = SHA256(canonicalize(afterEncrypted))
```

Sau đó đưa hai field này vào `entryHash` V3.

Lợi ích:

- Phát hiện trực tiếp ciphertext bị sửa.
- Dễ giải thích: một hash kiểm ciphertext, một hash kiểm plaintext.

Nhược điểm:

- Cần migration DB.
- Cần `hashVersion` mới.
- Cần support V2 và V3 song song.
- Cần cập nhật verify, IPFS bundle và test.

Khuyến nghị hiện tại:

```text
Nếu sát deadline, giữ V2 hiện tại.
Nếu muốn nâng cấp sau bảo vệ, thêm beforeEncryptedHash/afterEncryptedHash trong Audit V3.
```

## 20. Tóm tắt dễ nhớ

```text
beforeJson / afterJson
-> Cho UI xem, đã che dữ liệu nhạy cảm.

beforeEncrypted / afterEncrypted
-> Dữ liệu đầy đủ đã mã hóa, dùng để phục hồi.

beforeHash / afterHash
-> Kiểm chứng dữ liệu sau khi giải mã có đúng không.

dataHash
-> Gom nội dung nghiệp vụ của audit log.

entryHash + prevHash
-> Tạo chuỗi audit chống sửa/xóa/đổi thứ tự.

Merkle root
-> Gom nhiều audit log thành một root đưa lên Blockchain.

artifactHash
-> Kiểm tra file IPFS artifact có bị sửa không.

Blockchain
-> Không lưu bệnh án, chỉ lưu root/hash/URI để kiểm chứng.

IPFS
-> Lưu encrypted artifact, bên trong có backup audit rows và beforeEncrypted/afterEncrypted.
```
