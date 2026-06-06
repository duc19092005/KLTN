**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# Break-Glass Backup Ledger Viewer

> Đọc + xác minh sổ backup khi server không khả dụng. **Read-only, offline, không cần backend.**

## Mục đích

Khi server hoặc database sập (hoặc bị nghi xâm nhập), bạn cần một cách độc lập để chứng minh "lịch sử backup chưa bị chỉnh sửa". Công cụ này giải quyết đúng việc đó:

- Mở 1 file HTML duy nhất, **không cần internet, không cần backend, không cài đặt gì**.
- Kéo thả file `backup-ledger.jsonl` (sổ JSONL append-only được ghi mỗi lần backup).
- Công cụ chạy SHA-256 thuần JavaScript ngay trong trình duyệt để xác minh:
  1. **Liên kết chuỗi (linkage):** mỗi dòng có `prevHash` khớp `entryHash` của dòng trước → phát hiện xóa, chèn, đảo dòng.
  2. **Toàn vẹn nội dung (entryHash):** nếu nhập đúng `AUDIT_PEPPER`, công cụ tính lại entryHash từng dòng và so sánh → phát hiện sửa nội dung.

## Khi nào dùng

| Tình huống | Lý do |
|---|---|
| Audit định kỳ | Chứng minh sổ backup nguyên vẹn cho kiểm toán viên |
| Server sập / DB chết | Vẫn xác minh được sổ backup mà không cần system |
| Nghi ngờ tấn công nội bộ | Phát hiện ngay nếu có dòng bị xóa/đổi |
| Trước khi tin một bản backup | Đối chiếu sha256 trên ledger với file dump trước khi restore |

## Yêu cầu

- 1 trình duyệt bất kỳ (Chrome, Edge, Firefox, Safari)
- File `backup-ledger.jsonl` (mặc định ở volume offsite, riêng với DB)
- (Tùy chọn) `AUDIT_PEPPER` từ `.env` của backend nếu muốn kiểm tra đầy đủ entryHash

**Không cần:**
- Internet
- Backend / API
- MetaMask / wallet
- Quyền Admin

## Cách truy cập

### Khuyến nghị: cùng volume với ledger

```text
USB / NAS offsite/
├── backup-ledger.jsonl
├── backups/
│   ├── BK-20250115-0001.sql
│   └── ...
└── break-glass-viewer/
    └── index.html       ← copy file này vào đây
```

1. Sao chép thư mục `tools/break-glass-viewer/` này ra USB hoặc NAS đặt cạnh sổ backup.
2. Click đúp `index.html` (mở qua `file://`).
3. Kéo thả `backup-ledger.jsonl` vào vùng được chỉ định.
4. (Tùy chọn) Nhập `AUDIT_PEPPER` để xác minh đầy đủ.
5. Đọc kết quả: tổng số bản, trạng thái liên kết chuỗi, số bản đã neo on-chain.

### Tại sao đặt offsite, không trên server?

Mục đích của break-glass viewer là **kiểm chứng được khi server không hoạt động**. Nếu để cùng server, khi server sập là viewer cũng không truy cập được — mất ý nghĩa.

## Diễn giải kết quả

| Dấu hiệu | Ý nghĩa |
|---|---|
| ✓ "Sổ backup TOÀN VẸN" + chuỗi liền mạch | Lịch sử nguyên vẹn (về linkage) |
| ⚠ "Chuỗi bị đứt" | Có dòng bị xóa / chèn / đảo |
| ⚠ "entryHash không khớp" | Một dòng đã bị sửa nội dung (hoặc pepper sai) |
| Cột "Neo on-chain" có txHash | Manifest đã được anchor thành công |

> [!IMPORTANT]
> **Không có pepper vẫn dùng được:** kiểm tra linkage hash chain không cần secret. Đó là điều quan trọng — bất kỳ kiểm toán viên nào cầm sổ ledger cũng tự xác minh được, không cần ai cấp quyền.

## Tài liệu liên quan

- [Tổng quan Backup & Recovery](../../docs/backup-recovery/overview.md)
- [Recovery Signer (công cụ song song)](../recovery-signer/README.md)
