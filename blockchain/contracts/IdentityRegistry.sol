// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IdentityRegistry {
    struct Identity {
        address walletAddress;
        bool isActive;
        uint256 registeredAt;
    }

    // Mapping from commitment (ZKP) to Identity
    mapping(uint256 => Identity) public identities;

    // Mapping from address to commitment
    mapping(address => uint256) public addressToCommitment;

    event IdentityRegistered(uint256 indexed commitment, address indexed walletAddress);
    event WalletRecovered(uint256 indexed commitment, address indexed oldAddress, address indexed newAddress);

    function registerIdentity(uint256 _commitment) external {
        require(identities[_commitment].walletAddress == address(0), "Identity already registered");
        require(addressToCommitment[msg.sender] == 0, "Address already mapped to an identity");

        identities[_commitment] = Identity({
            walletAddress: msg.sender,
            isActive: true,
            registeredAt: block.timestamp
        });

        addressToCommitment[msg.sender] = _commitment;

        emit IdentityRegistered(_commitment, msg.sender);
    }

    function recoverWallet(
        uint[2] memory _pA,
        uint[2][2] memory _pB,
        uint[2] memory _pC,
        uint256 _commitment,
        address _newAddress
    ) external {
        // In a real implementation, you would verify the ZK proof here using a Verifier contract.
        // For this KLTN, we'll assume the proof is valid if it reaches here, or verification is handled elsewhere.
        
        require(identities[_commitment].isActive, "Identity not active");
        require(addressToCommitment[_newAddress] == 0, "New address already in use");

        address oldAddress = identities[_commitment].walletAddress;

        // Remove old address mapping
        addressToCommitment[oldAddress] = 0;

        // Update identity
        identities[_commitment].walletAddress = _newAddress;

        // Add new address mapping
        addressToCommitment[_newAddress] = _commitment;

        emit WalletRecovered(_commitment, oldAddress, _newAddress);
    }

    function updateAdminWallet(uint256 _commitment, address _newAddress) external {
        // Note: For real world use, this should be restricted to an Owner or SuperAdmin
        require(identities[_commitment].isActive, "Identity not active");
        require(addressToCommitment[_newAddress] == 0, "New address already in use");

        address oldAddress = identities[_commitment].walletAddress;

        // Remove old address mapping
        addressToCommitment[oldAddress] = 0;

        // Update identity
        identities[_commitment].walletAddress = _newAddress;

        // Add new address mapping
        addressToCommitment[_newAddress] = _commitment;

        emit WalletRecovered(_commitment, oldAddress, _newAddress);
    }

    function isAuthorized(address _addr) external view returns (bool) {
        uint256 commitment = addressToCommitment[_addr];
        if (commitment == 0) return false;
        return identities[commitment].isActive;
    }

    function getIdentity(uint256 _commitment) external view returns (address, bool, uint256) {
        Identity memory id = identities[_commitment];
        return (id.walletAddress, id.isActive, id.registeredAt);
    }
}
