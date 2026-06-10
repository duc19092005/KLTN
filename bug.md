Merkle Tree / Blockchain Audit Review — KLTN Hospital Management SystemScope reviewed:

Backend hashing/canonicalization:backend/src/infrastructure/audit/audit-hash.util.tsbackend/src/infrastructure/audit/merkle.util.tsBackend anchoring/integration:backend/src/infrastructure/audit/audit-logger.service.tsbackend/src/infrastructure/audit/audit-anchor.service.tsbackend/src/infrastructure/blockchain/blockchain.service.tsSmart contract:blockchain/contracts/AuditAnchor.solHardhat tests:blockchain/test/audit.test.jsAudit usage search:Patient, Department, Staff, Doctor, MedicalConclusion, AI model, backup paths.Overall: the design direction is good for the project rule “on-chain = hashes/timestamps/metadata only”. The current implementation has a reasonable off-chain hash-chain + Merkle batch anchor model, but it is not yet audit-grade because backend and Solidity do not share verifiable proof logic, batch crash recovery/idempotency has gaps, canonical JSON is custom but incomplete, and audit logging is not transactionally coupled to many domain writes.

Critical FindingsCritical-1 — Smart contract does not implement Merkle proof verificationFile + function

blockchain/contracts/AuditAnchor.solMissing function: verifyProof(...)Related backend:backend/src/infrastructure/audit/merkle.util.tsverifyMerkleProof()Bug / risk

AuditAnchor.sol only stores roots:

solidityfunction commitRoot(uint256 batchId, bytes32 root, uint256 leafCount) external onlyOwnerfunction getRoot(uint256 batchId) external view returns (bytes32)function getCheckpoint(uint256 batchId) external view returns (...)There is no Solidity-side verifyProof. All proof verification currently happens in backend/off-chain via verifyMerkleProof().

Why dangerous in hospital context

For a hospital audit system, an external verifier, auditor, or public verification portal should be able to independently verify that a log/clinical integrity record belongs to an anchored Merkle root without trusting the backend. If the backend is compromised, it can report verified: true for a fabricated proof unless the verifier independently recomputes or checks against contract logic.

Reproduce / test case

Current Hardhat tests only cover root commit/read:

jsawait expect(anchor.commitRoot(1, root, 4)).to.emit(anchor, 'RootCommitted');expect(await anchor.getRoot(1)).to.equal(root);Missing tests:

verifyProof(validLeaf, proof, batchId) == truetampered leaf failstampered proof failswrong root/batch failsSuggested fix

Add a pure/view verifier to AuditAnchor.sol that exactly matches backend algorithm.

Current backend algorithm:

tsleaf = sha256("leaf:" + entryHashHexLower)node = sha256("node:" + min(a,b) + max(a,b))Solidity must reproduce the same byte/string semantics or the system must migrate to a cleaner bytes32 algorithm.

Recommended v2 contract algorithm:

solidityfunction hashLeaf(bytes32 entryHash) public pure returns (bytes32) {return sha256(abi.encodePacked("KLTN_AUDIT_LEAF_V1", entryHash));}function hashPair(bytes32 a, bytes32 b) public pure returns (bytes32) {(bytes32 lo, bytes32 hi) = a <= b ? (a, b) : (b, a);return sha256(abi.encodePacked("KLTN_AUDIT_NODE_V1", lo, hi));}function verifyProof(uint256 batchId,bytes32 entryHash,bytes32[] calldata proof) external view returns (bool) {Checkpoint storage cp = checkpoints[batchId];if (!cp.exists) return false;bytes32 acc = hashLeaf(entryHash);for (uint256 i = 0; i < proof.length; i++) {acc = hashPair(acc, proof[i]);}return acc == cp.root;}If keeping string-hash compatibility, add test vectors because Solidity string encoding of hex strings is easy to mismatch.

Critical-2 — Current Merkle algorithm cannot be reproduced safely on-chain without exact string encodingFile + function

backend/src/infrastructure/audit/merkle.util.tshashLeaf()hashPair()computeMerkleRoot()blockchain/contracts/AuditAnchor.solno matching implementationBug / risk

Backend hashes strings:

