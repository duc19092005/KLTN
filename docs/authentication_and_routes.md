# Tài Liệu Xác Thực & Tuyến Đường Mã Nguồn (Authentication & Application Routes Documentation)

Tài liệu này tổng hợp toàn bộ cơ chế xác thực (Authentication), phân quyền (RBAC) và danh sách tuyến đường (Routes) của dự án **Bệnh viện Đa khoa Quốc tế KLTN (`apps/hospital-web`)**. 
Dùng làm tài liệu tham khảo khi phát triển và phục vụ **Rollback** khi chuyển từ môi trường Dev Bypass về Production.

---

## 1. Kiến Trúc Xác Thực (Authentication Architecture)

### 1.1 Quản lý Phiên (Session Management)
- **Cơ chế**: Sử dụng HTTP-only Cookie từ Backend gửi về trình duyệt (`withCredentials: true` trong Axios `api.js`).
- **Provider chính**: `AuthProvider` ([AuthProvider.jsx](file:///d:/Personal%20Datas/KLTN/apps/hospital-web/src/providers/AuthProvider.jsx)).
- **Trạng thái Phiên**:
  - `token`: Đánh dấu phiên hoạt động (`cookie_session`).
  - `user`: Đối tượng người dùng hiện tại (chứa `id`, `username`, `role`, `verified`, `firstLogin`, `hasFace`).
  - `loading`: Trạng thái chờ kiểm tra `/auth/me` khi vừa tải trang.

### 1.2 Các Phương Thức Đăng Nhập
1. **Mật khẩu Nhân sự (`loginWithPassword`)**: Endpoint `/auth/staff-login` cho Admin, Bác sĩ, Lễ tân, Quản lý Lab.
2. **Khuôn mặt Sinh trắc học (`loginWithFace`)**: Endpoint `/auth/face-login` qua mô hình InsightFace.
3. **Mã mời Bác sĩ/Nhân viên (`loginWithInvite`)**: Endpoint `/auth/invite-login` cho người dùng lần đầu.
4. **Ví điện tử Web3 (`loginWithWallet`)**: Endpoint `/auth/wallet-login` cho ký số giao dịch.

---

## 2. Phân Quyền Vai Trò (Role-Based Access Control - RBAC)

Hệ thống định nghĩa các Vai trò chính (`role`):
- `ADMIN`: Quản trị viên toàn quyền hệ thống.
- `DOCTOR`: Bác sĩ lâm sàng.
- `RECEPTIONIST`: Nhân viên lễ tân tiếp đón.
- `LAB_MANAGER`: Quản lý phòng xét nghiệm & cận lâm sàng.

### Quy tắc Bảo vệ Route (`ProtectedRoute`):
1. **Kiểm tra đăng nhập**: `if (!token || !user) -> /login`
2. **Lần đầu đăng nhập**: `if (user.firstLogin) -> /authenticate` hoặc `/change-password`
3. **Xác thực sinh trắc**: `if (requireVerified && !user.verified) -> /authenticate`
4. **Kiểm tra Vai trò (Roles)**: `if (roles.length && !roles.includes(user.role)) -> Dashboard riêng`
5. **Kiểm tra Quyền Quản lý (Manager)**: `if (requireManager && user.role !== 'ADMIN' && !user.isManager) -> Dashboard riêng`

---

## 3. Danh Sách Các Tuyến Đường (Application Routes)

| Đường Dẫn (Route) | Yêu Cầu Bảo Vệ (`ProtectedRoute`) | Vai Trò Cho Phép (`roles`) | Mô Tả Trang |
| :--- | :--- | :--- | :--- |
| `/` | Không (Công khai) | Tất cả | Trang Home / Landing Page |
| `/patient-home` | Không (Công khai) | Bệnh nhân | Cổng tra cứu cho bệnh nhân |
| `/login` | Không (Công khai) | Tất cả | Modal/Trang đăng nhập |
| `/admin` | Có (`requireVerified`) | `ADMIN` | Trang Tổng quan Quản trị |
| `/admin/departments` | Có (`requireVerified`) | `ADMIN` | Quản lý Khoa phòng |
| `/admin/staff` | Có (`requireVerified`) | `ADMIN` | Quản lý Nhân sự |
| `/admin/doctors` | Có (`requireVerified`) | `ADMIN` | Quản lý Bác sĩ |
| `/admin/ai-models` | Có (`requireVerified`) | `ADMIN` | Quản lý Mô hình AI |
| `/admin/audit` | Có (`requireVerified`) | `ADMIN` | Nhật ký Audit Checkpoint |
| `/receptionist/intake` | Có (`requireVerified`) | `RECEPTIONIST` | Tiếp đón bệnh nhân & NFC CCCD |
| `/receptionist/queue` | Có (`requireVerified`) | `RECEPTIONIST` | Quản lý hàng chờ khám |
| `/doctor` | Có (`requireVerified`) | `DOCTOR` | Dashboard Bác sĩ |
| `/doctor/queue` | Có (`requireVerified`) | `DOCTOR` | Hàng chờ khám bệnh lâm sàng |
| `/lab-manager/orders` | Có (`requireVerified`) | `LAB_MANAGER` | Quản lý phiếu xét nghiệm |
| `/lab-manager/results` | Có (`requireVerified`) | `LAB_MANAGER` | Trả kết quả xét nghiệm |
| `/profile` | Có (`requireVerified`) | `ADMIN, RECEPTIONIST, DOCTOR, LAB_MANAGER` | Trang cá nhân |

---

## 4. Hướng Dẫn Rollback (Bật / Tắt Dev Bypass)

Khi cần **Rollback lại chế độ bảo mật gốc** cho Production:

1. **Trong file [AppRoutes.jsx](file:///d:/Personal%20Datas/KLTN/apps/hospital-web/src/routes/AppRoutes.jsx)**:
   Chuyển hằng số `DEV_BYPASS` về `false`:
   ```javascript
   const DEV_BYPASS = false; // Chuyển về false để bật lại toàn bộ Auth Guards
   ```

2. **Trong file [AuthProvider.jsx](file:///d:/Personal%20Datas/KLTN/apps/hospital-web/src/providers/AuthProvider.jsx)**:
   Chuyển hằng số `DEV_BYPASS` về `false`:
   ```javascript
   const DEV_BYPASS = false; // Chuyển về false để trả về luồng kiểm tra session gốc từ Backend
   ```
