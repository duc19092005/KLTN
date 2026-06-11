**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# Standalone Tools

Two static HTML tools for **emergencies when the server or DB cannot be trusted**. Both run entirely in the browser, no backend required.

## Quick comparison

| Criterion | [break-glass-viewer](./break-glass-viewer/README.en.md) | [recovery-signer](./recovery-signer/README.en.md) |
|---|---|---|
| **Purpose** | Read + verify the backup ledger | Sign a challenge to restore the DB |
| **Behavior** | Read-only | Write (produces a Web3 signature) |
| **Input** | A `backup-ledger.jsonl` file | An `EMERGENCY_..._CHALLENGE:...` string |
| **Output** | INTACT/ABNORMAL report | Hex signature `0x...` |
| **Requires** | Browser only | Browser + MetaMask + Admin wallet |
| **Internet** | Not required | Not required |
| **Who uses it** | Any auditor | Admin holding the Superadmin wallet only |
| **Where it lives** | Same offsite volume as the ledger | Admin USB / private GitHub Pages |

## Which one to use

```text
Need to verify that the backup ledger has not been altered?
    └─→ break-glass-viewer

Need to restore the entire DB after it was wiped/encrypted?
    └─→ recovery-signer + npm run db:emergency-restore

Only a few records are tampered and the Admin UI still works?
    └─→ Surgical Restore at /admin/backup (do NOT use these tools)
```

## Related docs

- [Backup & Recovery overview](../docs/backup-recovery/overview.md)
- [Step-by-step Emergency Restore guide](../docs/backup-recovery/emergency-restore.md)