tsreturn sha256Hex(leaf:${entryHashHex.toLowerCase()});return sha256Hex(node:${lo}${hi});This means the digest is over UTF-8 text like:

textleaf...node...bbbb...Not over raw bytes32.

This is deterministic in Node.js, but fragile for Solidity parity because Solidity normally works with bytes32, not lowercase hex strings.

Why dangerous

If Solidity verifier is later added using sha256(abi.encodePacked(bytes32, bytes32)), it will not match existing backend roots. That breaks all previously anchored batches and makes audit verification unreliable.

Reproduce / test case

Create backend root for known entries:

tsconst entries = ['a'.repeat(64), 'b'.repeat(64)];computeMerkleRoot(entries);Then implement Solidity verifier with bytes32 pair hashing. It will not match because backend hashes ASCII hex string, not bytes.

Suggested fix

Define a canonical Merkle v2 format now:

entryHash: bytes32 digest from audit chain.leaf: sha256(abi.encodePacked("KLTN_AUDIT_LEAF_V1", entryHash))node: sha256(abi.encodePacked("KLTN_AUDIT_NODE_V1", lo, hi))root: bytes32.proof: bytes32[].Add explicit algorithmVersion to AuditBatch and emitted event.

Compatibility:

Existing roots remain MERKLE_SHA256_STRING_V1.New batches use MERKLE_SHA256_BYTES32_V2.Verifier chooses algorithm by batch version.Critical-3 — Audit logs can store sensitive data in DB fields intended for audit snapshotsFile + function

backend/src/infrastructure/audit/audit-logger.service.tsrecord()fields:beforeJsonafterJsonmetadataUsage examples:clinical-decision/.../blockchain-medical-conclusion-integrity.anchor.tspatient/.../audit-patient-integrity.anchor.tsBug / risk

On-chain appears safe because only roots are committed. However, BlockchainLogger stores beforeJson, afterJson, metadata directly:

tsbeforeJson: (params.before ?? null) as any,afterJson: (params.after ?? null) as any,metadata: (params.metadata ?? null) as any,If caller passes diagnosis text, patient PII, Cloudinary URLs, PDF names, X-Ray metadata, etc., it becomes part of the audit table. While not on-chain, BlockchainLogger is an audit/security table and likely surfaced to admin/public verification views.

Why dangerous

The user’s explicit policy says:

No PII on chain.No medical data on chain.Blockchain logger is integrity/audit.Even though not directly on-chain, anchoring its hashes can make sensitive snapshots operationally “audit-persistent” and harder to purge. In a hospital system, this can create privacy exposure in logs, backups, admin screens, exports, and support tooling.

Reproduce / test case

Call:

tsaudit.record({entity: 'MedicalConclusion',entityId,action: 'CREATE',after: { diagnosis: '...', treatmentPlan: '...', patientName: '...' },});Then inspect BlockchainLogger.afterJson.

Suggested fix

Introduce a strict sanitizer/allowlist before writing audit snapshots:

