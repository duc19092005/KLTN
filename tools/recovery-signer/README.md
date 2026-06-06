# Recovery Signer

> Ký chuỗi challenge bằng MetaMask để khôi phục database khẩn cấp khi không thể đăng nhập bình thường.

## Mục đích

Khi DB bị xóa / mã hóa hoặc bị tampered nặng đến mức **không có User để đăng nhập, dữ liệu sinh trắc học cũng không tin được nữa**, hệ thống cần một "chìa khóa gốc" thay thế. Công cụ này dùng **wallet Web3 của Admin** đã đăng ký trong contract `IdentityRegistry` làm root of trust ngoại băng (out-of-band).

Quy trình tổng thể:

```text
SSH server đang sập             Máy cá nhân Admin (an toàn)
─────────────────               ─────────────────────────────
$ npm run db:emergency-restore  ┌──→ Mở recovery-signer/index.html
        │                       │    Kết nối MetaMask
        ▼                       │    Dán challenge → Ký
EMERGENCY_..._CHALLENGE:abc:t  ─┘
        │                            │
        ▼                            ▼
       (Admin copy challenge)   0xabcdef... (chữ ký)
        │                            │
        └──── Admin paste signature ◄┘
        │
        ▼
Verify on-chain: ethers.verifyMessage()
                 → IdentityRegistry.isAuthorized()
        │
        ▼
Drop DB + nạp dump qua psql
```

## Khi nào dùng

| Tình huống | Lý do |
|---|---|
| DB bị xóa hoặc mã hóa | Không còn bảng User để đăng nhập |
| Sinh trắc học không tin được | Không thể dùng face scan để xác thực |
| Server bị xâm nhập | Không tin tưởng bất cứ thông tin nào trên server |
| Cần restore toàn bộ từ backup `.sql` | Đây là cách duy nhất khi đã mất hết quyền truy cập |

> [!CAUTION]
> **Không dùng cho việc khôi phục bình thường.** Nếu UI Admin còn hoạt động, dùng "Surgical Restore" trên `/admin/backup` (chỉ phục hồi record bị tampered, an toàn hơn nhiều). Recovery Signer là phương án cuối cùng.

## Yêu cầu

- **Trên máy cá nhân Admin (KHÔNG phải server):**
  - Trình duyệt có cài MetaMask
  - Wallet Admin đã được đăng ký trong contract `IdentityRegistry` (qua script deploy)
- **Trên server:**
  - Quyền SSH
  - File backup `.sql` hợp lệ (qua SCP/USB)
  - Backend repo đã clone (để chạy `npm run db:emergency-restore`)

**Không cần:** Internet trên trình duyệt khi ký (toàn bộ logic ký chạy local trong MetaMask).

## Cách truy cập

Có 3 vị trí có thể chạy file này, ưu tiên theo độ an toàn:

### 1. USB / Github Pages riêng của Admin (KHUYẾN NGHỊ NHẤT)

```bash
# Trên máy cá nhân Admin, copy thư mục này ra USB
cp -r tools/recovery-signer/ /Volumes/AdminUSB/

# Khi cần, cắm USB vào máy cá nhân và mở
open /Volumes/AdminUSB/recovery-signer/index.html
```

**Tại sao:** Hoàn toàn cách ly khỏi infra đang bị nghi ngờ. Hacker có chiếm được server cũng không sửa được file trên USB của Admin.

### 2. File trong repo trên máy cá nhân

```bash
# Trên laptop của Admin (đã clone repo)
xdg-open tools/recovery-signer/index.html   # Linux
open tools/recovery-signer/index.html       # macOS
```

**Phù hợp khi:** Admin có repo trên máy cá nhân và chưa kịp setup USB. Vẫn an toàn vì máy cá nhân không phải server đang sập.

### 3. URL từ frontend đang chạy

```text
https://<your-frontend-domain>/recovery-signer.html
```

File `frontend/public/recovery-signer.html` là **bản sao đồng bộ** của `tools/recovery-signer/index.html`, được Vite serve nguyên bản (file tĩnh trong `public/`).

> [!CAUTION]
> Phương án này chỉ dùng khi **frontend còn chạy bình thường** và bạn tin tưởng nó. Nếu frontend cùng infra với DB đang sập, đừng dùng — hacker có thể đã chỉnh HTML để đánh cắp chữ ký.

## Quy trình chi tiết (A-Z)

Xem [docs/backup-recovery/emergency-restore.md](../../docs/backup-recovery/emergency-restore.md) cho hướng dẫn từng bước có ảnh chụp màn hình.

Tóm tắt:

1. **SSH** vào server, `cd backend`, chạy:
   ```bash
   npm run db:emergency-restore /path/to/dump.sql
   ```
2. Terminal in ra `EMERGENCY_DATABASE_RESTORE_CHALLENGE:<hex>:<timestamp>` — copy.
3. **Trên máy cá nhân:** mở `recovery-signer/index.html`, bấm "Kết nối ví MetaMask".
4. Dán challenge vào ô nhập, bấm "Ký thông điệp cứu hộ", xác nhận trên MetaMask.
5. Copy chữ ký hex (`0x...`).
6. Quay lại terminal SSH, paste chữ ký, Enter.
7. Backend tự verify on-chain → nếu hợp lệ, drop DB + restore.

## Vì sao tách ngoại băng (out-of-band)?

Khi server bị nghi ngờ, **mọi thứ trên server đều không được tin**:

- Khóa private không được nhập vào server (kẻ tấn công có thể log keystroke).
- Việc kiểm tra "ai là Admin" không được giao cho DB (đang bị nghi ngờ) hay cho file `.env` trên server.
- Phải dùng nguồn chân thật **độc lập** với server đang sập.

Giải pháp:
1. **Khóa private:** ở trong MetaMask trên máy cá nhân, không bao giờ rời ra.
2. **Kiểm tra quyền Admin:** đọc trực tiếp `IdentityRegistry` smart contract on-chain — không thể giả mạo.
3. **Challenge ngẫu nhiên + timestamp:** chống replay (chữ ký cũ không reuse được).

## Tệp đồng bộ

| Đường dẫn | Vai trò |
|---|---|
| `tools/recovery-signer/index.html` | **Canonical** — chỉnh sửa ở đây |
| `frontend/public/recovery-signer.html` | Bản deploy qua Vite — sync từ canonical |

Khi cần cập nhật, sửa file canonical rồi:
```bash
cp tools/recovery-signer/index.html frontend/public/recovery-signer.html
```

## Tài liệu liên quan

- [Hướng dẫn Emergency Restore từng bước](../../docs/backup-recovery/emergency-restore.md)
- [Tổng quan Backup & Recovery](../../docs/backup-recovery/overview.md)
- [Break-Glass Viewer (công cụ song song)](../break-glass-viewer/README.md)
