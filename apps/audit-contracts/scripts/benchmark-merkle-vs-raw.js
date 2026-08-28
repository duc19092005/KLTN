const hre = require('hardhat');
const crypto = require('crypto');
const fs = require('fs');
const { ethers } = hre;

function sha256(data) {
  return '0x' + crypto.createHash('sha256').update(data).digest('hex');
}

function hashLeaf(leafHex) {
  const domain = Buffer.from('KLTN_AUDIT_LEAF_V2', 'utf8');
  const leafBuf = Buffer.from(leafHex.replace('0x', ''), 'hex');
  return '0x' + crypto.createHash('sha256').update(Buffer.concat([domain, leafBuf])).digest('hex');
}

function hashPair(aHex, bHex) {
  const domain = Buffer.from('KLTN_AUDIT_NODE_V2', 'utf8');
  const aBuf = Buffer.from(aHex.replace('0x', ''), 'hex');
  const bBuf = Buffer.from(bHex.replace('0x', ''), 'hex');
  const [lo, hi] = aHex.toLowerCase() <= bHex.toLowerCase() ? [aBuf, bBuf] : [bBuf, aBuf];
  return '0x' + crypto.createHash('sha256').update(Buffer.concat([domain, lo, hi])).digest('hex');
}

function buildMerkleTree(leavesHex) {
  if (leavesHex.length === 0) return { root: ethers.ZeroHash, layers: [] };
  let currentLayer = leavesHex.map(hashLeaf);
  const layers = [currentLayer];

  while (currentLayer.length > 1) {
    const nextLayer = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      if (i + 1 < currentLayer.length) {
        nextLayer.push(hashPair(currentLayer[i], currentLayer[i + 1]));
      } else {
        nextLayer.push(currentLayer[i]);
      }
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }
  return { root: currentLayer[0], layers };
}

function getProof(layers, index) {
  const proof = [];
  let idx = index;
  for (let i = 0; i < layers.length - 1; i++) {
    const layer = layers[i];
    const isRight = idx % 2 === 1;
    const pairIdx = isRight ? idx - 1 : idx + 1;
    if (pairIdx < layer.length) {
      proof.push(layer[pairIdx]);
    }
    idx = Math.floor(idx / 2);
  }
  return proof;
}

