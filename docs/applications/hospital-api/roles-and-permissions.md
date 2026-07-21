# Cơ chế Role & Phân quyền (Backend) — Hướng dẫn cho AI Agents / IDE

> [!IMPORTANT]
> Tài liệu này phản ánh **cơ chế role hiện tại trong code** (`apps/hospital-api/prisma/schema.prisma` + các module NestJS),
> KHÔNG phải mô tả ban đầu trong `AGENTS.md`. Khi có mâu thuẫn, **file này + code là nguồn chuẩn**.
>
> **Điểm dễ nhầm nhất:** "Trưởng phòng ban" KHÔNG phải là một role. Đọc kỹ [Mục 2](#2-điểm-cốt-lõi-dễ-nhầm-trưởng-phòng-vs-nhân-viên).

---

## 1. Năm role trong hệ thống

Enum `UserRole` tại [schema.prisma](../../../apps/hospital-api/prisma/schema.prisma) (dòng 10-16):

```prisma
enum UserRole {
  ADMIN
  RECEPTIONIST
  DOCTOR
  LAB_MANAGER
  DEPT_SHARED
}
```

| Role | Ý nghĩa | Ghi chú |
|------|---------|---------|
| `ADMIN` | Quản trị viên hệ thống | Toàn quyền, không bị ràng buộc phòng ban |
| `RECEPTIONIST` | Lễ tân | Tiếp nhận bệnh nhân, quản lý hàng đợi |
| `DOCTOR` | Bác sĩ | Khám, chỉ định cận lâm sàng, kết luận |
| `LAB_MANAGER` | Kỹ thuật viên cận lâm sàng (xét nghiệm/CĐHA/dược) | Tài khoản cá nhân thực hiện & trả kết quả |
| `DEPT_SHARED` | **Tài khoản dùng chung của phòng ban** | KHÔNG phải người thật — xem [Mục 4](#4-tài-khoản-dept_shared-dùng-chung) |

> [!WARNING]
> `AGENTS.md` cũ chỉ liệt kê 4 role (thiếu `DEPT_SHARED`). Code hiện tại có **5 role**. Hãy dùng danh sách ở trên.

---

## 2. ĐIỂM CỐT LÕI DỄ NHẦM: Trưởng phòng vs Nhân viên

> [!CAUTION]
> **KHÔNG tồn tại role `MANAGER` / `DEPT_HEAD` / "trưởng phòng".**
> `UserRole` chỉ mô tả **chức năng nghề nghiệp** (lễ tân, bác sĩ, kỹ thuật viên...), KHÔNG mô tả chức vụ quản lý.

Việc một người **có phải trưởng phòng ban hay không** là một **QUAN HỆ (relation)**, không phải role:

```text
Department.managerId  ──► StaffProfile.id        (ai là trưởng phòng ban này)
StaffProfile.managedDepartment ◄── (quan hệ ngược: phòng ban mà người này làm trưởng)
StaffProfile.departmentId ──► Department.id      (người này là NHÂN VIÊN của phòng ban nào)
```

### Cách phân biệt trong code

| Câu hỏi | Cách kiểm tra | Trả về |
|---------|---------------|--------|
| User là **trưởng** phòng ban? | `StaffProfile.managedDepartment != null` **hoặc** `Department.manager.user.id === userId` | boolean |
| User là **nhân viên** phòng ban? | `StaffProfile.departmentId != null` | boolean |
| User là trưởng phòng ban X? | `department.manager?.user.id === userId` (với department X) | boolean |

### Tại sao agent khác hay nhầm

Một **trưởng phòng** và một **nhân viên thường** có thể có **CÙNG một role**.
Ví dụ: trong một khoa lâm sàng, cả trưởng khoa lẫn nhân viên đều là `DOCTOR`.
Sự khác biệt duy nhất là trưởng khoa được trỏ tới bởi `Department.managerId`.

```text
❌ SAI:  "user.role === 'DOCTOR' nên đây là bác sĩ thường"
✅ ĐÚNG: "user.role === 'DOCTOR' VÀ department.managerId === user.staffProfile.id → đây là TRƯỞNG KHOA"
```

### Ràng buộc role ↔ chức trưởng phòng

Khi gán trưởng phòng ([assign-manager.use-case.ts](../../../apps/hospital-api/src/modules/department/application/use-cases/assign-manager.use-case.ts) và [create-department.use-case.ts](../../../apps/hospital-api/src/modules/department/application/use-cases/create-department.use-case.ts)), role của trưởng phải khớp loại phòng ban:

| Loại phòng ban (`DepartmentType`) | Role bắt buộc của trưởng phòng |
|-----------------------------------|-------------------------------|
| `ADMINISTRATIVE` | `RECEPTIONIST` |
| `CLINICAL` | `DOCTOR` |
| `LABORATORY` | `LAB_MANAGER` |
| `IMAGING` | `LAB_MANAGER` |
| `PHARMACY` | `LAB_MANAGER` |

Trưởng phòng còn phải thuộc chính phòng ban đó (hoặc chưa được gán phòng nào): nếu `staff.departmentId` đã set và khác phòng ban → báo lỗi.

---

## 3. Hai tầng phân quyền

Hệ thống dùng **2 tầng** kết hợp. Đừng chỉ dựa vào tầng 1.

### Tầng 1 — Coarse-grained: `@Roles()` + `RolesGuard`

Kiểm tra thô theo `user.role`. Logic cực kỳ đơn giản ([roles.guard.ts](../../../apps/hospital-api/src/modules/auth/guards/roles.guard.ts)):

```ts
return Boolean(user?.role && requiredRoles.includes(user.role));
```

Khai báo trên controller/handler ([roles.decorator.ts](../../../apps/hospital-api/src/common/decorators/roles.decorator.ts)):

```ts
@UseGuards(JwtAuthGuard, RolesGuard, FaceStepUpGuard)
@Roles('ADMIN')                               // chỉ ADMIN
@Roles('ADMIN', 'DOCTOR', 'LAB_MANAGER')      // bất kỳ role nào trong danh sách
```

> [!NOTE]
> `RolesGuard` **KHÔNG biết** ai là trưởng phòng. Nó chỉ so khớp chuỗi role. Vì vậy không thể dùng `@Roles()` để giới hạn "chỉ trưởng phòng".

### Tầng 2 — Fine-grained: kiểm tra quyền sở hữu/quản lý trong use-case

Quyền "chỉ trưởng phòng ban mới được làm" được kiểm tra **bên trong use-case**, truy DB qua quan hệ `manager`. Ví dụ duyệt ca trực (`approve-reception-shift.use-case.ts`, `approve-shift.use-case.ts`):

```ts
private async assertCanApprove(actorUserId: string, actorRole: string, departmentId: string) {
  if (actorRole === 'ADMIN') return;                 // ADMIN bỏ qua mọi ràng buộc
  const department = await this.prisma.department.findUnique({
    where: { id: departmentId },
    include: { manager: { include: { user: true } } },
  });
  // CHỈ trưởng phòng ban đó mới được duyệt
  if (!department?.manager || department.manager.user.id !== actorUserId) {
    throw new ForbiddenException('Bạn không có quyền duyệt ca trực này.');
  }
}
```

Các use-case lọc dữ liệu theo phòng ban đang quản lý dùng `StaffProfile.managedDepartment` (xem `list-pending-shifts.use-case.ts`).

---

## 4. Tài khoản `DEPT_SHARED` (dùng chung)

> [!NOTE]
> `DEPT_SHARED` là **tài khoản máy trạm dùng chung của phòng ban**, không gắn với một con người cụ thể. Dùng cho khu vực cận lâm sàng nơi nhiều kỹ thuật viên luân phiên trực chung một máy.

- **Tự động tạo** khi tạo phòng ban ([create-department.use-case.ts](../../../apps/hospital-api/src/modules/department/application/use-cases/create-department.use-case.ts)).
- **Username** suy ra từ mã phòng ban: `PB-XRAY` → `dept_xray`; email `dept_xray@hospital.local`.
- **Mật khẩu mặc định** `123456`, `firstLogin = true`.
- Liên kết qua `Department.sharedUserId` (quan hệ `DeptSharedUser`).

### Luồng đăng nhập 2 pha của DEPT_SHARED

1. **Pha 1 — mật khẩu** (`paraclinical-login.use-case.ts`): xác thực username/password của tài khoản chung → cấp **tempToken** giới hạn (chỉ cho phép bước quét mặt, KHÔNG có quyền sâu).
2. **Pha 2 — quét mặt** (`verify-shift-face.use-case.ts`): khuôn mặt xác định **con người thật** đang trực ca, gắn danh tính cá nhân vào phiên làm việc.

> [!WARNING]
> `LAB_MANAGER` (kể cả trưởng khoa) **đăng nhập qua `/auth/login` chuẩn**, KHÔNG dùng luồng tài khoản chung. Luồng `paraclinical-login` chỉ chấp nhận `role === 'DEPT_SHARED'`, các role khác bị từ chối.

---

## 5. Ràng buộc role ↔ loại phòng ban (gán nhân viên)

Khi xếp một nhân viên vào phòng ban ([staff.validator.ts](../../../apps/hospital-api/src/modules/staff/application/services/staff.validator.ts) `assertDepartmentRoleCompatible`):

| Role | Loại phòng ban được phép |
|------|--------------------------|
| `RECEPTIONIST` | `ADMINISTRATIVE` |
| `DOCTOR` | `CLINICAL` |
| `LAB_MANAGER` | `LABORATORY`, `IMAGING`, `PHARMACY` |
| `DEPT_SHARED` | `CLINICAL`, `LABORATORY`, `IMAGING`, `PHARMACY` |
| `ADMIN` | (không ràng buộc) |

---

## 6. Danh tính trong JWT (`req.user` / `AuthUser`)

Payload gắn vào `req.user` bởi [jwt.strategy.ts](../../../apps/hospital-api/src/modules/auth/strategies/jwt.strategy.ts), kiểu [auth-user.type.ts](../../../apps/hospital-api/src/common/types/auth-user.type.ts):

```ts
type AuthUser = {
  sub: string;              // userId
  role: UserRole | string;  // CHỈ có role, KHÔNG có thông tin trưởng phòng
  username?: string;
  verified?: boolean;
  walletAddress?: string;
  firstLogin?: boolean;
  tokenVersion?: number;
};
```

> [!CAUTION]
> JWT **KHÔNG chứa** thông tin user có phải trưởng phòng ban hay thuộc phòng ban nào.
> Muốn biết → phải **truy DB** qua `StaffProfile.managedDepartment` (trưởng) hoặc `StaffProfile.departmentId` (nhân viên).
> Đừng cố suy ra chức vụ quản lý chỉ từ `req.user.role`.

---

## 7. Checklist nhanh cho agent khi đụng tới phân quyền

- [ ] Cần giới hạn theo **chức năng nghề nghiệp**? → dùng `@Roles(...)` + `RolesGuard`.
- [ ] Cần giới hạn **chỉ trưởng phòng ban**? → kiểm tra `department.manager.user.id === actorUserId` trong use-case (xem mẫu `assertCanApprove`). KHÔNG có role nào làm việc này.
- [ ] Cần biết user thuộc/đứng đầu phòng ban nào? → query `StaffProfile` (`departmentId`, `managedDepartment`), KHÔNG đọc từ JWT.
- [ ] Đang xử lý đăng nhập máy trạm cận lâm sàng? → đó là `DEPT_SHARED`, luồng 2 pha (password → face). `LAB_MANAGER` không đi luồng này.
- [ ] Gán nhân viên/trưởng phòng vào phòng ban? → kiểm tra ràng buộc role ↔ `DepartmentType` ở Mục 2 & 5.
- [ ] `ADMIN` luôn được bỏ qua các kiểm tra fine-grained (thường là nhánh `if (actorRole === 'ADMIN') return;`).
