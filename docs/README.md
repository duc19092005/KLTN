# Tài Liệu Hệ Thống Quản Lý Bệnh Viện KLTN (Hospital Management System)

Tài liệu dự án được sắp xếp tập trung theo ứng dụng và chuyên mục chức năng. Mã nguồn nằm trong thư mục `apps/`; cấu hình vận hành hạ tầng nằm trong `infrastructure/`.

---

## Danh Mục Ứng Dụng (Applications)

| Ứng dụng | Tài liệu hướng dẫn |
|---|---|
| **Hospital API** | [Hướng dẫn vận hành Backend](applications/hospital-api/README.md) · [Phân quyền Roles & Permissions](applications/hospital-api/roles-and-permissions.md) |
| **Hospital Web** | [Hướng dẫn ứng dụng Web](applications/hospital-web/README.md) |
| **Hospital Mobile** | [Hướng dẫn ứng dụng Mobile Bệnh nhân](applications/hospital-mobile/README.md) |
| **Audit Contracts** | [Hướng dẫn Smart Contracts Blockchain](applications/audit-contracts/README.md) |

---

## Danh Mục Chủ Đề (Topics)

| Nhóm tài liệu | Nội dung chi tiết |
|---|---|
| **[Architecture](architecture/)** | Kiến trúc Backend, cấu trúc tệp tin, quy tắc UI Frontend và thuật toán Audit Merkle Tree. |
| **[Domain](domain/)** | Biểu mẫu y tế, quy định pháp lý và quy trình use case nghiệp vụ bệnh viện. |
| **[Operations](operations/)** | Quy trình triển khai (Deployment), sao lưu khôi phục và Runbook kiểm toán vận hành. |
| **[Security](security/)** | Nhật ký kiểm toán (Audit Logging), phát hiện sai lệch (Tamper Evidence) và chính sách neo dữ liệu (Anchoring Policy). |
| **[Testing](testing/)** | Hướng dẫn kiểm thử tự động, khôi phục dữ liệu sai lệch và báo cáo kết quả kiểm thử. |
| **[Thesis](thesis/)** | Nội dung báo cáo khóa luận tốt nghiệp và hướng phát triển tương lai. |
| **[Agent guides](agents/)** | Quy tắc và nguyên tắc phát triển dành cho các AI Coding Agents. |
| **[Translations](translations/)** | Bản dịch và tóm tắt tổng quan bằng tiếng Anh (English) và tiếng Nga (Russian). |

---

## Điểm Truy Cập Nhanh (Quick Links)

- [Tài liệu chính dự án (README.md)](../README.md)
- [Tổng quan dự án tiếng Anh (English overview)](translations/README.en.md)
- [Tổng quan dự án tiếng Nga (Russian overview)](translations/README.ru.md)
- [Thuật toán kiểm toán Merkle (Audit Algorithm)](architecture/audit-algorithm.md)
- [ERD & từ điển dữ liệu PostgreSQL](erd/README.md)
- [Quy trình triển khai Production](operations/deployment.md)