tsfunction sanitizeAuditPayload(entity: string, payload: unknown): unknown {// allow only non-PII identifiers/status/hash metadata}For clinical entities:

Store dataHash, entity, entityId, action, actorId, timestamps.Avoid diagnosis text, note, conclusion text, prescriptions, file URLs.If needed, store redacted metadata:json{"visitId": "...","medicalConclusionId": "...","schema": "MEDICAL_CONCLUSION_AUDIT_V1","fieldsChanged": ["status", "conclusionHash"]}Add test: no PII/diagnosis/file URL appears in BlockchainLogger.beforeJson/afterJson/metadata.

High FindingsHigh-1 — Backend canonicalize() is deterministic for simple objects but incomplete for BigInt, Decimal, Map, Set, non-finite numbers, and cyclic objectsFile + function

backend/src/infrastructure/audit/audit-hash.util.tscanonicalize()sortValue()computeRecordHash()computeEntryHash()Bug / risk

Current canonicalization:

tsif (value === null || value === undefined) return null;if (Array.isArray(value)) return value.map(sortValue);if (value instanceof Date) return value.toISOString();if (typeof value === 'object') {return Object.keys(value).sort().reduce(...)}return value;Problems:

undefined becomes null, collapsing distinct inputs.BigInt causes JSON.stringify() throw.Prisma Decimal or custom objects may serialize unexpectedly.NaN, Infinity, -Infinity become null under JSON.Cyclic objects crash.Map / Set become {}.Object prototypes/classes are ignored.Array order is preserved, which is okay if arrays are semantically ordered, but dangerous if source arrays come from DB without explicit orderBy.Why dangerous

Integrity hashes must be stable across time, environments, Node versions, and query shapes. If a Visit tree hash changes because child relation array order changed, the system may falsely report tampering or fail to verify legitimate medical records.

Reproduce / test case

tscanonicalize({ a: undefined }) === canonicalize({ a: null }) // truecanonicalize({ x: BigInt(1) }) // throwscanonicalize({ x: new Map([['a', 1]]) }) // "{}"canonicalize({ x: NaN }) // {"x"}Suggested fix

Implement RFC 8785-style canonical JSON or a strict internal canonicalizer:

Reject unsupported values instead of silently coercing.Convert Date to ISO.Convert BigInt to string with type marker or reject.Convert Decimal to string.Sort object keys.Require arrays already sorted by stable IDs.Detect cycles.Example policy:

tsif (typeof value === 'bigint') return { $bigint: value.toString() };if (Number.isNaN(value) || !Number.isFinite(value)) throw new Error(...);if (value === undefined) return { $undefined: true }; // or rejectFor medical snapshots, better: construct explicit DTO snapshots instead of hashing raw Prisma objects.

High-2 — Audit chain write serialization is only in-process, not safe across multiple backend instancesFile + function

backend/src/infrastructure/audit/audit-logger.service.tschainMutexenqueue()record()Bug / risk

The service serializes writes only within one Node process:

tsprivate chainMutex: Promise = Promise.resolve();If the backend runs multiple instances, two processes can both read the same tail and compute the same next seq.

The comment says DB unique constraint is a backstop, but the code does not show retry on unique conflict.

Why dangerous

In a hospital system, concurrent updates are common: visit updates, lab result submissions, conclusion finalization, admin changes. Race conditions can cause failed audit writes or broken chain continuity.

Reproduce / test case

Run two backend instances or parallel calls:

tsawait Promise.all([audit.record(...),audit.record(...),]);Across two processes, both can compute seq = N + 1.

Suggested fix

Use DB-level transaction with advisory lock:

sqlSELECT pg_advisory_xact_lock(hashtext('blockchain_logger_chain'));Inside same Prisma transaction:

Lock.Read tail.Compute seq/prevHash.Insert row.Also add retry on unique constraint seq.

High-3 — Audit log creation is not transactionally coupled to business writesFile + function

backend/src/infrastructure/audit/audit-logger.service.tsrecord()Usage paths from search:department/.../blockchain-department-integrity.anchor.tsstaff/.../blockchain-staff-integrity.anchor.tsdoctor/.../blockchain-doctor-integrity.anchor.tsclinical-decision/.../blockchain-medical-conclusion-integrity.anchor.tspatient/.../audit-patient-integrity.anchor.tsBug / risk

audit.record() uses this.prisma.blockchainLogger.create() internally. It does not accept a transaction client. Therefore, a service doing:

create/update medical/domain recordcall audit.record()cannot guarantee atomicity unless the caller wraps both and the logger supports the same transaction client.

Why dangerous

For MedicalConclusion, Visit, and MedicalResult, the audit trail is a clinical integrity requirement. If the domain write succeeds but audit write fails, the record exists without tamper evidence. If audit write succeeds but domain transaction later fails, audit says something happened when it did not.

Reproduce / test case

Force DB error after domain write but before/after audit call. Observe orphan domain write or orphan audit row depending ordering.

Suggested fix

Add transaction-compatible API:

tsrecord(params, tx?: Prisma.TransactionClient)Use tx.blockchainLogger.create() when provided.

For critical workflows:

tsawait prisma.$transaction(async (tx) => {const conclusion = await tx.medicalConclusion.create(...);await audit.record({...}, tx);});Then call anchorNow() after transaction commits.

High-4 — Batch creation before chain commit can block retries after process crashFile + function

backend/src/infrastructure/audit/audit-anchor.service.tsrunCycle()Bug / risk

Flow:

tsawait prisma.auditBatch.create({ status: 'PENDING' });const res = await blockchain.commitAuditRoot(...);...update batch ANCHORED and logs batchId...If process crashes after on-chain commitRoot succeeds but before DB update:

Contract has batch committed.DB AuditBatch remains PENDING.Logs remain batchId: null.Next cycle computes localMax using auditBatch.aggregate(_max.batchId).batchId becomes max(localMax, onChainLatest)+1.The same old logs may be re-anchored under a new batch.This creates duplicate anchors for same log set and confusing verification status.

Why dangerous

Auditors need one authoritative anchored batch. Duplicate or stale local state creates uncertainty: which root proves which records? In medical/legal contexts, ambiguity damages chain of custody.

Reproduce / test case

Simulate crash after commitAuditRoot() returns success but before $transaction updates DB.

Suggested fix

Add recovery logic:

On startup, scan AuditBatch.status = PENDING.For each pending batch, call getCheckpoint(batchId).If on-chain committed and root matches local merkleRoot, mark ANCHORED and attach logs by fromSeq/toSeq.If not committed and old timeout exceeded, mark FAILED and retry.Also add unique/immutable mapping:

AuditBatch.fromSeq/toSeq should not overlap another ANCHORED batch.BlockchainLogger.batchId should only be set once.High-5 — validatePendingChain() only validates pending segment; it can miss tampering in already anchored prior logs unless full-chain verification is run separatelyFile + function

backend/src/infrastructure/audit/audit-anchor.service.tsvalidatePendingChain()backend/src/infrastructure/audit/audit-logger.service.tsverifyChain()Bug / risk

Before anchoring a new batch, validatePendingChain() checks only the pending rows and the immediately preceding row’s entryHash. If older anchored rows were tampered with but the preceding row still exists, this function may not detect full historical corruption.

verifyChain() performs full-chain verification, but it is not called before anchoring.

Why dangerous

An attacker who can manipulate DB and pepper/env may attempt to rewrite prior history and continue anchoring new roots. The append-only trigger mitigates content updates, but if trigger is disabled/missing during migration or direct DB access, full verification is needed.

Reproduce / test case

Disable trigger, mutate a prior anchored row’s content without changing last anchored row’s entryHash. Run anchoring of new pending logs. validatePendingChain() may pass if pending segment links to previous tail.

Suggested fix

Before committing any new batch:

Verify the full chain, or at minimum verify from last anchored batch boundary to current pending tail.Compare previous anchored batch root against on-chain root by recomputing batch roots periodically.Add scheduled integrity job:

tsverifyChain()verifyAllAnchoredBatchesAgainstChain()High-6 — AuditAnchor allows non-monotonic batch IDs and gapsFile + function

blockchain/contracts/AuditAnchor.solcommitRoot()Bug / risk

Contract only checks:

solidityrequire(!checkpoints[batchId].exists)It does not require:

soliditybatchId == latestBatchId + 1So owner can commit batch 999 before batch 1, or skip IDs. Backend tries to maintain monotonic IDs, but contract does not enforce it.

Why dangerous

Batch order is part of audit chain interpretation. Non-monotonic or gapped batches make verification and forensic analysis harder.

Reproduce / test case

jsawait anchor.commitRoot(100, root, 4);expect(await anchor.latestBatchId()).to.equal(100);await anchor.commitRoot(1, root2, 4); // currently allowedSuggested fix

In commitRoot():

solidityrequire(batchId == latestBatchId + 1, "AuditAnchor: non-sequential batch");If migration compatibility needs flexible IDs, add separate commitGenesis or keep v1 and deploy v2.

Medium FindingsMedium-1 — computeMerkleRoot([]) returns zero root instead of throwingFile + function

backend/src/infrastructure/audit/merkle.util.tscomputeMerkleRoot()Bug / risk

tsif (entryHashes.length === 0) return ZERO;Caller currently avoids committing empty batches, and contract rejects zero root. Still, returning a valid-looking 64-char hex string makes accidental misuse easier.

Why dangerous

A zero root can be confused with a legitimate root in off-chain tools. In audit systems, invalid states should fail closed.

Reproduce / test case

tscomputeMerkleRoot([]) === "0000..."Suggested fix

Either:

throw on empty input, orsplit APIs:tscomputeMerkleRootNonEmpty(entryHashes)emptyRootForDisplayOnly()Medium-2 — Odd leaf handling comment is incorrect / ambiguousFile + function

backend/src/infrastructure/audit/merkle.util.tscomment line says “odd node out is promoted (hashed with itself)”implementation duplicates leaf as sibling:tsconst right = i + 1 < level.length ? level[i + 1] : level[i];next.push(hashPair(left, right));Bug / risk

Implementation hashes odd leaf with itself. That is not promotion in the strict sense. It is duplicate-last hashing.

Why dangerous

Merkle proofs are algorithm-sensitive. Incorrect documentation causes future Solidity verifier/test vectors to implement promotion instead of duplicate hashing.

Reproduce / test case

For 3 leaves:

duplicate-last root differs from promote-up root.Suggested fix

Change comment to:

textodd node out is duplicated and hashPair(x, x) is usedAdd test vector for 3 leaves.

Medium-3 — Sorted pairs make proofs order-independent but weaken ability to prove batch order/indexFile + function

backend/src/infrastructure/audit/merkle.util.tshashPair()buildMerkleProof()Bug / risk

Pairs are sorted:

tsconst [lo, hi] = a.toLowerCase() <= b.toLowerCase() ? [a, b] : [b, a];This simplifies proofs because no left/right flag is needed. However, proof no longer proves the exact leaf position/index in the tree.

Because entryHash includes seq, this is partially mitigated. But the Merkle proof itself does not bind the index.

Why dangerous

If audit verification needs to prove “this was log sequence 123 inside batch 5 at ordered position 7”, sorted Merkle proofs alone do not prove position.

Reproduce / test case

Swap adjacent leaves in input and recompute with sorted pairs. Some tree levels may remain same depending structure/pairs. For exact order proofs, you need index/direction.

Suggested fix

Either:

Keep sorted pairs and document that order is proven by entryHash.seq and hash-chain, not by Merkle proof, orSwitch to directional proofs:tsproof: { sibling: bytes32, position: 'left' | 'right' }[]For clinical audit, directional is more explicit.

Medium-4 — recordActionAsSuperAdmin() uses non-canonical JSON.stringify()File + function

backend/src/infrastructure/blockchain/blockchain.service.tsrecordActionAsSuperAdmin()Bug / risk

tsconst canonicalPayload = JSON.stringify(actionPayload);const actionHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalPayload));This bypasses canonicalize() and key sorting.

