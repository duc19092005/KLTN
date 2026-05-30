// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIdentityRegistry {
    function owner() external view returns (address);
}

/**
 * @title AIModelRegistry
 * @notice On-chain key-value store anchoring the integrity hash of each AI model record.
 *         Ownership defers to IdentityRegistry.
 */
contract AIModelRegistry {
    IIdentityRegistry public immutable identityRegistry;

    struct ModelRecord {
        bytes32 hash;
        bool isActive;
        uint256 updatedAt;
    }

    mapping(bytes32 => ModelRecord) private records;

    event HashSet(bytes32 indexed key, bytes32 value, uint256 timestamp);
    event HashRemoved(bytes32 indexed key, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == identityRegistry.owner(), "AIModelRegistry: caller is not owner");
        _;
    }

    constructor(address identityRegistryAddress) {
        require(identityRegistryAddress != address(0), "AIModelRegistry: zero registry");
        identityRegistry = IIdentityRegistry(identityRegistryAddress);
    }

    function owner() external view returns (address) {
        return identityRegistry.owner();
    }

    function setHash(bytes32 key, bytes32 value) external onlyOwner {
        require(key != bytes32(0), "AIModelRegistry: empty key");
        require(value != bytes32(0), "AIModelRegistry: empty value");
        records[key] = ModelRecord({ hash: value, isActive: true, updatedAt: block.timestamp });
        emit HashSet(key, value, block.timestamp);
    }

    function removeHash(bytes32 key) external onlyOwner {
        require(records[key].isActive, "AIModelRegistry: key not found");
        records[key].hash = bytes32(0);
        records[key].isActive = false;
        records[key].updatedAt = block.timestamp;
        emit HashRemoved(key, block.timestamp);
    }

    function getHash(bytes32 key) external view returns (bytes32) {
        return records[key].hash;
    }

    function hasHash(bytes32 key) external view returns (bool) {
        return records[key].isActive;
    }

    function getRecord(bytes32 key)
        external
        view
        returns (bytes32 hash, bool isActive, uint256 updatedAt)
    {
        ModelRecord storage r = records[key];
        return (r.hash, r.isActive, r.updatedAt);
    }
}
