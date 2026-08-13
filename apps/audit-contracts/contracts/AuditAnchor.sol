// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIdentityRegistry {
    function owner() external view returns (address);
    function isRelayerOrOwner(address wallet) external view returns (bool);
}

/**
 * @title AuditAnchor
 * @notice Canonical append-only Merkle root anchor for audit logs. Individual logs, PII,
 *         medical text, files, PDFs and X-Rays are never stored on-chain. Only batch
 *         roots, counts and timestamps are committed.
 */
contract AuditAnchor {
    IIdentityRegistry public immutable identityRegistry;

    // Canonical domain labels. Do not change after deployment; backend Merkle utilities use
    // the same byte strings to produce roots/proofs verified by this contract.
    string private constant LEAF_DOMAIN = "KLTN_AUDIT_LEAF_V2";
    string private constant NODE_DOMAIN = "KLTN_AUDIT_NODE_V2";

    struct Checkpoint {
        bytes32 merkleRoot;
        bytes32 artifactHash;
        string artifactUri;
        uint256 leafCount;
        uint256 timestamp;
        bool committed;
    }

    // batchId => committed Merkle checkpoint
    mapping(uint256 => Checkpoint) private checkpoints;
    uint256 public latestBatchId;
    uint256 public totalBatches;

    event CheckpointCommitted(
        uint256 indexed batchId,
        bytes32 merkleRoot,
        bytes32 artifactHash,
        string artifactUri,
        uint256 leafCount,
        uint256 timestamp
    );

    modifier onlyWriter() {
        require(identityRegistry.isRelayerOrOwner(msg.sender), "AuditAnchor: caller is not writer");
        _;
    }

    constructor(address identityRegistryAddress) {
        require(identityRegistryAddress != address(0), "AuditAnchor: zero registry");
        identityRegistry = IIdentityRegistry(identityRegistryAddress);
    }

    /// @notice The effective owner, sourced from IdentityRegistry.
    function owner() external view returns (address) {
        return identityRegistry.owner();
    }

    /// @notice Commit the Merkle root of a sealed batch of audit logs.
    /// @param batchId Monotonic batch identifier assigned off-chain.
    /// @param merkleRoot Merkle root over the batch's leaves.
    /// @param leafCount Number of leaves included.
    /// @param artifactHash SHA-256 hash of the encrypted IPFS artifact bytes.
    /// @param artifactUri Content-addressed IPFS URI for recovery.
    function commitCheckpoint(
        uint256 batchId,
        bytes32 merkleRoot,
        uint256 leafCount,
        bytes32 artifactHash,
        string calldata artifactUri
    ) external onlyWriter {
        require(merkleRoot != bytes32(0), "AuditAnchor: empty root");
        require(artifactHash != bytes32(0), "AuditAnchor: empty artifact hash");
        require(bytes(artifactUri).length > 0, "AuditAnchor: empty artifact uri");
        require(leafCount > 0, "AuditAnchor: empty batch");
        require(!checkpoints[batchId].committed, "AuditAnchor: batch already committed");
        require(batchId == latestBatchId + 1, "AuditAnchor: non-sequential batch");

        checkpoints[batchId] = Checkpoint({
            merkleRoot: merkleRoot,
            artifactHash: artifactHash,
            artifactUri: artifactUri,
            leafCount: leafCount,
            timestamp: block.timestamp,
            committed: true
        });

        latestBatchId = batchId;
        totalBatches += 1;

        emit CheckpointCommitted(batchId, merkleRoot, artifactHash, artifactUri, leafCount, block.timestamp);
    }

    /// @notice Solidity-side canonical leaf hash. Matches backend MERKLE_SHA256_BYTES32_V2.
    function hashLeaf(bytes32 entryHash) public pure returns (bytes32) {
        return sha256(abi.encodePacked(LEAF_DOMAIN, entryHash));
    }

    /// @notice Solidity-side canonical pair hash. Sorted pairs keep proofs order-independent.
    function hashPair(bytes32 a, bytes32 b) public pure returns (bytes32) {
        (bytes32 lo, bytes32 hi) = a <= b ? (a, b) : (b, a);
        return sha256(abi.encodePacked(NODE_DOMAIN, lo, hi));
    }

    /// @notice Verify that entryHash belongs to an anchored canonical Merkle root.
    function verifyProof(uint256 batchId, bytes32 entryHash, bytes32[] calldata proof) external view returns (bool) {
        Checkpoint storage cp = checkpoints[batchId];
        if (!cp.committed) return false;

        bytes32 acc = hashLeaf(entryHash);
        for (uint256 i = 0; i < proof.length; i++) {
            acc = hashPair(acc, proof[i]);
        }
        return acc == cp.merkleRoot;
    }

    /// @notice Read the Merkle root for a batch. Returns bytes32(0) if not committed.
    function getRoot(uint256 batchId) external view returns (bytes32) {
        return checkpoints[batchId].merkleRoot;
    }

    struct CheckpointSummary {
        uint256 batchId;
        bytes32 merkleRoot;
        bytes32 artifactHash;
        string artifactUri;
        uint256 leafCount;
        uint256 timestamp;
        bool committed;
    }

    /// @notice Full checkpoint details for a batch.
    function getCheckpoint(uint256 batchId)
        external
        view
        returns (
            bytes32 merkleRoot,
            bytes32 artifactHash,
            string memory artifactUri,
            uint256 leafCount,
            uint256 timestamp,
            bool committed
        )
    {
        Checkpoint storage cp = checkpoints[batchId];
        return (cp.merkleRoot, cp.artifactHash, cp.artifactUri, cp.leafCount, cp.timestamp, cp.committed);
    }

    /// @notice Fetch a range of batch checkpoints for audit recovery and DB synchronization.
    /// @param fromBatchId Starting batch ID (inclusive).
    /// @param toBatchId Ending batch ID (inclusive).
    function getCheckpointsRange(uint256 fromBatchId, uint256 toBatchId)
        external
        view
        returns (CheckpointSummary[] memory items)
    {
        if (fromBatchId == 0 || toBatchId < fromBatchId || latestBatchId < fromBatchId) {
            return new CheckpointSummary[](0);
        }

        uint256 end = toBatchId > latestBatchId ? latestBatchId : toBatchId;
        uint256 count = end - fromBatchId + 1;
        items = new CheckpointSummary[](count);

        for (uint256 i = 0; i < count; i++) {
            uint256 bId = fromBatchId + i;
            Checkpoint storage cp = checkpoints[bId];
            items[i] = CheckpointSummary({
                batchId: bId,
                merkleRoot: cp.merkleRoot,
                artifactHash: cp.artifactHash,
                artifactUri: cp.artifactUri,
                leafCount: cp.leafCount,
                timestamp: cp.timestamp,
                committed: cp.committed
            });
        }
    }
}