Why dangerous

Same logical action with different key order produces different actionHash. If this is used for audit trail or identity registry events, verification can be inconsistent.

Reproduce / test case

tsJSON.stringify({ a: 1, b: 2 }) !== JSON.stringify({ b: 2, a: 1 })Suggested fix

Use shared canonicalizer:

tsconst canonicalPayload = canonicalize(actionPayload);Also domain-separate:

tskeccak256(toUtf8Bytes(KLTN_ACTION_V1:${canonicalPayload}))Medium-5 — Contract event metadata is minimal and not strongly bound to backend batch rangeFile + function

blockchain/contracts/AuditAnchor.solevent RootCommitted(...)Current event:

solidityevent RootCommitted(uint256 indexed batchId, bytes32 root, uint256 leafCount, uint256 timestamp);Bug / risk

Event does not include:

algorithm versionfromSeq/toSeqchain/domain IDschema versionBackend stores fromSeq/toSeq in DB, but on-chain event/root does not bind this metadata.

Why dangerous

If DB is unavailable or disputed, on-chain data alone cannot say what sequence range the root claims to cover.

Suggested fix

For v2:

solidityevent RootCommitted(uint256 indexed batchId,bytes32 indexed root,uint256 leafCount,uint256 fromSeq,uint256 toSeq,bytes32 algorithm,uint256 timestamp);Keep no PII.

