# KLTN Hospital Management System

He thong quan ly benh vien full-stack voi NestJS, React, PostgreSQL, AI ho tro chan doan, xac thuc sinh trac hoc va blockchain audit trail.

Blockchain chi dung de neo hash/Merkle root phuc vu kiem chung toan ven. Tuyet doi khong dua PII, noi dung benh an, PDF, X-Ray, anh y te, S3 object key hay file len chain.

## Cau Truc Monorepo

```text
KLTN/
|-- apps/
|   |-- hospital-api/       NestJS + Prisma + PostgreSQL
|   |-- hospital-web/       React + Vite + Tailwind CSS
|   |-- hospital-mobile/    Expo React Native patient portal
|   `-- audit-contracts/    Solidity + Hardhat contracts
|-- infrastructure/
|   |-- compose/            Development, production and test stacks
|   |-- nginx/              Reverse proxy configuration
|   `-- scripts/            Deploy, backup, restore and test helpers
|-- docs/                   Central project documentation
|-- .env.example            Compose environment template
`-- README.md               Project entry point
```

## Environment Model
Root `.env` khong con la env tong de Docker Compose bom vao moi service.

- `apps/hospital-api/.env`: backend runtime, database, JWT, encryption, audit crypto, S3, Cloudinary avatar, backend blockchain RPC/contract/relayer runtime.
- `apps/hospital-web/.env`: public `VITE_*` config cho frontend.
- `apps/audit-contracts/.env`: deploy/governance config cho Hardhat scripts.

Setup co ban:

```bash
cp apps/hospital-api/.env.example apps/hospital-api/.env
cp apps/hospital-web/.env.example apps/hospital-web/.env
cd apps/audit-contracts
cp .env.example .env
```

Khong commit file `.env` that.

## Blockchain Flow

Co 3 vai tro tach biet:

| Vai tro | Nam o dau | Lam gi |
|---|---|---|
| Owner / root governance | `BLOCKCHAIN_OWNER_PRIVATE_KEY` trong `apps/audit-contracts/.env` cho deploy/governance; production nen la cold wallet/multisig | Authorize/revoke Admin wallets, add/remove relayers, transfer ownership |
| Relayer / backend writer | `BLOCKCHAIN_RELAYER_PRIVATE_KEY` trong `apps/hospital-api/.env` hoac secret manager backend | Ky giao dich tu dong: `AuditAnchor.commitRoot`, `FaceRegistry.setFaceHash`, `recordAction` |

Backend khong dung vi Admin de tra gas cho audit transaction. Admin ky challenge de chung minh danh tinh; backend relayer moi la vi gui giao dich van hanh len chain.

`IdentityRegistry` la nguon quyen trung tam:

```text
IdentityRegistry.owner()
|-- quan tri Admin wallets
|-- quan tri backend relayers
|-- transferOwnership

IdentityRegistry.isRelayerOrOwner(address)
|-- cho phep FaceRegistry ghi face hash
|-- cho phep AuditAnchor commit Merkle root
|-- cho phep recordAction
```

`FaceRegistry` va `AuditAnchor` khong giu danh sach relayer rieng. Khi rotate relayer chi can cap nhat `IdentityRegistry`.

## Neu Mat Key

| Su co | Hau qua | Xu ly |
|---|---|---|
| Mat `BLOCKCHAIN_RELAYER_PRIVATE_KEY` | Khong ghi audit root/face hash moi; log co the don `UNANCHORED`/failed | Owner goi `removeRelayer(old)` va `addRelayer(new)`, sau do backend doi relayer key |
| Relayer bi lo | Ke xau co the gui giao dich operational trong quyen relayer | Owner revoke relayer cu, add relayer moi, audit lai batch trong khoang nghi ngo |
| Mat Admin wallet | Admin do khong login/step-up/recovery duoc | Owner revoke vi cu, authorize vi moi |
| Mat Owner key don le | Governance ket; khong rotate relayer/admin duoc | Neu contract khong co recovery thi khong cuu duoc. Production phai dung multisig/cold wallet |

## Chay Blockchain Local

Terminal 1:

```bash
cd apps/audit-contracts
npm install
npm run node
```

Terminal 2:

```bash
cd apps/audit-contracts
npm run deploy:local
```

Sau khi deploy, copy dung phan script in ra vao tung file: `apps/audit-contracts/.env`, `apps/hospital-api/.env`, `apps/hospital-web/.env`.

Lenh huu ich:

```bash
cd apps/audit-contracts
npm run compile
npm test
npm run deploy:custom
npm run deploy:audit:local
```

## Chay Bang Docker Compose

Docker Compose khong chay blockchain container nua. Truoc khi `docker compose up`, hay chay Hardhat node o `apps/audit-contracts/` nhu phan tren.

```bash
docker compose -f infrastructure/compose/compose.yml up -d
```

Mac dinh:

```text
Backend:  http://localhost:3001/api
Frontend: http://localhost:5173
Postgres: localhost:5432
Hardhat:  http://localhost:8545
```

Trong compose, backend chi doc `apps/hospital-api/.env`; frontend chi doc `apps/hospital-web/.env`; compose khong doc `apps/audit-contracts/.env`.

## Luu Tru File Y Te

Medical result upload moi dung AWS S3 private bucket:

- PDF report, X-Ray/MRI/CT/Ultrasound image, ECG, lab attachments.
- AI image attachments: backend tai anh private tu S3, convert base64 va gui sang AI provider.

Staff/doctor avatar khong di qua S3 private. Avatar dung Cloudinary public/static URL de frontend render truc tiep.

PostgreSQL giu metadata/quyen truy cap (`storageProvider`, `bucket`, `objectKey`, `sha256`, `etag`). S3 chi giu blob. Blockchain chi anchor audit hash/Merkle root da sanitize.

Download file y te di qua:

```text
/api/medical-orders/results/files/:fileId/download
```

Backend kiem tra RBAC roi moi tra pre-signed URL ngan han. File Cloudinary medical cu khong migrate trong phase nay; neu DB con `url` legacy va URL con song thi endpoint van mo duoc.

## Patient Mobile

`apps/hospital-mobile/` contains the Expo React Native patient portal. Patients sign in with phone OTP or their first-login password, can resend OTP after a 60-second cooldown, choose linked profiles, and view their linked medical visit history transparently.

See [apps/hospital-mobile/README.md](docs/applications/hospital-mobile/README.md).

## Tai Lieu Lien Quan

- [AGENTS.md](./docs/agents/AGENTS.md)
- [apps/audit-contracts/README.md](docs/applications/audit-contracts/README.md)
- [docs/security/audit-logging.md](docs/security/audit-logging.md)
- [docs/security/tiers-and-anchoring.md](docs/security/tiers-and-anchoring.md)

## Quy Uoc Phat Trien

- Backend dung feature-based modules, DTO validation bang `class-validator`, business logic nam o service/use case.
- Multi-step workflow phai dung transaction.
- Entity quan trong phai ghi audit va anchor hash/root.
- Blockchain khong luu PII, file y te, noi dung chan doan hoac du lieu lon.
- `.env` khong duoc commit; cap nhat `.env.example` khi them bien moi.
