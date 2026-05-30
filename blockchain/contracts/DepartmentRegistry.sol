// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIdentityRegistry {
    function owner() external view returns (address);
}

/**
 * @title DepartmentRegistry
 * @notice On-chain key-value store anchoring the integrity hash of each department.
 *         key   = keccak256(departmentId)         (off-chain UUID -> fixed 32 bytes)
 *         value = SHA256(canonicalData + salt)      (computed off-chain by the backend)
 *
 *         Each key maps to a single DepartmentRecord struct holding the integrity hash,
 *         an isActive flag (false once removed, distinguishing "removed" from "never set"),
 *         and the on-chain updatedAt timestamp of the last write.
 *
 *         Ownership is NOT managed here. This contract defers to IdentityRegistry as the
 *         single source of truth for who the owner is, so the super-admin relayer that owns
 *         IdentityRegistry is automatically the only account allowed to write.
 */
contract DepartmentRegistry {
    IIdentityRegistry public immutable identityRegistry;

    struct DepartmentRecord {
        bytes32 hash;      // SHA256(data + salt), mirrored from off-chain
        bool isActive;     // true while anchored; false once removed
        uint256 updatedAt; // block timestamp of the last write
    }

    // key (keccak256 of departmentId) => record
    mapping(bytes32 => DepartmentRecord) private records;

    event HashSet(bytes32 indexed key, bytes32 value, uint256 timestamp);
    event HashRemoved(bytes32 indexed key, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == identityRegistry.owner(), "DepartmentRegistry: caller is not owner");
        _;
    }

    constructor(address identityRegistryAddress) {
        require(identityRegistryAddress != address(0), "DepartmentRegistry: zero registry");
        identityRegistry = IIdentityRegistry(identityRegistryAddress);
    }

    /// @notice The effective owner, sourced from IdentityRegistry.
    function owner() external view returns (address) {
        return identityRegistry.owner();
    }

    /// @notice Create or update the integrity hash for a department.
    function setHash(bytes32 key, bytes32 value) external onlyOwner {
        require(key != bytes32(0), "DepartmentRegistry: empty key");
        require(value != bytes32(0), "DepartmentRegistry: empty value");
        records[key] = DepartmentRecord({ hash: value, isActive: true, updatedAt: block.timestamp });
        emit HashSet(key, value, block.timestamp);
    }

    /// @notice Remove the integrity hash (e.g. when the department is deleted).
    function removeHash(bytes32 key) external onlyOwner {
        require(records[key].isActive, "DepartmentRegistry: key not found");
        records[key].hash = bytes32(0);
        records[key].isActive = false;
        records[key].updatedAt = block.timestamp;
        emit HashRemoved(key, block.timestamp);
    }

    /// @notice Read the stored hash. Returns bytes32(0) if not set or removed.
    function getHash(bytes32 key) external view returns (bytes32) {
        return records[key].hash;
    }

    /// @notice Whether a hash currently exists (is active) for the key.
    function hasHash(bytes32 key) external view returns (bool) {
        return records[key].isActive;
    }

    /// @notice Full record: hash, active flag, and on-chain last-updated timestamp.
    function getRecord(bytes32 key)
        external
        view
        returns (bytes32 hash, bool isActive, uint256 updatedAt)
    {
        DepartmentRecord storage r = records[key];
        return (r.hash, r.isActive, r.updatedAt);
    }
}