Medium-6 — On-chain tx success is based on tx.wait() but receipt status is not checked explicitlyFile + function

backend/src/infrastructure/blockchain/blockchain.service.tscommitAuditRoot()Bug / risk

Ethers tx.wait() usually throws on revert, but explicit receipt.status === 1 is safer and clearer.

Why dangerous

Incorrectly marking audit batch as anchored would be severe.

Suggested fix

tsconst receipt = await tx.wait();if (!receipt || receipt.status !== 1) {return { success: false, error: 'Audit root transaction failed' };}Low FindingsLow-1 — Solidity uses require strings instead of custom errorsFile + function

blockchain/contracts/AuditAnchor.solRisk

Not a security bug. Custom errors reduce gas and improve typed testing.

Suggested fix

solidityerror NotOwner();error EmptyRoot();error EmptyBatch();error BatchAlreadyCommitted(uint256 batchId);error NonSequentialBatch(uint256 expected, uint256 got);Low-2 — AuditAnchor has no batch metadata getter for latest range/statusFile + function

blockchain/contracts/AuditAnchor.solRisk

Frontend/admin tooling must combine DB and chain to inspect state.

Suggested fix

If v2 stores fromSeq/toSeq/algorithm, expose them in getCheckpoint().

Low-3 — Merkle proof API returns proof as hex strings without strong validationFile + function

