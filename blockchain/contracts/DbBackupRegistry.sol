// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract DbBackupRegistry is ERC721URIStorage, Ownable {
    uint256 private _tokenIds;

    struct BackupRecord {
        string ipfsCID;        // IPFS CID of the encrypted Daily Backup file
        bytes32 fileHash;      // SHA-256 hash of the file for integrity verification
        uint256 timestamp;     // Creation timestamp
    }

    // Mapping for Daily Full Backup NFTs
    mapping(uint256 => BackupRecord) public dailyBackups;
    
    // Mapping for Hourly WAL / Incremental backup CIDs (dateKey => array of CIDs)
    // Example: "2026-05-23" => ["CID_1", "CID_2", ...]
    mapping(string => string[]) private _hourlyBackups;

    event DailyBackupMinted(uint256 indexed tokenId, string ipfsCID, bytes32 fileHash);
    event HourlyBackupAdded(string indexed dateKey, string ipfsCID, uint256 timestamp);

    constructor() ERC721("Hospital DB Backup NFT", "HOSP-BACKUP") Ownable(msg.sender) {}

    /**
     * @dev Mints an NFT representing a Full Daily Database Backup.
     */
    function mintBackupNFT(
        address to, 
        string memory tokenURI, 
        string memory ipfsCID, 
        bytes32 fileHash
    ) public onlyOwner returns (uint256) {
        _tokenIds++;
        uint256 newItemId = _tokenIds;
        
        _mint(to, newItemId);
        _setTokenURI(newItemId, tokenURI);

        dailyBackups[newItemId] = BackupRecord({
            ipfsCID: ipfsCID,
            fileHash: fileHash,
            timestamp: block.timestamp
        });

        emit DailyBackupMinted(newItemId, ipfsCID, fileHash);
        return newItemId;
    }

    /**
     * @dev Registers an hourly WAL/Incremental Backup CID.
     */
    function addHourlyBackup(string memory dateKey, string memory ipfsCID) public onlyOwner {
        _hourlyBackups[dateKey].push(ipfsCID);
        emit HourlyBackupAdded(dateKey, ipfsCID, block.timestamp);
    }

    /**
     * @dev Retrieves all hourly backup CIDs for a specific date.
     */
    function getHourlyBackups(string memory dateKey) public view returns (string[] memory) {
        return _hourlyBackups[dateKey];
    }
}
