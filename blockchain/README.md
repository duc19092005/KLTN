# KLTN Blockchain

Smart contracts cho audit trail va integrity verification. Blockchain chi neo hash, Merkle root, timestamp va metadata ky thuat. Khong dua PII, PDF, anh y te, S3 key hay noi dung benh an len chain.

## Contracts

- `IdentityRegistry`: owner/root governance, Admin wallet authorization, relayer authorization.
- `FaceRegistry`: luu face hash integrity marker, chi owner/relayer duoc ghi.
- `AuditAnchor`: commit Merkle root cho audit batch, chi owner/relayer duoc ghi.

`FaceRegistry` va `AuditAnchor` hoi quyen tu `IdentityRegistry`, nen rotate relayer/admin chi can cap nhat mot contract.

## Env

Blockchain config nam trong thu muc nay:

```bash
cp .env.example .env
```

`blockchain/.env` giu:

- `NETWORK_RPC_URL`, `PRIVATE_KEY`: dung khi Hardhat deploy vao custom network.
- `BLOCKCHAIN_RPC_URL`: backend runtime RPC.
- `IDENTITY_REGISTRY_ADDRESS`, `FACE_REGISTRY_ADDRESS`, `AUDIT_ANCHOR_ADDRESS`: contract addresses.
- `BLOCKCHAIN_OWNER_*`: root governance key cho dev/local.
- `BLOCKCHAIN_RELAYER_*`: hot wallet backend dung de ghi audit/face hash.
- `VITE_*`: frontend wallet verification config.

Root `.env` cua repo khong con chua blockchain key/address.

## Local Deploy

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

Sau deploy, script se in cac dong can copy vao `blockchain/.env`:

```env
IDENTITY_REGISTRY_ADDRESS=0x...
FACE_REGISTRY_ADDRESS=0x...
AUDIT_ANCHOR_ADDRESS=0x...
BLOCKCHAIN_OWNER_ADDRESS=0x...
BLOCKCHAIN_RELAYER_ADDRESS=0x...
VITE_IDENTITY_REGISTRY_ADDRESS=0x...
```

Neu vua reset Hardhat node, phai deploy lai vi local chain khong giu state cu.

## Docker Compose Integration

`docker-compose.yml` khong chay blockchain container nua. Hay chay Hardhat node tren host bang `npm run node`, sau do:

```bash
cd ..
docker compose up -d
```

Backend container se load them `./blockchain/.env`, nhung override RPC thanh:

```text
http://host.docker.internal:8545
```

De custom build frontend voi address khac, pass env file khi compose/build:

```bash
docker compose --env-file blockchain/.env up -d --build
```

## Custom Network Deploy

Cap nhat `blockchain/.env`:

```env
NETWORK_RPC_URL=https://your-rpc.example
PRIVATE_KEY=0xYOUR_DEPLOYER_KEY
BLOCKCHAIN_OWNER_ADDRESS=0xOWNER_OR_MULTISIG
BLOCKCHAIN_RELAYER_ADDRESS=0xBACKEND_RELAYER
```

Deploy:

```bash
npm run compile
npm run deploy:custom
```

Copy address output ve `blockchain/.env`.

Production nen:

- Chuyen owner sang cold wallet hoac multisig.
- Khong de owner private key tren backend host.
- Chi de backend giu relayer hot key, va relayer phai revoke/rotate duoc.

## Commands

```bash
npm run compile
npm test
npm run node
npm run deploy:local
npm run deploy:custom
npm run deploy:audit:local
npm run deploy:audit:custom
```

`deploy:audit:*` chi deploy lai `FaceRegistry` va `AuditAnchor` khi da co `IdentityRegistry`.