backend/src/infrastructure/audit/merkle.util.tsverifyMerkleProof()Risk

Invalid sibling strings still flow into hashPair(). It will hash arbitrary strings.

Suggested fix

Validate all inputs:

ts/^[0-9a-f]{64}$/iReject invalid leaf/proof/root.

Positive ObservationsGood-1 — On-chain data is currently hash-onlyAuditAnchor.sol stores only:

soliditybytes32 root;uint256 leafCount;uint256 timestamp;bool exists;No PII, diagnosis, file URLs, or medical text are stored on-chain.

Good-2 — Duplicate batch overwrite is preventedsolidityrequire(!checkpoints[batchId].exists, "AuditAnchor: batch already committed");This prevents direct root overwrite for same batch ID.

Good-3 — BlockchainLogger has append-only DB triggerAuditAnchorService.ensureAppendOnlyTrigger() prevents DELETE and content-column UPDATE on BlockchainLogger.

Allowed mutation is anchoring metadata only:

onChainStatustxHashblockNumberbatchIdThis is appropriate.

Good-4 — Entry hash includes previous hash and key metadatacomputeEntryHash() includes:

seqactorIdactionentityentityIddataHashcreatedAtIsoprevHashThis provides hash-chain continuity and binds log identity to entity/action.

Test Coverage GapsCurrent blockchain/test/audit.test.js covers:

owner derived from IdentityRegistrycommit/read rootduplicate batch rejectionempty root/batch rejectionnon-owner rejectionMissing tests requested by user:

Backend unit testsAdd tests for merkle.util.ts:

deterministic root:same inputs => same root.input order:if order matters, swapped leaves => expected behavior documented.empty tree:should throw or return zero by explicit policy.one leaf:proof should be [].verification should pass.odd leaves:3 leaves root test vector.duplicate leaves:duplicate leaves do not crash.tampered leaf fails.tampered proof fails.wrong root fails.invalid hex strings rejected.Backend vs Solidity test vectorsOnce Solidity verifier exists:

Generate static vector in JS/TS.Verify in Solidity.Include:1 leaf2 leaves3 leavesduplicate leavestampered proofIntegration testsCreate Visit and verify BlockchainLogger row.Create MedicalConclusion and verify:BlockchainLogger.entity = MedicalConclusiondataHash exists.beforeJson/afterJson does not contain diagnosis/treatment/free text if policy says no sensitive audit payload.Call anchorNow().Confirm:AuditBatch.status = ANCHOREDlogs get batchIdcontract root equals local rootinclusion proof verifies.Simulate blockchain failure:batch becomes FAILEDlogs remain retryable.Simulate crash recovery:pending batch committed on-chain gets reconciled.Privacy testsSearch serialized on-chain payload and events for:

patient namephonecitizen IDdiagnosistreatment planfile URLCloudinary URLPDF filenameX-Ray/MRI URLExpected: none.

Recommended Merkle Tree Upgrade PlanPhase 1 — Freeze and document current v1Document current algorithm as:

