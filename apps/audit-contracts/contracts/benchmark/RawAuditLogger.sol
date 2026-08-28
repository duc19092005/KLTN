// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RawAuditLogger
 * @notice Benchmark contract representing naive direct on-chain audit logging
 *         where every individual event is written directly to contract storage.
 */
contract RawAuditLogger {
    struct AuditRecord {
        uint256 seq;
        string entity;
        string entityId;
        string action;
        bytes32 dataHash;
        bytes32 entryHash;
        uint256 timestamp;
    }

    mapping(uint256 => AuditRecord) public logs;
    uint256 public totalLogs;

    event AuditLogged(
        uint256 indexed seq,
        string entity,
        string entityId,
        string action,
        bytes32 dataHash,
        bytes32 entryHash,
        uint256 timestamp
    );

    function recordLog(
        uint256 seq,
        string calldata entity,
        string calldata entityId,
        string calldata action,
        bytes32 dataHash,
        bytes32 entryHash
    ) external {
        logs[seq] = AuditRecord({
            seq: seq,
            entity: entity,
            entityId: entityId,
            action: action,
            dataHash: dataHash,
            entryHash: entryHash,
            timestamp: block.timestamp
        });
        totalLogs += 1;
        emit AuditLogged(seq, entity, entityId, action, dataHash, entryHash, block.timestamp);
    }
}