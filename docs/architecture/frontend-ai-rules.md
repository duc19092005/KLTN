# AI Development Rules for Hospital OS

> File này là quy tắc bắt buộc cho AI/coding assistant khi tạo hoặc sửa code trong project.
> Nếu yêu cầu mới mâu thuẫn với file này, phải hỏi lại người dùng trước khi làm.

## 1. Frontend Architecture

Frontend phải tuân theo cấu trúc feature-based:

```text
src/
├── features/
│   ├── admin/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── apis/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── constants/
│   │   ├── types/
│   │   ├── validations/
│   │   ├── utils/
│   │   └── index.js
│   ├── auth/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── apis/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── constants/
│   │   ├── types/
│   │   ├── validations/
│   │   ├── utils/
│   │   └── index.js
│   └── doctor/
│       ├── pages/
│       ├── components/
│       ├── apis/
│       ├── hooks/
│       ├── stores/
│       ├── constants/
│       ├── types/
│       ├── validations/
│       ├── utils/
│       └── index.js
├── shared/
├── providers/
├── routes/
└── main.jsx
```

### Frontend placement rules

- Không tạo page mới trong `src/pages/`.
- Không tạo API service mới trong `src/services/`.
- Không tạo component dùng chung mới trong `src/components/`.
- Page của feature nào phải nằm trong `src/features/<feature>/pages/`.
- Component chỉ dùng trong một feature phải nằm trong `src/features/<feature>/components/`.
- API của feature phải nằm trong `src/features/<feature>/apis/`.
- Component dùng chung toàn app phải nằm trong `src/shared/components/`.
- API client dùng chung phải nằm trong `src/shared/apis/`.
- Provider global phải nằm trong `src/providers/`.
- Routing tổng phải nằm trong `src/routes/`.
- Feature phải export public API qua `src/features/<feature>/index.js`.

## 2. Current implemented features

Hiện tại chỉ có các feature nghiệp vụ sau:

- `auth`
- `admin`
- `doctor` chỉ là folder chuẩn bị cấu trúc, chưa implement nghiệp vụ.

Không được tự ý implement Doctor workflow nếu người dùng chưa yêu cầu.
Không được tạo `DoctorProfile`, doctor dashboard, doctor API khi chưa có yêu cầu rõ ràng.

## 3. Staff and Department rules

### Backend domain rules

- `Department` có nhiều `StaffProfile`.
- `StaffProfile` là hồ sơ nhân sự chung.
- `StaffProfile` thuộc tối đa một `Department` tại một thời điểm.
- `Department` có tối đa một manager/phụ trách.
- `AdminProfile` phải được giữ riêng cho admin authentication.
- Không gộp `AdminProfile` vào `StaffProfile`.
- Staff thường không cần ví.
- Ví, face embedding, nonce, MFA secret của admin nằm trong `AdminProfile`.

### Role rules

- FE không được cho người dùng chọn role khi tạo nhân sự thường.
- Tính năng tạo nhân sự phải được hiểu là: **tạo nhân sự cho phòng ban**.
- Backend tự suy luận `User.role` dựa trên phòng ban/chức danh/nghiệp vụ.
- `User.role` dùng cho phân quyền hệ thống, không phải phòng ban.
- `StaffProfile.department` dùng để xác định nhân sự thuộc phòng ban nào.

## 4. UI/UX rules

- UI phải theo phong cách Hospital OS / Clinical Blue.
- Ưu tiên layout rõ workflow, dễ dùng cho MVP.
- Các module lớn nên có route/page riêng, không nhồi tất cả vào một tab nếu nghiệp vụ lớn.
- Department page và Staff page phải là route riêng.
- Không dùng loading tự chế.
- Mọi loading state phải dùng:

```js
src/shared/components/LoadingIndicator.jsx
```

- Không dùng placeholder giả nếu có thể hiển thị dữ liệu thật.
- Không tạo UI tối giản sơ sài; phải có hierarchy rõ, card/table/form dễ quét.

## 5. Routing rules

Routes tổng nằm trong:

```text
src/routes/AppRoutes.jsx
```

Các route admin hiện tại:

```text
/admin
/admin/departments
/admin/staff
```

Không thêm route mới nếu chưa có page/feature tương ứng.

## 6. Import rules

Ưu tiên import qua feature index:

```js
import { AdminPage } from '../features/admin';
import { LoginPage } from '../features/auth';
```

Không import ngược từ feature này sang internals của feature khác, trừ khi qua `index.js` hoặc qua `shared`.

Ví dụ không nên:

```js
import Something from '../features/auth/components/Something';
```

Nếu component cần dùng nhiều feature, chuyển nó sang `shared/components`.

## 7. Validation before finishing

Sau khi sửa frontend, phải chạy:

```bash
npm run build
```

trong thư mục `frontend` nếu thay đổi có thể ảnh hưởng build.

Sau khi sửa backend, phải chạy:

```bash
npm run build
```

trong thư mục `backend` nếu thay đổi TypeScript/schema/API.

## 8. Communication rules

- Nếu yêu cầu chưa rõ, hỏi lại trước khi tự thiết kế rộng.
- Không tự thêm feature nghiệp vụ chưa được yêu cầu.
- Không tự thay đổi mô hình dữ liệu quan trọng như `AdminProfile`, `StaffProfile`, `Department` mà không giải thích.
- Khi refactor cấu trúc, phải cập nhật import và build kiểm tra.
