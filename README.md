# KLTN Hospital Management System

He thong quan ly benh vien full-stack voi NestJS, React, PostgreSQL, AI ho tro chan doan, xac thuc sinh trac hoc va blockchain audit trail.

Blockchain chi dung de neo hash/Merkle root phuc vu kiem chung toan ven. Tuyet doi khong dua PII, noi dung benh an, PDF, X-Ray, anh y te, S3 object key hay file len chain.

## Cau Truc Monorepo

```text
KLTN/
|-- backend/      NestJS + Prisma + PostgreSQL
|-- frontend/     React + Vite + Tailwind CSS
|-- mobile/       Expo React Native NFC demo apps
|-- blockchain/   Solidity + Hardhat + Ethers.js
|-- docs/         Tai lieu kien truc, audit, backup/recovery
|-- tools/        Cong cu khoi phuc/khan cap offline
|-- .env.example  Legacy/reference env checklist
```

## Environment Model

Root `.env` khong con la env tong de Docker Compose bom vao moi service.

- `backend/.env`: backend runtime, database, JWT, encryption, audit crypto, S3, Cloudinary avatar, backend blockchain RPC/contract/relayer runtime.
- `frontend/.env`: public `VITE_*` config cho frontend.
- `blockchain/.env`: deploy/governance config cho Hardhat scripts.

Setup co ban:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cd blockchain
cp .env.example .env
```

Khong commit file `.env` that.

## Blockchain Flow

Co 3 vai tro tach biet:

| Vai tro | Nam o dau | Lam gi |
|---|---|---|
| Owner / root governance | `BLOCKCHAIN_OWNER_PRIVATE_KEY` trong `blockchain/.env` cho deploy/governance; production nen la cold wallet/multisig | Authorize/revoke Admin wallets, add/remove relayers, transfer ownership |
| Relayer / backend writer | `BLOCKCHAIN_RELAYER_PRIVATE_KEY` trong `backend/.env` hoac secret manager backend | Ky giao dich tu dong: `AuditAnchor.commitRoot`, `FaceRegistry.setFaceHash`, `recordAction` |
| Admin wallet | Vi nguoi dung nhu MetaMask/hardware wallet | Login, step-up, emergency restore challenge |

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
cd blockchain
npm install
npm run node
```

Terminal 2:

```bash
cd blockchain
npm run deploy:local
```

Sau khi deploy, copy dung phan script in ra vao tung file: `blockchain/.env`, `backend/.env`, `frontend/.env`.

Lenh huu ich:

```bash
cd blockchain
npm run compile
npm test
npm run deploy:custom
npm run deploy:audit:local
```

## Chay Bang Docker Compose

Docker Compose khong chay blockchain container nua. Truoc khi `docker compose up`, hay chay Hardhat node o `blockchain/` nhu phan tren.

```bash
docker compose up -d
```

Mac dinh:

```text
Backend:  http://localhost:3001/api
Frontend: http://localhost:5173
Postgres: localhost:5432
Hardhat:  http://localhost:8545
```

Trong compose, backend chi doc `backend/.env`; frontend chi doc `frontend/.env`; compose khong doc `blockchain/.env`.

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

## NFC Mobile

`mobile/` la noi setup NFC mobile, build APK va mo ta payload card.

- Receptionist scanner: pair voi web intake qua NFC session va SSE.
- Patient portal: scan NFC CCCD card, sau do dung lai backend patient verification.

Xem [mobile/README.md](./mobile/README.md).

## Tai Lieu Lien Quan

- [AGENTS.md](./AGENTS.md)
- [blockchain/README.md](./blockchain/README.md)
- [docs/security/audit-logging.md](./docs/security/audit-logging.md)
- [docs/security/tiers-and-anchoring.md](./docs/security/tiers-and-anchoring.md)
- [docs/backup-recovery/overview.md](./docs/backup-recovery/overview.md)
- [tools/recovery-signer/README.md](./tools/recovery-signer/README.md)

## Quy Uoc Phat Trien

- Backend dung feature-based modules, DTO validation bang `class-validator`, business logic nam o service/use case.
- Multi-step workflow phai dung transaction.
- Entity quan trong phai ghi audit va anchor hash/root.
- Blockchain khong luu PII, file y te, noi dung chan doan hoac du lieu lon.
- `.env` khong duoc commit; cap nhat `.env.example` khi them bien moi.
