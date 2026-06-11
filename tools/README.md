**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# Standalone Tools

Hai công cụ HTML tĩnh dùng cho **tình huống khẩn cấp khi không thể tin cậy server / DB**. Cả hai đều chạy hoàn toàn trên trình duyệt, không phụ thuộc backend.

## So sánh nhanh

| Tiêu chí | [break-glass-viewer](./break-glass-viewer/README.md) | [recovery-signer](./recovery-signer/README.md) |
|---|---|---|
| **Mục đích** | Đọc + xác minh sổ backup | Ký challenge để khôi phục DB |
| **Hành vi** | Read-only | Write (tạo chữ ký Web3) |
| **Đầu vào** | File `backup-ledger.jsonl` | Chuỗi `EMERGENCY_..._CHALLENGE:...` |
| **Đầu ra** | Báo cáo TOÀN VẸN/BẤT THƯỜNG | Chữ ký hex `0x...` |
| **Yêu cầu** | Chỉ trình duyệt | Trình duyệt + MetaMask + ví Admin |
| **Internet** | Không cần | Không cần |
| **Ai dùng** | Bất kỳ kiểm toán viên nào | Chỉ Admin có wallet Superadmin |
| **Vị trí lưu** | Cùng volume offsite với ledger | USB Admin / Github Pages riêng |

## Khi nào dùng cái nào

```text
Cần xác minh sổ backup chưa bị chỉnh?
    └─→ break-glass-viewer

Cần restore toàn bộ DB đã bị xóa/mã hóa?
    └─→ recovery-signer + npm run db:emergency-restore

Chỉ vài record bị tampered, UI Admin còn chạy?
    └─→ Surgical Restore tại /admin/backup (KHÔNG dùng tools này)
```

## Tài liệu liên quan

- [Tổng quan Backup & Recovery](../docs/backup-recovery/overview.md)
- [Hướng dẫn Emergency Restore từng bước](../docs/backup-recovery/emergency-restore.md)
