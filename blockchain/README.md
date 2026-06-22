# KLTN Blockchain Deployment Guide

Smart contracts cho audit trail va integrity verification cua KLTN Hospital Management System.

Blockchain trong project nay chi dung de neo hash, Merkle root, timestamp va metadata ky thuat. Khong bao gio dua PII, thong tin benh an, PDF, X-Ray, anh y te, S3 object key, raw file hay noi dung chan doan len chain.

## Contract Set

| Contract | Vai tro | Ai duoc ghi |
|---|---|---|
| `IdentityRegistry` | Root governance: quan ly Admin wallets va backend relayers | `owner` |
| `FaceRegistry` | Luu face hash integrity marker | `IdentityRegistry.owner()` hoac relayer da duoc authorize |
| `AuditAnchor` | Neo Merkle root cua audit batch | `IdentityRegistry.owner()` hoac relayer da duoc authorize |

`FaceRegistry` va `AuditAnchor` khong giu danh sach relayer rieng. Hai contract nay hoi quyen tu `IdentityRegistry`, nen rotate relayer/admin chi can thao tac tai mot noi.

## Key Model

| Key | Dung de lam gi | Local dev | Production |
|---|---|---|---|
| `PRIVATE_KEY` | Deployer key cho Hardhat `custom` network | Co the la Hardhat account #0 | Chi dung tren may deploy/CI secret, khong dua vao backend |
| `BLOCKCHAIN_OWNER_PRIVATE_KEY` | Root governance key: add/remove relayer, authorize/revoke Admin wallet, transfer ownership | Co the de trong `blockchain/.env` cho nhanh | Khong nen nam tren backend; nen la cold wallet/multisig |
| `BLOCKCHAIN_RELAYER_PRIVATE_KEY` | Hot wallet backend dung de ghi `commitRoot`, `setFaceHash`, `recordAction` | Co the de trong `blockchain/.env` | Nam trong secret manager/backend runtime; phai rotate/revoke duoc |
| Admin wallet | Human wallet de login, step-up, emergency restore | MetaMask/dev wallet | Hardware wallet hoac wallet quan tri duoc governance authorize |

Thuc te van hanh:

- Admin wallet khong tra gas cho audit transaction hang ngay.
- Backend relayer moi la signer cho cac giao dich operational.
- Owner chi nen dung khi governance thay doi: them/xoa relayer, them/xoa Admin wallet, transfer ownership.

## Environment Files

Project da tach env thanh 2 phan:

```text
KLTN/.env              # app/backend/frontend/database/S3/Cloudinary
KLTN/blockchain/.env   # blockchain RPC, contract addresses, owner/relayer keys
```

Root `.env` khong con chua blockchain address/key.

Tao env blockchain:

```bash
cd blockchain
cp .env.example .env
```

Bien quan trong trong `blockchain/.env`:

```env
# Hardhat deploy target
NETWORK_RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=0x...

# Backend runtime
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
IDENTITY_REGISTRY_ADDRESS=0x...
FACE_REGISTRY_ADDRESS=0x...
AUDIT_ANCHOR_ADDRESS=0x...

# Governance / relayer
BLOCKCHAIN_OWNER_ADDRESS=0x...
BLOCKCHAIN_OWNER_PRIVATE_KEY=0x...
BLOCKCHAIN_RELAYER_ADDRESS=0x...
BLOCKCHAIN_RELAYER_PRIVATE_KEY=0x...

# Frontend wallet config
VITE_IDENTITY_REGISTRY_ADDRESS=0x...
VITE_NETWORK_RPC_URL=http://localhost:8545
VITE_CHAIN_ID=31337
```

## Case 1: Deploy Local Development

Dung case nay khi chay do an tren may local voi Hardhat node mien phi gas.

### Local Architecture

```text
Browser / Frontend
  |-- http://localhost:5173
Backend
  |-- native run: http://127.0.0.1:8545
  |-- Docker run: http://host.docker.internal:8545
Hardhat node
  |-- runs from KLTN/blockchain
PostgreSQL
  |-- Docker service db
```

