# Tai lieu KLTN Hospital Management System

Tai lieu duoc tap trung theo trach nhiem. Source code nam trong `apps/`; cau hinh van hanh nam trong `infrastructure/`.

## Ung dung

| Ung dung | Tai lieu |
|---|---|
| Hospital API | [Huong dan](applications/hospital-api/README.md) · [Roles and permissions](applications/hospital-api/roles-and-permissions.md) |
| Hospital Web | [Huong dan](applications/hospital-web/README.md) |
| Hospital Mobile | [Huong dan](applications/hospital-mobile/README.md) |
| Audit Contracts | [Huong dan](applications/audit-contracts/README.md) |

## Chu de

| Nhom | Noi dung |
|---|---|
| [Architecture](architecture/) | Backend architecture, file structure, frontend rules va audit algorithm |
| [Domain](domain/) | Bieu mau, quy dinh va use case nghiep vu benh vien |
| [Operations](operations/) | Deployment, backup/restore va audit runbook |
| [Security](security/) | Audit logging, tamper evidence va anchoring policy |
| [Testing](testing/) | Unit/integration guide, tamper recovery va bao cao kiem thu |
| [Thesis](thesis/) | Noi dung khoa luan va huong phat trien |
| [Agent guides](agents/) | Quy tac danh cho coding agents |
| [Translations](translations/) | Ban dich va tom tat tieng Anh/Nga |

## Diem vao

- [README du an](../README.md)
- [English project overview](translations/README.en.md)
- [Russian project overview](translations/README.ru.md)
- [Audit algorithm](architecture/audit-algorithm.md)
- [Production deployment](operations/deployment.md)