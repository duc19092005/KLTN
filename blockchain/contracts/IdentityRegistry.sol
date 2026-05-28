// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IdentityRegistry {
    address public owner;
    address public pendingOwner;
    mapping(address => bool) private authorizedAdmins;

    event AdminAuthorized(address indexed wallet);
    event AdminRevoked(address indexed wallet);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "IdentityRegistry: caller is not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function authorizeAdmin(address wallet) external onlyOwner {
        require(wallet != address(0), "IdentityRegistry: zero wallet");
        require(!authorizedAdmins[wallet], "IdentityRegistry: already authorized");
        authorizedAdmins[wallet] = true;
        emit AdminAuthorized(wallet);
    }

    function revokeAdmin(address wallet) external onlyOwner {
        require(wallet != address(0), "IdentityRegistry: zero wallet");
        require(authorizedAdmins[wallet], "IdentityRegistry: not authorized");
        authorizedAdmins[wallet] = false;
        emit AdminRevoked(wallet);
    }

    function isAuthorized(address wallet) external view returns (bool) {
        return authorizedAdmins[wallet];
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
