// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIdentityRegistry {
    function owner() external view returns (address);
}

/**
 * @title AuditAnchor
 * @notice Standalone, append-only logger contract shared by many backend services.
 *         To minimise gas, individual audit log entries are NOT stored on-chain.
 *         Instead the backend builds a Merkle binary tree from a batch of log leaves
 *         (each leaf being a domino-chained SHA256 of the change) and commits only the
 *         Merkle ROOT ("đỉnh cây") here.
 *
 *         Ownership is NOT managed here. This contract defers to IdentityRegistry as the
 *         single source of truth for who the owner is, so the super-admin relayer that owns
 *         IdentityRegistry is automatically the only account allowed to commit roots.
 */
contract AuditAnchor {
    IIdentityRegistry public immutable identityRegistry;

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

    modifier onlyOwner() {
        require(msg.sender == identityRegistry.owner(), "AuditAnchor: caller is not owner");
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
    /// @param root    Merkle root over the batch's leaves.
    /// @param leafCount Number of leaves included (for transparency).
    function commitRoot(uint256 batchId, bytes32 root, uint256 leafCount) external onlyOwner {
        require(root != bytes32(0), "AuditAnchor: empty root");
        require(!checkpoints[batchId].exists, "AuditAnchor: batch already committed");
        require(leafCount > 0, "AuditAnchor: empty batch");

        checkpoints[batchId] = Checkpoint({
            root: root,
            leafCount: leafCount,
            timestamp: block.timestamp,
            exists: true
        });

        if (batchId > latestBatchId) latestBatchId = batchId;
        totalBatches += 1;

        emit RootCommitted(batchId, root, leafCount, block.timestamp);
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
