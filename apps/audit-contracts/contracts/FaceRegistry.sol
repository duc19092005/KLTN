// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIdentityRegistry {
    function owner() external view returns (address);
    function isRelayerOrOwner(address wallet) external view returns (bool);
}

/**
 * @title FaceRegistry
 * @notice On-chain anchor for the integrity hash of each user's enrolled face template.
 *         key   = keccak256(userId)              (off-chain UUID -> fixed 32 bytes)
 *         value = SHA256(canonical face embedding JSON)   (computed off-chain by the backend)
 *
 *         IMPORTANT: only the HASH of the biometric template is stored here, never the raw
 *         128D embedding. This protects privacy (raw biometrics must never live on an
 *         immutable public ledger) and keeps gas low. The hash lets the backend detect if
 *         the encrypted template in the database was swapped/altered: on login the backend
 *         recomputes SHA256 of the stored template and compares it to this on-chain value.
 *         A mismatch means the DB template was tampered with -> block the scan.
 *
 *         This integrity gate is SEPARATE from biometric matching (Euclidean distance of a
 *         live scan vs the stored template); both are required. Ownership defers to
 *         IdentityRegistry so an authorized backend relayer can write operational hashes
 *         without holding the root owner key.
 */
contract FaceRegistry {
    IIdentityRegistry public immutable identityRegistry;

    struct FaceRecord {
        bytes32 hash;                 // SHA256(face embedding JSON), mirrored from off-chain
        bytes32 recoveryArtifactHash; // SHA256(encrypted IPFS artifact bytes), Admin only
        string recoveryArtifactUri;   // Content-addressed ipfs:// URI, never plaintext biometrics
        bool isActive;                // true while enrolled; false once removed
        uint256 updatedAt;            // block timestamp of the last write
    }

    // key (keccak256 of userId) => record
    mapping(bytes32 => FaceRecord) private records;

    event FaceHashSet(bytes32 indexed key, bytes32 value, uint256 timestamp);
    event FaceRecoverySet(
        bytes32 indexed key,
        bytes32 faceHash,
        bytes32 artifactHash,
        string artifactUri,
        uint256 timestamp
    );
    event FaceHashRemoved(bytes32 indexed key, uint256 timestamp);

    modifier onlyWriter() {
        require(identityRegistry.isRelayerOrOwner(msg.sender), "FaceRegistry: caller is not writer");
        _;
    }

    constructor(address identityRegistryAddress) {
        require(identityRegistryAddress != address(0), "FaceRegistry: zero registry");
        identityRegistry = IIdentityRegistry(identityRegistryAddress);
    }

    /// @notice The effective owner, sourced from IdentityRegistry.
    function owner() external view returns (address) {
        return identityRegistry.owner();
    }

    /// @notice Create or update the face-template integrity hash for a user (on enrollment).
    function setFaceHash(bytes32 key, bytes32 value) external onlyWriter {
        require(key != bytes32(0), "FaceRegistry: empty key");
        require(value != bytes32(0), "FaceRegistry: empty value");
        require(
            records[key].recoveryArtifactHash == bytes32(0),
            "FaceRegistry: recovery record is protected"
        );
        records[key] = FaceRecord({
            hash: value,
            recoveryArtifactHash: bytes32(0),
            recoveryArtifactUri: "",
            isActive: true,
            updatedAt: block.timestamp
        });
        emit FaceHashSet(key, value, block.timestamp);
    }

    /// @notice Atomically anchor an Admin face hash and its encrypted IPFS recovery artifact.
    /// @dev The URI is content-addressed metadata only. Biometric ciphertext and keys stay off-chain.
    function setFaceRecovery(
        bytes32 key,
        bytes32 faceHash,
        bytes32 artifactHash,
        string calldata artifactUri
    ) external onlyWriter {
        require(key != bytes32(0), "FaceRegistry: empty key");
        require(faceHash != bytes32(0), "FaceRegistry: empty value");
        require(artifactHash != bytes32(0), "FaceRegistry: empty artifact hash");
        require(!records[key].isActive, "FaceRegistry: record already active");
        uint256 uriLength = bytes(artifactUri).length;
        require(uriLength > 0 && uriLength <= 256, "FaceRegistry: invalid artifact uri");

        records[key] = FaceRecord({
            hash: faceHash,
            recoveryArtifactHash: artifactHash,
            recoveryArtifactUri: artifactUri,
            isActive: true,
            updatedAt: block.timestamp
        });
        emit FaceHashSet(key, faceHash, block.timestamp);
        emit FaceRecoverySet(key, faceHash, artifactHash, artifactUri, block.timestamp);
    }

    /// @notice Remove the face hash (e.g. when biometric enrollment is reset).
    function removeFaceHash(bytes32 key) external onlyWriter {
        require(records[key].isActive, "FaceRegistry: key not found");
        records[key].hash = bytes32(0);
        records[key].recoveryArtifactHash = bytes32(0);
        records[key].recoveryArtifactUri = "";
        records[key].isActive = false;
        records[key].updatedAt = block.timestamp;
        emit FaceHashRemoved(key, block.timestamp);
    }

    /// @notice Read the stored face hash. Returns bytes32(0) if not set or removed.
    function getFaceHash(bytes32 key) external view returns (bytes32) {
        return records[key].hash;
    }

    /// @notice Whether a face hash currently exists (is active) for the key.
    function hasFaceHash(bytes32 key) external view returns (bool) {
        return records[key].isActive;
    }

    /// @notice Read the trusted Admin recovery checkpoint for a face record.
    function getFaceRecovery(bytes32 key)
        external
        view
        returns (
            bytes32 faceHash,
            bytes32 artifactHash,
            string memory artifactUri,
            bool isActive,
            uint256 updatedAt
        )
    {
        FaceRecord storage r = records[key];
        return (r.hash, r.recoveryArtifactHash, r.recoveryArtifactUri, r.isActive, r.updatedAt);
    }

    /// @notice Full record: hash, active flag, and on-chain last-updated timestamp.
    function getRecord(bytes32 key)
        external
        view
        returns (bytes32 hash, bool isActive, uint256 updatedAt)
    {
        FaceRecord storage r = records[key];
        return (r.hash, r.isActive, r.updatedAt);
    }
}
