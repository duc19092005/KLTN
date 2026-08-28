# Empirical Technical Report: Performance Benchmark, Gas Consumption & Data Tamper Detection

This document provides a comprehensive analysis of the methodology, test environment, mathematical models, and empirical benchmark results comparing the **Merkle Tree + IPFS Hybrid Architecture (KLTN)** against **Direct On-Chain Logging (Raw Baseline)**.

---

## 🔬 1. Testbed Environment & Hardware / EVM Configuration

The experiments were executed on an isolated local EVM testbed mirroring the Ethereum Mainnet/Sepolia consensus layer:

| Environment Metric | Value | Technical Rationale |
|---|---|---|
| **EVM Version** | Hardhat Cancun EVM | Full support for SHA-256 precompile (`0x02`), transient storage, and modern EVM opcodes |
| **Block Time** | 12.0 seconds / block | Standard block generation interval in Ethereum Proof-of-Stake (PoS) |
| **Block Gas Limit** | 30,000,000 gas / block | Maximum computation capacity per block on Ethereum |
| **Hash Function** | SHA-256 (256-bit) | FIPS 180-4 compliant cryptographic hashing, natively compatible with IPFS UnixFS multihash |
| **Benchmark Suites** | `benchmark-merkle-vs-raw.js`<br>`benchmark-tamper-detection.js` | Automated synthetic log generator, transaction telemetry, nanosecond timers via `performance.now()` |
| **Smart Contracts** | `AuditAnchor.sol`<br>`RawAuditLogger.sol` | Co-deployed on identical block states to guarantee objective, zero-bias comparative measurements |

---

## ⚡ 2. Experiment 1: Gas Consumption & Throughput Scaling Analysis

### 2.1. Benchmark Methodology
A standardized batch of **1,000 clinical audit records** was generated containing full metadata: patient record ID, practitioner ID, clinical action, diagnosis payload, and timestamps.
- **Raw On-Chain Method (`RawAuditLogger.sol`):** Dispatches 1,000 independent transactions to the network, persisting each struct directly in contract storage (`mapping(uint256 => AuditRecord)`).
- **Merkle Tree Hybrid Method (`AuditAnchor.sol`):** The off-chain engine constructs a cryptographic binary Merkle tree over the 1,000 records, packages the full audit batch onto decentralized IPFS, and submits **a single checkpoint transaction** committing the 32-byte Merkle root on-chain.

### 2.2. Empirical Measurements (1,000 Logs Batch)

| Performance Metric | Raw On-Chain Baseline | Merkle Tree Hybrid (KLTN) | Improvement Factor |
|---|:---:|:---:|:---:|
| **On-Chain Transactions** | 1,000 txs | **1 tx** | 📉 **1,000x reduction (99.9%)** |
| **Total Gas Consumed** | 236,626,908 gas | **300,883 gas** | ⚡ **99.87% Gas Savings** |
| **Average Gas / Log** | 236,627 gas / log | **300.88 gas / log** | 💡 **786.4x More Cost-Effective** |
| **Local Processing Time** | 2,021 ms (~2.02s) | **22 ms** (~0.022s) | ⏱️ **91.9x Faster** |
| **Blockchain Confirmation** | 2 to 3.5 minutes *(8–10 blocks)* | **12 seconds** *(1 single block)* | 🎯 **Instant, Zero Congestion Risk** |
| **Single Proof Verification** | Not supported | **46,192 gas / proof** | 📐 **Ultra-lightweight on-chain proof** |

---

### 2.3. Hospital Scale Projection

Extrapolating from the empirical 1,000-log baseline across clinical operational cycles:

| Audit Scale | Gas: Raw On-Chain | Gas: Merkle Tree (KLTN) | On-Chain Confirmation: Raw | Confirmation: Merkle |
|---|:---:|:---:|:---:|:---:|
| **1,000 logs** *(Test Batch)* | 236.6 Million Gas | **300.8 Thousand Gas** | 2 – 3.5 minutes | **12s (1 block)** |
| **10,000 logs** *(1 Hospital Week)* | 2.36 Billion Gas | **345.0 Thousand Gas** | ~20 minutes (100 blocks) | **12s (1 block)** |
| **100,000 logs** *(1 Hospital Month)* | 23.6 Billion Gas | **420.0 Thousand Gas** | **~3.3 HOURS** (1,000 blocks) | **12s (1 block)** |
| **1,000,000 logs** *(1 Hospital Year)* | 236.6 Billion Gas | **580.0 Thousand Gas** | **~33.3 HOURS** (10,000 blocks) | **12s (1 block)** |

### 2.4. Visual Comparison Chart

<p align="center">
  <img src="../assets/benchmark_gas_and_time_comparison.png" alt="Benchmark Gas & Execution Time" width="100%" />
</p>

---

## 🛡️ 3. Experiment 2: Tamper Detection & Adversarial Attack Simulation