textMERKLE_SHA256_STRING_V1entryHash = lowercase 64-char hex SHA256 stringleaf = SHA256_UTF8("leaf:" + lower(entryHash))pair = SHA256_UTF8("node:" + min(lower(a), lower(b)) + max(lower(a), lower(b)))odd = duplicate last node and pair-hash with itselfroot = lowercase 64-char hexcontract stores bytes32(root)Add test vectors immediately so existing roots remain verifiable.

Phase 2 — Add strict canonical JSONReplace current permissive canonicalizer with strict canonical JSON.

Rules:

Object keys sorted.Dates converted to ISO.Arrays only accepted when caller guarantees deterministic ordering.Reject:undefinedNaNInfinityfunctionssymbolscyclic objectsraw Map/SetConvert:BigInt to string or reject.Prisma Decimal to string.For Visit tree hashing, do not hash raw Prisma include object. Build explicit snapshot:

ts{schema: "VISIT_TREE_HASH_V1",visitId,visitCode,status,patientIdHash,doctorId,orders: orders.sort(by createdAt/id).map(...),results: results.sort(by createdAt/id).map(...),conclusionHash}No PII/free-text if not required.

Phase 3 — Standardize leaf schemaFor audit logs:

ts{schema: "KLTN_AUDIT_LEAF_V2",seq,prevHash,entryHash,entity,entityId,action,actorId,dataHash,createdAtIso}Then hash:

tsentryHash = sha256(canonical(leafCore))merkleLeaf = sha256(bytes("KLTN_AUDIT_LEAF_V2") || bytes32(entryHash))For clinical Visit tree:

ts{schema: "KLTN_VISIT_TREE_LEAF_V1",entityType: "MedicalConclusion",entityId,visitId,action,dataHash,timestamp}Phase 4 — Switch Merkle algorithm to bytes32 v2Backend:

tshashLeaf(entryHashBytes32)hashPair(bytes32 a, bytes32 b)Solidity:

solidityhashLeaf(bytes32 entryHash)hashPair(bytes32 a, bytes32 b)verifyProof(...)Avoid ambiguous string encoding.

Use abi.encodePacked only with fixed-size bytes32 and a fixed domain separator. For dynamic strings, prefer abi.encode.

Safe:

soliditysha256(abi.encodePacked(bytes32Domain, entryHash))sha256(abi.encodePacked(bytes32Domain, lo, hi))Better:

soliditysha256(abi.encode(DOMAIN_LEAF, entryHash))Phase 5 — Add algorithmVersion and compatibilityDB AuditBatch should include:

tsalgorithmVersion: "MERKLE_SHA256_STRING_V1" | "MERKLE_SHA256_BYTES32_V2"Contract v2 event:

solidityevent RootCommitted(uint256 indexed batchId,bytes32 indexed root,uint256 leafCount,uint256 fromSeq,uint256 toSeq,bytes32 algorithm,uint256 timestamp);Compatibility plan:

Existing batches remain v1.New batches use v2 after migration flag.Verification endpoint selects verifier by algorithmVersion.Do not rewrite old roots.Phase 6 — Harden anchoring idempotencyAdd recovery:

tsrecoverPendingBatches()On bootstrap:

Find AuditBatch.status = PENDING.Read on-chain checkpoint.If root matches:mark ANCHOREDstamp logs by fromSeq/toSeqIf not found:mark FAILED after timeoutretry logs.Add DB constraints:

unique batchIdno overlapping anchored sequence rangesBlockchainLogger.batchId set only once.Phase 7 — Transaction-safe audit loggingChange logger API:

tsrecord(params, tx?: Prisma.TransactionClient)Critical workflows must do:

tsawait prisma.$transaction(async (tx) => {const record = await tx.medicalConclusion.create(...);await audit.record({...}, tx);});await auditAnchor.anchorNow();This ensures clinical record and audit log commit atomically.

Priority Fix OrderAdd test vectors for current Merkle v1 before changing anything.Add strict input validation for hex roots/proofs/leaves.Add crash recovery for pending batches.Make audit writes transaction-compatible.Add privacy sanitizer for BlockchainLogger payloads.Deploy AuditAnchor v2 with Solidity verifyProof and algorithm versioning.Migrate new batches to bytes32 v2 Merkle hashing.Add integration tests for Visit/MedicalConclusion audit creation and no sensitive payload leakage.