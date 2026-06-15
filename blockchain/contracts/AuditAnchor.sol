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
        bytes32 root;
        uint256 leafCount;
        uint256 timestamp;
        bool exists;
    }

    // batchId => committed Merkle checkpoint
    mapping(uint256 => Checkpoint) private checkpoints;
    uint256 public latestBatchId;
    uint256 public totalBatches;

    event RootCommitted(uint256 indexed batchId, bytes32 root, uint256 leafCount, uint256 timestamp);

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
    /// @param root Merkle root over the batch's leaves.
    /// @param leafCount Number of leaves included.
    function commitRoot(uint256 batchId, bytes32 root, uint256 leafCount) external onlyWriter {
        require(root != bytes32(0), "AuditAnchor: empty root");
        require(leafCount > 0, "AuditAnchor: empty batch");
        require(!checkpoints[batchId].exists, "AuditAnchor: batch already committed");
        require(batchId == latestBatchId + 1, "AuditAnchor: non-sequential batch");

        checkpoints[batchId] = Checkpoint({
            root: root,
            leafCount: leafCount,
            timestamp: block.timestamp,
            exists: true
        });

        latestBatchId = batchId;
        totalBatches += 1;

        emit RootCommitted(batchId, root, leafCount, block.timestamp);
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
        if (!cp.exists) return false;

        bytes32 acc = hashLeaf(entryHash);
        for (uint256 i = 0; i < proof.length; i++) {
            acc = hashPair(acc, proof[i]);
        }
        return acc == cp.root;
    }

    /// @notice Read the Merkle root for a batch. Returns bytes32(0) if not committed.
    function getRoot(uint256 batchId) external view returns (bytes32) {
        return checkpoints[batchId].root;
    }

    /// @notice Full checkpoint details for a batch.
    function getCheckpoint(uint256 batchId)
        external
        view
        returns (bytes32 root, uint256 leafCount, uint256 timestamp, bool committed)
    {
        Checkpoint storage cp = checkpoints[batchId];
        return (cp.root, cp.leafCount, cp.timestamp, cp.exists);
    }
}
