// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IdentityRegistry {
    address public owner;
    mapping(address => bool) private authorizedAdmins;

    event AdminAuthorized(address indexed wallet);
    event AdminRevoked(address indexed wallet);
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
        authorizedAdmins[wallet] = true;
        emit AdminAuthorized(wallet);
    }

    function revokeAdmin(address wallet) external onlyOwner {
        authorizedAdmins[wallet] = false;
        emit AdminRevoked(wallet);
    }

    function isAuthorized(address wallet) external view returns (bool) {
        return authorizedAdmins[wallet];
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "IdentityRegistry: zero owner");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