`docker-compose.yml` khong chay blockchain container nua. Blockchain node phai duoc chay rieng tu thu muc `blockchain/`.

### 1. Install

```bash
cd blockchain
npm install
cp .env.example .env
```

### 2. Start Local Hardhat Node

Mo terminal 1:

```bash
cd blockchain
npm run node
```

Lenh nay bind Hardhat node ra `0.0.0.0:8545`, giup backend Docker co the goi qua `host.docker.internal:8545`.

### 3. Deploy Contracts

Mo terminal 2:

```bash
cd blockchain
npm run compile
npm test
npm run deploy:local
```

Script `deploy:local` se:

1. Deploy `IdentityRegistry`.
2. Deploy `FaceRegistry` voi dia chi `IdentityRegistry`.
3. Deploy `AuditAnchor` voi dia chi `IdentityRegistry`.
4. Add backend relayer tu `BLOCKCHAIN_RELAYER_ADDRESS` hoac relayer private key.
5. Transfer ownership sang `BLOCKCHAIN_OWNER_ADDRESS` neu owner khac deployer.
6. In ra cac bien can copy lai vao `blockchain/.env`.

Sau deploy, copy output dang nay vao `blockchain/.env`:

```env
NETWORK_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
IDENTITY_REGISTRY_ADDRESS=0x...
FACE_REGISTRY_ADDRESS=0x...
AUDIT_ANCHOR_ADDRESS=0x...
BLOCKCHAIN_OWNER_ADDRESS=0x...
BLOCKCHAIN_RELAYER_ADDRESS=0x...
VITE_IDENTITY_REGISTRY_ADDRESS=0x...
VITE_NETWORK_RPC_URL=http://localhost:8545
VITE_CHAIN_ID=31337
```

Luu y: Hardhat local chain mat state khi terminal node bi tat/reset. Neu reset node, phai deploy lai va cap nhat address moi trong `blockchain/.env`.

### 4. Run App With Docker Compose

Tu root repo:

```bash
docker compose up -d
```

Compose se chay:

```text
db
backend
frontend
```

Compose khong chay blockchain. Backend container doc `./blockchain/.env`, nhung override runtime RPC thanh:

```env
BLOCKCHAIN_RPC_URL=http://host.docker.internal:8545
```

Neu frontend can build voi address moi tu `blockchain/.env`, dung:

```bash
docker compose --env-file blockchain/.env up -d --build
```

### 5. Run App Natively

Neu khong dung Docker cho backend/frontend:

```bash
# terminal 1
cd blockchain
npm run node

# terminal 2
cd blockchain
npm run deploy:local

# terminal 3
cd backend
npm install
npm run start:dev

# terminal 4
cd frontend
npm install
npm run dev
```

Backend native tu dong load ca root `.env` va `blockchain/.env`.

### 6. Local Verification

Chay nhanh:

```bash
cd blockchain
npm test
npm run compile
```

Kiem tra app:

- Backend khong log warning `IDENTITY_REGISTRY_ADDRESS not set`.
- Backend khong log warning `AUDIT_ANCHOR_ADDRESS not set`.
- Backend khong log warning `BLOCKCHAIN_RELAYER_PRIVATE_KEY not set`.
- Admin login wallet/step-up con verify duoc voi `IdentityRegistry`.
- Tao audit event hoac bam anchor manual de thay transaction vao Hardhat node.
- `AuditBatch` chuyen sang `ANCHORED` khi commit thanh cong.

## Case 2: Deploy Production / Real Network

Dung case nay khi deploy len testnet, private EVM chain, L2, hoac production network that.

Khuyen nghi production cua project nay:

- Dung L2/testnet/private EVM thay vi Ethereum mainnet neu chi can audit anchor.
- Owner nen la multisig/cold wallet, khong phai private key nam tren backend.
- Backend chi giu relayer hot key va relayer phai revoke/rotate duoc.
- RPC phai on dinh: dedicated RPC provider, private RPC, hoac self-hosted node.
- Secret production nam trong secret manager, khong commit `.env`.