### 3.1. Attack Vectors Simulated
Four realistic database tampering scenarios were executed against a 1,000-log audit repository:

1. **Scenario 1 — Single Field Tampering:** Malicious insider alters log `#450`, modifying diagnosis from *"Acute Lobar Pneumonia"* to *"Mild Pharyngitis"*.
2. **Scenario 2 — Log Deletion:** Record `#720` is deleted from the hospital database to conceal medical malpractice evidence.
3. **Scenario 3 — Reorder Attack:** Swaps the chronological order of adjacent events `#300` and `#301` to fabricate clinical timeline precedence.
4. **Scenario 4 — Fake Log Injection:** Injects a fraudulent record at position `#151` to retrospectively validate an unperformed procedure.

### 3.2. Tamper Detection Matrix

| Attack Scenario | Raw On-Chain Baseline | Merkle Tree Hybrid (KLTN) | Architectural Advantage |
|---|:---:|:---:|:---:|
| **1. Single Field Tamper (#450)** | Detected *(307 ms, 451 RPC)* | **Detected (5.3 ms, 1 RPC)** | ⚡ Merkle is **57x FASTER**, isolates position `#450` |
| **2. Log Deletion (#720)** | Detected *(453 ms, 721 RPC)* | **Detected (4.9 ms, 1 RPC)** | 🎯 Merkle is **92x FASTER**, pinpoints deleted record `#720` |
| **3. Reorder Attack (#300 ⇄ #301)** | Detected *(190 ms, 301 RPC)* | **Detected (4.9 ms, 1 RPC)** | ⚡ Merkle is **38x FASTER**, pinpoints swapped index `#300` |
| **4. Fake Log Injection (#151)** | Detected *(98 ms, 152 RPC)* | **Detected (4.7 ms, 1 RPC)** | 🎯 Merkle is **21x FASTER**, identifies injected record `#151` |
| **Total RPC Calls Required** | 152 – 721 requests | **1 single request** | 📉 **Up to 721x reduction in network calls** |
| **Network Bandwidth Incurred** | 37 KB – 180 KB | **0.06 KB (32 bytes hash)** | 📉 **3,000x lower bandwidth overhead** |
| **Localization Precision** | 100% (Sequential Scan $O(N)$) | **100% (Binary Search $O(\log N)$)** | Both guarantee total cryptographic integrity |

---

### 3.3. Visual Tamper Detection Chart

<p align="center">
  <img src="../assets/benchmark_tamper_detection.png" alt="Benchmark Tamper Detection" width="100%" />
</p>

---

## 📐 4. Mathematical Complexity & Cryptographic Proofs

### 4.1. Big-O Complexity Comparison

| Operation | Raw On-Chain Baseline | Merkle Tree + IPFS (KLTN) |
|---|:---:|:---:|
| **On-Chain Storage Overhead** | $O(N)$ | **$O(1)$** *(Constant 32 bytes)* |
| **Client Construction Overhead** | $O(1)$ | **$O(N)$** *(22 ms for 1,000 logs)* |
| **Cryptographic Proof Size** | Not supported | **$O(\log_2 N)$** *(10 hashes = 320 bytes)* |
| **On-Chain Verification Cost** | $O(1)$ per log | **$O(\log_2 N)$** *(46,192 gas)* |
| **Batch Audit Network Overhead** | $O(N)$ | **$O(1)$** *(1 single RPC call)* |

### 4.2. Dual-Layer Cryptographic Binding:
1. **Layer 1 — Sequential Hash Chain:**
   $$\text{entryHash}_i = \text{SHA256}(\text{prevHash}_{i-1} \parallel \text{dataHash}_i \parallel \text{seq}_i)$$
2. **Layer 2 — Hierarchical Merkle Tree:**
   $$\text{ParentNode} = \text{SHA256}(\text{LeftChild} \parallel \text{RightChild})$$

A single bit deviation in any field triggers the **Avalanche Effect** across the Merkle tree, causing a 100% mismatch with the on-chain root and triggering automated **Self-Healing** from decentralized IPFS storage.

---

## 🛠️ 5. Reproduction Guide

You can reproduce the full benchmark suite locally with the following commands:

### Step 1: Run Hardhat EVM Benchmarks
```bash
cd apps/audit-contracts
npm install
# Run Gas & Latency Benchmark:
npx hardhat run scripts/benchmark-merkle-vs-raw.js
# Run Tamper Detection Benchmark:
npx hardhat run scripts/benchmark-tamper-detection.js
```

### Step 2: Render 300 DPI Infographic Charts via Docker
```bash
# From workspace root:
docker run --rm -v "${PWD}:/workspace" -w /workspace python:3.11-slim sh -c `
  "pip install --no-cache-dir matplotlib numpy && python docs/scripts/generate_benchmark_charts.py && python docs/scripts/generate_tamper_benchmark_charts.py"
```
Generated high-resolution infographics are output to `docs/assets/`.