# 🚀 Hướng dẫn cài đặt & Khởi chạy hệ thống (Running Instructions)

Tài liệu này hướng dẫn chi tiết cách chạy hệ thống ZKP Identity Verification System, bao gồm các bước deploy mạng blockchain, chạy backend, frontend, cấu hình MetaMask và tạo tài khoản Admin đầu tiên.

---

## 📋 Mục lục
1. [Cấu hình file môi trường (.env)](#1-cấu-hình-file-môi-trường-env)
2. [Cách 1: Chạy bằng Docker Compose (Khuyên dùng)](#2-cách-1-chạy-bằng-docker-compose-khuyên-dùng)
3. [Cách 2: Chạy thủ công từng service (Manual Run)](#3-cách-2-chạy-thủ-công-từng-service-manual-run)
4. [Cài đặt & cấu hình ví MetaMask](#4-cài-đặt--cấu-hình-ví-metamask)
5. [Tạo tài khoản Admin đầu tiên (Bootstrap)](#5-tạo-tài-khoản-admin-đầu-tiên-bootstrap)
6. [Thông tin tài khoản Bác sĩ mặc định](#6-thông-tin-tài-khoản-bác-sĩ-mặc-định)

---

## 1. Cấu hình file môi trường (.env)

Trước khi khởi chạy, hãy chắc chắn thư mục gốc chứa file `.env` với các nội dung sau:

```env
# Port backend & frontend
PORT=3001
JWT_SECRET=super_secret_key_for_zkp_system_2026
JWT_EXPIRATION=1h

# Blockchain Smart Contract Address
IDENTITY_REGISTRY_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
AI_MODEL_REGISTRY_ADDRESS=0x...

# Hardhat Account #0 Private Key (Super Admin Relayer)
SUPER_ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Key dùng để mã hóa MFA Secret trong DB (AES-256)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

---

## 2. Cách 1: Chạy bằng Docker Compose (Khuyên dùng)

Cách nhanh nhất để chạy toàn bộ hệ thống (Database, Blockchain Node, Backend, Frontend) là dùng Docker Compose.

### 🚀 Khởi chạy hệ thống:
```bash
docker compose up --build
```

Hệ thống sẽ tự động khởi động các service theo thứ tự:
1. **`zkp-postgres`**: PostgreSQL database (Cổng `5432`).
2. **`zkp-blockchain`**: Khởi chạy Hardhat Node và tự động Deploy Smart Contract (Cổng `8545`).
3. **`zkp-backend`**: NestJS API + Prisma migration + seed dữ liệu (Cổng `3001`).
4. **`zkp-frontend`**: React Vite (Cổng `5173`).

Hệ thống hoàn tất khởi động khi Terminal hiển thị:
`zkp-frontend  |   VITE v5.4.21  ready in XX ms`

### 🛑 Các lệnh Docker hữu ích khác:
* **Chạy ẩn dưới nền (Background):** `docker compose up -d --build`
* **Xem logs trực tiếp từ Backend:** `docker logs -f zkp-backend`
* **Dừng toàn bộ hệ thống:** `docker compose down`
* **Xóa sạch dữ liệu DB & Blockchain để reset lại từ đầu:** `docker compose down -v`

---

## 3. Cách 2: Chạy thủ công từng service (Manual Run)

Nếu muốn chạy bằng tay để debug, hãy mở 4 cửa sổ Terminal riêng biệt:

### 🖥️ Terminal 1: Khởi chạy Blockchain Node (Hardhat)
```bash
cd blockchain
npm install
npm run node
```

### 🖥️ Terminal 2: Deploy Smart Contract lên Blockchain Local
```bash
cd blockchain
npm run deploy:local
```
*Ghi lại địa chỉ Smart Contract `IdentityRegistry` và `AiModelRegistry` được xuất ra màn hình, sau đó cập nhật `IDENTITY_REGISTRY_ADDRESS` và `AI_MODEL_REGISTRY_ADDRESS` trong file `.env` nếu có thay đổi.*

### 🖥️ Terminal 3: Chạy Backend (NestJS)
```bash
cd backend
npm install
npx prisma db push
npx prisma db seed
npm run start:dev
```

### 🖥️ Terminal 4: Chạy Frontend (React Vite)
```bash
cd frontend
npm install
npm run dev
```

Truy cập hệ thống qua trình duyệt: `http://localhost:5173`

---

## 4. Cài đặt & cấu hình ví MetaMask

### 🌐 Thêm Mạng Hardhat Network
1. Mở tiện ích mở rộng **MetaMask** trên trình duyệt.
2. Nhấp vào menu chọn mạng → **Add network** → **Add a network manually**.
3. Điền thông tin mạng Local:
   * **Network Name:** `Hardhat Localhost`
   * **New RPC URL:** `http://localhost:8545` (Hoặc `http://127.0.0.1:8545`)
   * **Chain ID:** `31337`
   * **Currency Symbol:** `ETH`
4. Lưu và chuyển sang mạng vừa thêm.

### 🔑 Import Ví Thử Nghiệm (Pre-funded 10,000 ETH)
Sử dụng các tài khoản có sẵn của Hardhat để test:

| Tài khoản | Địa chỉ Ví (Wallet Address) | Private Key tương ứng |
|-----------|-------------------------|----------------------|
| **Account #0** (Super Admin) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| **Account #1** (Dùng cho Admin test) | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| **Account #2** (Dùng cho Bác sĩ test) | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa73f9876e5228e37186140b6e9b40ba9c195609ee7def409a5ae9cd` |

**Cách Import:**
Mở MetaMask → Nhấp vào hình đại diện tài khoản → **Import account** → Dán Private Key tương ứng ở bảng trên → **Import**.

---

## 5. Tạo tài khoản Admin đầu tiên (Bootstrap)

Vì Admin **không dùng mật khẩu**, hệ thống cần đăng ký khuôn mặt và ví lần đầu. Đầu tiên, bạn phải kích hoạt tài khoản Admin gốc (Bootstrap).

### ⚡ Bước 1: Gọi API Bootstrap
Khi hệ thống mới tinh và chưa có Admin nào, gọi API Bootstrap bằng cURL hoặc Postman:

```bash
curl -X POST http://localhost:3001/api/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@hospital.vn",
    "superAdminSecret": "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  }'
```

*Lưu ý: API này chỉ hoạt động duy nhất **1 lần**. Khi hệ thống đã có tối thiểu 1 Admin, endpoint này sẽ trả về lỗi `403 Forbidden`.*

### ⚡ Bước 2: Lấy Invite Token từ Response
Kết quả trả về sẽ có dạng:
```json
{
  "message": "First Admin account created successfully!",
  "user": { "id": "...", "username": "admin", "email": "admin@hospital.vn", "role": "ADMIN" },
  "inviteToken": "a1b2c3d4e5f6...64_hex_chars...",
  "instructions": "Use this invite token on the Login page → Admin tab → \"Invite Code\" to complete registration."
}
```
*Hãy copy lấy `inviteToken`.*

### ⚡ Bước 3: Đăng ký danh tính trên Frontend
1. Truy cập `http://localhost:5173`
2. Chọn tab **🔐 Admin (Ví Web3)**
3. Nhấp vào nút **🎟️ Mã mời (Lần đầu đăng nhập)**.
4. Dán `inviteToken` vào và xác nhận.
5. **Tiến hành thiết lập 3 bước**:
   * **Quét khuôn mặt (Face Scan)**: Camera sẽ hướng dẫn bạn quét các góc mặt (lên, xuống, trái, right, thẳng) để đảm bảo thực thể sống (Liveness Detection).
   * **Kết nối ví Web3**: Kết nối MetaMask (ví dụ: `Account #1`).
   * **Đăng ký ZKP**: Hệ thống tạo Proof và ghi danh ví của bạn lên Smart Contract.
6. **Lưu lại mã MFA Secret**: Mã khôi phục khóa ví/khuôn mặt sẽ hiển thị. Hãy lưu cẩn thận để dùng trong trang khôi phục ví Admin khi cần.

---

## 6. Thông tin tài khoản Bác sĩ mặc định

Tài khoản bác sĩ mẫu được khởi tạo tự động từ DB Seeder:

| Username | Mật khẩu mẫu | Email liên kết |
|----------|-------------|----------------|
| `dr.john.doe` | `doctor123` | `john.doe@hospital.vn` |
| `dr.jane.smith` | `doctor123` | `jane.smith@hospital.vn` |
| `dr.alan.turing` | `doctor123` | `alan.turing@hospital.vn` |

**Cách đăng nhập của Bác sĩ:**
1. Chọn tab **Bác sĩ (Password)**.
2. Nhập `Username` và `Password` mẫu.
3. Khi đăng nhập lần đầu, Bác sĩ sẽ được yêu cầu đổi mật khẩu mới → Quét khuôn mặt để đăng ký sinh trắc học → Đăng ký ZKP liên kết.
4. Từ các lần sau, Bác sĩ chỉ cần **Quét khuôn mặt là đăng nhập thành công** (không cần nhập username/password nữa).