### Production Architecture

```text
Admin wallet / multisig
  |-- governance only

Backend
  |-- reads BLOCKCHAIN_RELAYER_PRIVATE_KEY from secret manager
  |-- sends AuditAnchor.commitRoot() / FaceRegistry.setFaceHash()

RPC Provider / Node
  |-- NETWORK_RPC_URL / BLOCKCHAIN_RPC_URL

Contracts
  |-- IdentityRegistry
  |-- FaceRegistry
  |-- AuditAnchor
```

### 1. Choose Network

Chon mot trong cac loai network:

| Network type | Khi nao dung | Ghi chu |
|---|---|---|
| Hardhat local | Dev/demo | Mat state khi reset |
| Testnet Sepolia/Holesky | Staging/demo public | Can faucet ETH |
| L2 Base/Arbitrum/Polygon | Production chi phi thap | Phu hop audit batch |
| Private EVM | Noi bo benh vien/doanh nghiep | Can tu van hanh node/RPC |
| Ethereum mainnet | Can public settlement cao nhat | Dat, khong can thiet cho da so audit batch |

Can xac dinh:

- RPC URL.
- Chain ID.
- Deployer wallet co native gas token.
- Owner address sau deploy.
- Backend relayer address sau deploy.

### 2. Prepare Production Wallets

Toi thieu can 3 wallet/role:

```text
DEPLOYER
  - chi dung de deploy contract
  - co gas token
  - co the trung owner luc dau, nhung nen chuyen ownership sau deploy

OWNER
  - governance key
  - production nen la multisig/cold wallet
  - co quyen add/remove relayer va authorize/revoke Admin wallet

RELAYER
  - backend hot wallet
  - co gas token de gui operational tx
  - bi lo/mat thi owner revoke va add relayer moi
```

Khong nen:

- Dung Admin wallet lam backend relayer.
- De owner private key tren backend production.
- Dung cung mot key cho owner va relayer o production.

### 3. Prepare `blockchain/.env`

Production deploy example:

```env
# RPC deploy target
NETWORK_RPC_URL=https://your-rpc-provider.example

# Deployer private key. Dung o may deploy/CI secret, khong dua vao backend.
PRIVATE_KEY=0xDEPLOYER_PRIVATE_KEY

# Backend runtime RPC
BLOCKCHAIN_RPC_URL=https://your-rpc-provider.example

# Governance
BLOCKCHAIN_OWNER_ADDRESS=0xMULTISIG_OR_COLD_WALLET

# Backend relayer
BLOCKCHAIN_RELAYER_ADDRESS=0xBACKEND_RELAYER_ADDRESS

# Optional: chi dung neu owner can auto accept ownership va key co san tren may deploy.
# Production thuong khong nen de dong nay tren backend.
# BLOCKCHAIN_OWNER_PRIVATE_KEY=0xOWNER_PRIVATE_KEY

# Backend runtime secret, inject vao backend host/secret manager.
BLOCKCHAIN_RELAYER_PRIVATE_KEY=0xBACKEND_RELAYER_PRIVATE_KEY

# Frontend wallet config
VITE_NETWORK_RPC_URL=https://your-rpc-provider.example
VITE_CHAIN_ID=<chain-id>
```

Truoc deploy, cac address contract co the de trong hoac de gia tri cu; sau deploy phai cap nhat:

```env
IDENTITY_REGISTRY_ADDRESS=0x...
FACE_REGISTRY_ADDRESS=0x...
AUDIT_ANCHOR_ADDRESS=0x...
VITE_IDENTITY_REGISTRY_ADDRESS=0x...
```

### 4. Compile And Test

```bash
cd blockchain
npm install
npm run compile
npm test
```

Khong deploy production neu test contract fail.

### 5. Deploy To Production Network

```bash
cd blockchain
npm run deploy:custom
```

Hardhat `custom` network lay:

- RPC tu `NETWORK_RPC_URL`.
- Deployer key tu `PRIVATE_KEY`.
- Neu `PRIVATE_KEY` thieu, fallback sang `BLOCKCHAIN_OWNER_PRIVATE_KEY`, roi fallback Hardhat dev key. Production phai dat `PRIVATE_KEY` ro rang de tranh deploy sai signer.

Sau deploy, script in output. Copy cac dong nay vao `blockchain/.env` hoac secret manager/config production:

```env
NETWORK_RPC_URL=https://...
BLOCKCHAIN_RPC_URL=https://...
IDENTITY_REGISTRY_ADDRESS=0x...
FACE_REGISTRY_ADDRESS=0x...
AUDIT_ANCHOR_ADDRESS=0x...
BLOCKCHAIN_OWNER_ADDRESS=0x...
BLOCKCHAIN_RELAYER_ADDRESS=0x...
VITE_IDENTITY_REGISTRY_ADDRESS=0x...
VITE_NETWORK_RPC_URL=https://...
VITE_CHAIN_ID=<chain-id>
```

### 6. Accept Ownership If Needed

Neu `BLOCKCHAIN_OWNER_ADDRESS` khac deployer, script se goi `transferOwnership(owner)`.

Co 2 truong hop:

1. Owner key co trong env va match `BLOCKCHAIN_OWNER_ADDRESS`: script tu goi `acceptOwnership()`.
2. Owner la multisig/cold wallet: ownership dang pending, owner phai tu goi `acceptOwnership()` tren `IdentityRegistry`.

Production nen dung truong hop 2.

Can verify:

```text
IdentityRegistry.owner() == BLOCKCHAIN_OWNER_ADDRESS
IdentityRegistry.pendingOwner() == 0x0000000000000000000000000000000000000000
IdentityRegistry.isRelayer(BLOCKCHAIN_RELAYER_ADDRESS) == true
```

Neu owner chua accept, governance chua hoan tat. Khong coi deploy la xong.

### 7. Fund The Relayer

Backend relayer can native token de tra gas.

Checklist:

- Relayer address co du gas.
- RPC URL dung network voi contract.
- Backend secret manager co `BLOCKCHAIN_RELAYER_PRIVATE_KEY`.
- Backend runtime co `AUDIT_ANCHOR_ADDRESS`, `FACE_REGISTRY_ADDRESS`, `IDENTITY_REGISTRY_ADDRESS`.

Neu relayer het gas, app van ghi DB/audit off-chain nhung giao dich anchor se fail/don hang doi.

### 8. Deploy Backend And Frontend

Backend production env can co:

```env
BLOCKCHAIN_RPC_URL=https://your-rpc-provider.example
IDENTITY_REGISTRY_ADDRESS=0x...
FACE_REGISTRY_ADDRESS=0x...
AUDIT_ANCHOR_ADDRESS=0x...
BLOCKCHAIN_RELAYER_PRIVATE_KEY=0x...
```

Owner key khong nen nam trong backend production.

Frontend build/runtime env can co:

```env
VITE_IDENTITY_REGISTRY_ADDRESS=0x...
VITE_NETWORK_RPC_URL=https://your-rpc-provider.example
VITE_CHAIN_ID=<chain-id>
```

### 9. Production Verification

Sau khi backend/frontend len production:

1. Check backend startup logs:
   - Khong warning thieu `IDENTITY_REGISTRY_ADDRESS`.
   - Khong warning thieu `FACE_REGISTRY_ADDRESS`.
   - Khong warning thieu `AUDIT_ANCHOR_ADDRESS`.
   - Khong warning thieu `BLOCKCHAIN_RELAYER_PRIVATE_KEY`.
2. Verify contract owner:
   - `IdentityRegistry.owner()` la owner/multisig.
3. Verify relayer:
   - `IdentityRegistry.isRelayerOrOwner(relayer)` tra true.
