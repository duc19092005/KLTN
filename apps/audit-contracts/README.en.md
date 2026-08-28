# Smart Contracts - Blockchain Audit & Identity Registry

The `apps/audit-contracts` package contains the Solidity smart contracts (v0.8.20) developed with **Hardhat**, managing on-chain access governance, biometric facial registry hashes, and immutable Merkle audit checkpoints.

---

## 🏛️ Smart Contracts Overview

### 1. `IdentityRegistry.sol` (Core Governance Registry)
- **Role:** Centralized authority registry managing authorized administrator and relayer addresses.
- **Key Functions:**
  - `addAdmin(address)` / `removeAdmin(address)`: Grant or revoke administrative authority.
  - `addRelayer(address)` / `removeRelayer(address)`: Authorize backend relayer signer wallets.
  - `isAuthorized(address)`: Validate administrative or relayer privileges.
  - `recordAction(bytes32 actionHash)`: Permanently log sensitive administrative action hashes.

### 2. `FaceRegistry.sol` (Biometric Facial Registry)
- **Role:** Maintains cryptographic hashes of facial biometric embeddings for decentralized verification and account recovery.
- **Key Functions:**
  - `setFaceHash(address user, bytes32 faceHash)`: Commit biometric template hash (restricted to relayer/owner).
  - `getFaceHash(address user)`: Retrieve registered facial hash for verification.
  - `setRecoveryArtifact(address user, bytes32 artifactHash, string uri)`: Anchor decentralized IPFS recovery artifacts.

### 3. `AuditAnchor.sol` (Merkle Audit Checkpoint Anchor)
- **Role:** Stores immutable Merkle root checkpoints and IPFS artifact CIDs.
- **Key Functions:**
  - `commitCheckpoint(uint256 batchId, bytes32 merkleRoot, uint256 leafCount, uint256 fromSeq, uint256 toSeq, bytes32 artifactHash, string calldata artifactUri)`: Anchor a new audit batch.
  - `getCheckpoint(uint256 batchId)`: Query checkpoint details and cryptographic roots.
  - `latestBatchId()`: Retrieve the highest anchored batch index.

---

## ⚙️ Setup & Deployment

### 1. Install Dependencies
```bash
cd apps/audit-contracts
npm install
```

### 2. Start Local Hardhat Node
```bash
# Starts local blockchain node (RPC: http://localhost:8545, ChainId: 31337)
npm run node
```

### 3. Deploy Contracts Locally
In a separate terminal:
```bash
npm run deploy:local
```
Deployed contract addresses will be outputted to configure the backend and frontend `.env` files.

### 4. Run Smart Contract Tests
```bash
npm test
```