async function main() {
  console.log('========================================================================');
  console.log('BENCHMARK: MERKLE TREE CHECKPOINTING VS RAW ON-CHAIN LOGGING');
  console.log('========================================================================\n');

  const [owner, relayer] = await ethers.getSigners();

  // 1. Deploy Contracts
  console.log('1. Trien khai Smart Contracts tren Hardhat Local Node...');
  const IdentityRegistry = await ethers.getContractFactory('IdentityRegistry');
  const identity = await IdentityRegistry.deploy();
  await identity.waitForDeployment();

  const AuditAnchor = await ethers.getContractFactory('AuditAnchor');
  const anchor = await AuditAnchor.deploy(await identity.getAddress());
  await anchor.waitForDeployment();

  const RawAuditLogger = await ethers.getContractFactory('RawAuditLogger');
  const rawLogger = await RawAuditLogger.deploy();
  await rawLogger.waitForDeployment();

  await identity.authorizeAdmin(owner.address);
  console.log('   IdentityRegistry: ' + (await identity.getAddress()));
  console.log('   AuditAnchor:      ' + (await anchor.getAddress()));
  console.log('   RawAuditLogger:   ' + (await rawLogger.getAddress()));

  // 2. Generate 1,000 Mock Audit Records
  const TOTAL_LOGS = 1000;
  console.log('\n2. Tao tap du lieu mo phong ' + TOTAL_LOGS + ' ban ghi kiem toan y te (V2 Format)...');
  const mockLogs = [];
  const entities = ['MedicalConclusion', 'Visit', 'Patient', 'MedicalOrder'];
  const actions = ['CREATE', 'UPDATE'];

  for (let i = 1; i <= TOTAL_LOGS; i++) {
    const entity = entities[i % entities.length];
    const entityId = crypto.randomUUID();
    const action = actions[i % actions.length];
    const dataHash = sha256('data-payload-' + i + '-' + entity + '-' + entityId);
    const entryHash = sha256('entry-' + i + '-' + entity + '-' + entityId + '-' + action + '-' + dataHash);
    mockLogs.push({ seq: i, entity, entityId, action, dataHash, entryHash });
  }
  console.log('   Da tao thanh cong ' + TOTAL_LOGS + ' ban ghi kiem toan.');

  // 3. Benchmark Approach A: Raw On-Chain Logging (1,000 Direct Transactions)
  console.log('\n3. Dang thuc thi Phuong phap 1: Raw On-Chain Logging (Ghi truc tiep ' + TOTAL_LOGS + ' giao dich le len chuoi)...');
  let rawTotalGas = 0n;
  const rawGasPerTx = [];
  const startRawTime = Date.now();

  for (let i = 0; i < TOTAL_LOGS; i++) {
    const log = mockLogs[i];
    const tx = await rawLogger.recordLog(
      log.seq,
      log.entity,
      log.entityId,
      log.action,
      log.dataHash,
      log.entryHash
    );
    const receipt = await tx.wait();
    const gas = receipt.gasUsed;
    rawTotalGas += gas;
    rawGasPerTx.push(Number(gas));
    if ((i + 1) % 250 === 0) {
      console.log('   -> Da gui ' + (i + 1) + '/' + TOTAL_LOGS + ' giao dich (Gas luy ke: ' + rawTotalGas.toLocaleString() + ' gas)...');
    }
  }
  const rawDurationMs = Date.now() - startRawTime;
  const avgRawGas = Number(rawTotalGas) / TOTAL_LOGS;
  const minRawGas = Math.min(...rawGasPerTx);
  const maxRawGas = Math.max(...rawGasPerTx);

  console.log('   Hoan tat Raw Logging trong ' + rawDurationMs + ' ms.');
  console.log('   Tong Gas tieu thu:      ' + rawTotalGas.toLocaleString() + ' gas');
  console.log('   Gas trung binh / 1 log: ' + avgRawGas.toFixed(0) + ' gas (Min: ' + minRawGas + ', Max: ' + maxRawGas + ')');

  // 4. Benchmark Approach B: Merkle Tree Batch Checkpointing (1 Single Transaction)
  console.log('\n4. Dang thuc thi Phuong phap 2: Merkle Tree Batch Checkpointing (Gom ' + TOTAL_LOGS + ' log vao 1 Cay Merkle & 1 Giao dich)...');
  const startMerkleTime = Date.now();

  // Off-chain: Build Merkle Tree
  const leavesHex = mockLogs.map((l) => l.entryHash);
  const { root: merkleRoot, layers } = buildMerkleTree(leavesHex);
  const artifactHash = sha256('bundle-payload-' + TOTAL_LOGS);
  const artifactUri = 'ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco';
  const offChainTreeTimeMs = Date.now() - startMerkleTime;

  // On-chain: Commit 1 Checkpoint
  const anchorTx = await anchor.commitCheckpoint(
    1,
    merkleRoot,
    TOTAL_LOGS,
    1,
    TOTAL_LOGS,
    artifactHash,
    artifactUri
  );
  const anchorReceipt = await anchorTx.wait();
  const merkleGasUsed = anchorReceipt.gasUsed;
  const merkleDurationMs = Date.now() - startMerkleTime;
  const avgMerkleGasPerLog = Number(merkleGasUsed) / TOTAL_LOGS;

  console.log('   Hoan tat Merkle Checkpointing trong ' + merkleDurationMs + ' ms (Off-chain dung cay: ' + offChainTreeTimeMs + ' ms).');
  console.log('   Tong Gas tieu thu (1 tx duy nhat): ' + merkleGasUsed.toLocaleString() + ' gas');
  console.log('   Gas trung binh / 1 log:            ' + avgMerkleGasPerLog.toFixed(2) + ' gas/log');

  // 5. Benchmark Merkle Proof Verification
  const sampleIndex = 42;
  const sampleLog = mockLogs[sampleIndex];
  const proof = getProof(layers, sampleIndex);
  const verifyGasEstimate = await anchor.verifyProof.estimateGas(1, sampleLog.entryHash, proof);
  const isValid = await anchor.verifyProof(1, sampleLog.entryHash, proof);

  console.log('\n5. Kiem tra Xac minh Toan hoc doc lap (Merkle Proof Verification):');
  console.log('   Xac minh Log so ' + (sampleIndex + 1) + ': ' + (isValid ? 'THANH CONG (VALID)' : 'THAT BAI'));
  console.log('   Do sau duong dan (Proof length):    ' + proof.length + ' sibling hashes');
  console.log('   Gas tieu thu khi verify on-chain:   ' + verifyGasEstimate.toLocaleString() + ' gas');

  // 6. Cost Projection & Savings Calculation
  const gasSavingsPercent = ((Number(rawTotalGas) - Number(merkleGasUsed)) / Number(rawTotalGas)) * 100;
  const gasReductionFactor = Number(rawTotalGas) / Number(merkleGasUsed);

  function calculateCosts(gasAmount) {
    const ethMainnet = (Number(gasAmount) * 25e-9 * 2500).toFixed(4);
    const l2Eth = (Number(gasAmount) * 0.1e-9 * 2500).toFixed(6);
    const polygon = (Number(gasAmount) * 30e-9 * 0.50).toFixed(4);
    return { ethMainnet, l2Eth, polygon };
  }

  const rawCost1k = calculateCosts(rawTotalGas);
  const merkleCost1k = calculateCosts(merkleGasUsed);
  const rawCost100k = calculateCosts(rawTotalGas * 100n);
  const merkleCost100k = calculateCosts(merkleGasUsed * 100n);
  const rawCost1M = calculateCosts(rawTotalGas * 1000n);
  const merkleCost1M = calculateCosts(merkleGasUsed * 1000n);

  console.log('\n========================================================================');
  console.log('BANG TONG HOP KET QUA BENCHMARK (1,000 AUDIT LOGS)');
  console.log('========================================================================');
  console.log('So luong ban ghi kiem toan:       1,000 logs');
  console.log('So giao dich gui len chuoi:');
  console.log('    - Raw On-Chain Logging:         1,000 transactions');
  console.log('    - Merkle Tree Checkpoint:       1 transaction');
  console.log('Tong Gas tieu thu:');
  console.log('    - Raw On-Chain Logging:         ' + rawTotalGas.toLocaleString() + ' gas');
  console.log('    - Merkle Tree Checkpoint:       ' + merkleGasUsed.toLocaleString() + ' gas');
  console.log('Chi phi Gas trung binh moi log:');
  console.log('    - Raw On-Chain Logging:         ' + avgRawGas.toFixed(0) + ' gas/log');
  console.log('    - Merkle Tree Checkpoint:       ' + avgMerkleGasPerLog.toFixed(2) + ' gas/log');
  console.log('HIEU QUA TIET KIEM GAS:           ' + gasSavingsPercent.toFixed(2) + '% (Giam ~' + gasReductionFactor.toFixed(0) + ' LAN)');
  console.log('Thoi gian thuc thi:');
  console.log('    - Raw On-Chain:                 ' + rawDurationMs + ' ms');
  console.log('    - Merkle Tree:                  ' + merkleDurationMs + ' ms (Nhanh gap ' + (rawDurationMs / merkleDurationMs).toFixed(1) + ' lan)');
  console.log('========================================================================\n');

  console.log('BANG DU TOAN CHI PHI THUC TE (ESTIMATED FINANCIAL COSTS):');
  console.log('------------------------------------------------------------------------');
  console.log('| Quy mo (Logs)  | Phuong phap     | Ethereum Mainnet | L2 (Arbitrum/Base) | Polygon PoS |');
  console.log('------------------------------------------------------------------------');
  console.log('| 1,000 logs     | Raw On-Chain    | $' + rawCost1k.ethMainnet.padEnd(14) + ' | $' + rawCost1k.l2Eth.padEnd(16) + ' | $' + rawCost1k.polygon.padEnd(9) + ' |');
  console.log('| 1,000 logs     | Merkle Tree (KLTN)| $' + merkleCost1k.ethMainnet.padEnd(14) + ' | $' + merkleCost1k.l2Eth.padEnd(16) + ' | $' + rawCost1k.polygon.padEnd(9) + ' |');
  console.log('------------------------------------------------------------------------');
  console.log('| 100,000 logs   | Raw On-Chain    | $' + rawCost100k.ethMainnet.padEnd(14) + ' | $' + rawCost100k.l2Eth.padEnd(16) + ' | $' + rawCost100k.polygon.padEnd(9) + ' |');
  console.log('| (1 thang BV)   | Merkle Tree (KLTN)| $' + merkleCost100k.ethMainnet.padEnd(14) + ' | $' + merkleCost100k.l2Eth.padEnd(16) + ' | $' + merkleCost100k.polygon.padEnd(9) + ' |');
  console.log('------------------------------------------------------------------------');
  console.log('| 1,000,000 logs | Raw On-Chain    | $' + rawCost1M.ethMainnet.padEnd(14) + ' | $' + rawCost1M.l2Eth.padEnd(16) + ' | $' + rawCost1M.polygon.padEnd(9) + ' |');
  console.log('| (1 nam BV)     | Merkle Tree (KLTN)| $' + merkleCost1M.ethMainnet.padEnd(14) + ' | $' + merkleCost1M.l2Eth.padEnd(16) + ' | $' + merkleCost1M.polygon.padEnd(9) + ' |');
  console.log('------------------------------------------------------------------------\n');

  const resultObj = {
    totalLogs: TOTAL_LOGS,
    rawLogging: {
      transactions: TOTAL_LOGS,
      totalGas: Number(rawTotalGas),
      avgGasPerLog: avgRawGas,
      minGas: minRawGas,
      maxGas: maxRawGas,
      durationMs: rawDurationMs,
      costs: {
        per1k: rawCost1k,
        per100k: rawCost100k,
        per1M: rawCost1M,
      }
    },
    merkleCheckpoint: {
      transactions: 1,
      totalGas: Number(merkleGasUsed),
      avgGasPerLog: avgMerkleGasPerLog,
      offChainTreeTimeMs,
      durationMs: merkleDurationMs,
      verifyProofGas: Number(verifyGasEstimate),
      costs: {
        per1k: merkleCost1k,
        per100k: merkleCost100k,
        per1M: merkleCost1M,
      }
    },
    comparison: {
      gasSavingsPercent,
      gasReductionFactor,
      speedupFactor: rawDurationMs / merkleDurationMs,
    }
  };

  fs.writeFileSync('benchmark-result.json', JSON.stringify(resultObj, null, 2), 'utf8');
  console.log('Da luu ket qua chi tiet vao apps/audit-contracts/benchmark-result.json');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });