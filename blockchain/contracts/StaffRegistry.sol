// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIdentityRegistry {
    function owner() external view returns (address);
}

/**
 * @title StaffRegistry
 * @notice On-chain key-value store anchoring the integrity hash of each staff member
 *         (both StaffProfile and DoctorProfile share this contract).
 *         Ownership defers to IdentityRegistry.
 */
contract StaffRegistry {
    IIdentityRegistry public immutable identityRegistry;

    struct StaffRecord {
        bytes32 hash;
        bool isActive;
        uint256 updatedAt;
    }

    mapping(bytes32 => StaffRecord) private records;

    event HashSet(bytes32 indexed key, bytes32 value, uint256 timestamp);
    event HashRemoved(bytes32 indexed key, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == identityRegistry.owner(), "StaffRegistry: caller is not owner");
        _;
    }

    constructor(address identityRegistryAddress) {
        require(identityRegistryAddress != address(0), "StaffRegistry: zero registry");
        identityRegistry = IIdentityRegistry(identityRegistryAddress);
    }

    function owner() external view returns (address) {
        return identityRegistry.owner();
    }

    function setHash(bytes32 key, bytes32 value) external onlyOwner {
        require(key != bytes32(0), "StaffRegistry: empty key");
        require(value != bytes32(0), "StaffRegistry: empty value");
        records[key] = StaffRecord({ hash: value, isActive: true, updatedAt: block.timestamp });
        emit HashSet(key, value, block.timestamp);
    }

    function removeHash(bytes32 key) external onlyOwner {
        require(records[key].isActive, "StaffRegistry: key not found");
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
        StaffRecord storage r = records[key];
        return (r.hash, r.isActive, r.updatedAt);
    }
}
