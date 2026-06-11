**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# KLTN Hospital Management System - Blockchain

This module contains the smart contracts used for the tamper-evident audit trail system. It uses Hardhat for development, testing, and deployment.

## Overview
The blockchain layer is used **strictly for audit trails and integrity verification**. No medical data, PII, PDFs, or X-Rays are ever stored on-chain. Only hashes, timestamps, and metadata are anchored via the `AuditAnchor` and various registry contracts.

## Setup Instructions

```bash
# 1. Install dependencies
npm install

# 2. Compile contracts
npx hardhat compile

# 3. Run tests
npx hardhat test

# 4. Start local Hardhat node
npx hardhat node

# 5. Deploy contracts locally
npx hardhat run scripts/deploy.js --network localhost
```
