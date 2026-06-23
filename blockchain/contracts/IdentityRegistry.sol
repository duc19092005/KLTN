// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IdentityRegistry {
    address public owner;
    address public pendingOwner;
    mapping(address => bool) private authorizedAdmins;
    mapping(address => bool) private authorizedRelayers;

    event AdminAuthorized(address indexed wallet);
    event AdminRevoked(address indexed wallet);
    event RelayerAuthorized(address indexed wallet);
    event RelayerRevoked(address indexed wallet);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ActionRecorded(bytes32 indexed actionHash, address indexed signer);

    modifier onlyOwner() {
        require(msg.sender == owner, "IdentityRegistry: caller is not owner");
        _;
    }

    modifier onlyRelayerOrOwner() {
        require(msg.sender == owner || authorizedRelayers[msg.sender], "IdentityRegistry: caller is not relayer");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function authorizeAdmin(address wallet) external onlyRelayerOrOwner {
        require(wallet != address(0), "IdentityRegistry: zero wallet");
        require(!authorizedAdmins[wallet], "IdentityRegistry: already authorized");
        authorizedAdmins[wallet] = true;
        emit AdminAuthorized(wallet);
    }

    function revokeAdmin(address wallet) external onlyRelayerOrOwner {
        require(wallet != address(0), "IdentityRegistry: zero wallet");
        require(authorizedAdmins[wallet], "IdentityRegistry: not authorized");
        authorizedAdmins[wallet] = false;
        emit AdminRevoked(wallet);
    }

    function isAuthorized(address wallet) external view returns (bool) {
        return authorizedAdmins[wallet];
    }

    function addRelayer(address wallet) external onlyOwner {
        require(wallet != address(0), "IdentityRegistry: zero relayer");
        require(!authorizedRelayers[wallet], "IdentityRegistry: relayer already authorized");
        authorizedRelayers[wallet] = true;
        emit RelayerAuthorized(wallet);
    }

    function removeRelayer(address wallet) external onlyOwner {
        require(wallet != address(0), "IdentityRegistry: zero relayer");
        require(authorizedRelayers[wallet], "IdentityRegistry: relayer not authorized");
        authorizedRelayers[wallet] = false;
        emit RelayerRevoked(wallet);
    }

    function isRelayer(address wallet) external view returns (bool) {
        return authorizedRelayers[wallet];
    }

    function isRelayerOrOwner(address wallet) external view returns (bool) {
        return wallet == owner || authorizedRelayers[wallet];
    }

    function recordAction(bytes32 actionHash) external onlyRelayerOrOwner {
        require(actionHash != bytes32(0), "IdentityRegistry: empty action hash");
        emit ActionRecorded(actionHash, msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "IdentityRegistry: zero owner");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "IdentityRegistry: caller is not pending owner");
        address oldOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(oldOwner, msg.sender);
    }
}
