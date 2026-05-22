// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IdentityRegistry.sol";

/**
 * @title AiModelRegistry
 * @notice Manages AI Model IP hashes on blockchain
 * @dev Implements mapping(modelId => mapping(modelHash => bool isActive))
 */
contract AiModelRegistry {
    IdentityRegistry public identityRegistry;

    // modelId => (modelHash => isActive)
    mapping(string => mapping(string => bool)) public modelHashes;

    // Events
    event ModelRegistered(
        string indexed modelId,
        string modelHash,
        uint256 timestamp
    );
    
    event ModelHashAdded(
        string indexed modelId,
        string modelHash,
        uint256 timestamp
    );
    
    event ModelHashDeactivated(
        string indexed modelId,
        string modelHash,
        uint256 timestamp
    );
    
    event ModelHashActivated(
        string indexed modelId,
        string modelHash,
        uint256 timestamp
    );

    modifier onlyAdmin() {
        require(msg.sender == identityRegistry.admin(), "AiModelRegistry: caller is not admin");
        _;
    }

    constructor(address _identityRegistry) {
        require(_identityRegistry != address(0), "AiModelRegistry: zero identity registry");
        identityRegistry = IdentityRegistry(_identityRegistry);
    }

    /**
     * @notice Get the shared admin from IdentityRegistry
     */
    function admin() external view returns (address) {
        return identityRegistry.admin();
    }

    /**
     * @notice Register a model hash on-chain
     * @param _modelId Unique identifier for the model
     * @param _modelHash SHA-256 hash of the protected endpoint
     */
    function registerModel(
        string memory _modelId,
        string memory _modelHash
    ) external onlyAdmin {
        require(bytes(_modelId).length > 0, "AiModelRegistry: empty modelId");
        require(bytes(_modelHash).length > 0, "AiModelRegistry: empty modelHash");
        require(!modelHashes[_modelId][_modelHash], "AiModelRegistry: hash already exists");

        modelHashes[_modelId][_modelHash] = true;

        emit ModelRegistered(_modelId, _modelHash, block.timestamp);
    }

    /**
     * @notice Add a new model hash
     * @param _modelId The model ID
     * @param _modelHash New SHA-256 hash to add
     */
    function addModelHash(
        string memory _modelId,
        string memory _modelHash
    ) external onlyAdmin {
        require(bytes(_modelId).length > 0, "AiModelRegistry: empty modelId");
        require(bytes(_modelHash).length > 0, "AiModelRegistry: empty modelHash");
        require(!modelHashes[_modelId][_modelHash], "AiModelRegistry: hash already exists");

        modelHashes[_modelId][_modelHash] = true;

        emit ModelHashAdded(_modelId, _modelHash, block.timestamp);
    }

    /**
     * @notice Deactivate a model hash
     * @param _modelId The model ID
     * @param _modelHash SHA-256 hash to deactivate
     */
    function deactivateModelHash(
        string memory _modelId,
        string memory _modelHash
    ) external onlyAdmin {
        require(modelHashes[_modelId][_modelHash], "AiModelRegistry: hash not active");

        modelHashes[_modelId][_modelHash] = false;

        emit ModelHashDeactivated(_modelId, _modelHash, block.timestamp);
    }

    /**
     * @notice Reactivate a previously deactivated IP hash
     * @param _modelId The model ID
     * @param _modelHash SHA-256 hash to reactivate
     */
    function activateModelHash(
        string memory _modelId,
        string memory _modelHash
    ) external onlyAdmin {
        require(bytes(_modelId).length > 0, "AiModelRegistry: empty modelId");
        require(bytes(_modelHash).length > 0, "AiModelRegistry: empty modelHash");
        require(!modelHashes[_modelId][_modelHash], "AiModelRegistry: hash already active");

        modelHashes[_modelId][_modelHash] = true;

        emit ModelHashActivated(_modelId, _modelHash, block.timestamp);
    }

    /**
     * @notice Check if a model hash is active
     * @param _modelId The model ID
     * @param _modelHash SHA-256 hash to check
     * @return bool True if the hash is active
     */
    function isModelHashActive(
        string memory _modelId,
        string memory _modelHash
    ) external view returns (bool) {
        return modelHashes[_modelId][_modelHash];
    }

}