4. Tao mot audit event khong chua PII trong staging/controlled flow.
5. Trigger anchor batch.
6. Verify transaction thanh cong tren explorer/RPC.
7. Verify DB:
   - `AuditBatch.status = ANCHORED`.
   - `BlockchainLogger` co `txHash`, `blockNumber`, `batchId`.
8. Verify frontend wallet flow:
   - Admin wallet duoc authorize.
   - Login/step-up recover dung address.

### 10. Production Rollback

Neu backend deploy loi:

- Rollback backend image/code.
- Khong sua truc tiep `BlockchainLogger` hoac `AuditBatch`.
- Giu contract address neu contract deploy dung.

Neu deploy sai contract/network:

1. Stop audit anchoring jobs/backend workers.
2. Sua `BLOCKCHAIN_RPC_URL`, `IDENTITY_REGISTRY_ADDRESS`, `FACE_REGISTRY_ADDRESS`, `AUDIT_ANCHOR_ADDRESS`.
3. Restart backend.
4. Cho service recover pending batches theo logic binh thuong.
5. Khong ghi de root da anchor; deploy sai thi treat nhu incident/config error.

Neu relayer bi lo:

1. Owner goi `removeRelayer(oldRelayer)` tren `IdentityRegistry`.
2. Tao relayer moi.
3. Fund relayer moi.
4. Owner goi `addRelayer(newRelayer)`.
5. Doi `BLOCKCHAIN_RELAYER_PRIVATE_KEY` backend.
6. Restart backend va verify anchor.

Neu owner key mat:

- Neu owner la single EOA va contract khong co recovery: governance bi ket.
- Production phai tranh bang multisig/cold wallet co quy trinh backup.

## Deploy Only Audit Contracts

Dung khi da co `IdentityRegistry` va chi muon deploy lai `FaceRegistry`/`AuditAnchor`:

```bash
cd blockchain
npm run deploy:audit:local
# hoac
npm run deploy:audit:custom
```

Yeu cau `IDENTITY_REGISTRY_ADDRESS` dung network hien tai.

Sau deploy, copy:

```env
FACE_REGISTRY_ADDRESS=0x...
AUDIT_ANCHOR_ADDRESS=0x...
```

Khong dung lenh nay neu ban can tao moi toan bo governance model.

## Common Commands

```bash
npm run compile
npm test
npm run node
npm run deploy:local
npm run deploy:custom
npm run deploy:audit:local
npm run deploy:audit:custom
```

## Troubleshooting

| Trieu chung | Nguyen nhan thuong gap | Cach xu ly |
|---|---|---|
| Backend log `IDENTITY_REGISTRY_ADDRESS not set` | Backend khong load `blockchain/.env` | Kiem tra file `blockchain/.env`, Docker env_file, hoac native cwd |
| Backend log `AUDIT_ANCHOR_ADDRESS not set` | Chua deploy/copy address | Chay deploy va cap nhat `blockchain/.env` |
| Transaction fail `not authorized` | Relayer chua duoc add vao `IdentityRegistry` | Owner goi `addRelayer(relayer)` |
| Transaction fail do gas | Relayer het native token | Nap gas cho relayer |
| Frontend wallet doc sai contract | `VITE_IDENTITY_REGISTRY_ADDRESS` sai/chua rebuild | Cap nhat env va rebuild frontend |
| Docker backend khong connect Hardhat | Hardhat node chua chay tren host hoac port 8545 bi chan | Chay `npm run node`, kiem tra port 8545 |
| Reset Hardhat node xong app fail | Local chain mat state/address cu | Deploy lai va update `blockchain/.env` |

## Security Rules

- Khong commit `.env`.
- Khong dua PII/file y te/on-chain data lon len blockchain.
- Production khong de owner private key tren backend.
- Relayer la hot key, phai monitor va rotate duoc.
- Audit root da anchor la immutable evidence; neu config sai, sua config va ghi incident, khong rewrite lich su.
- Moi deploy production phai luu lai: network, chain ID, contract addresses, deployer, owner, relayer, tx hash, block number, thoi diem deploy.
