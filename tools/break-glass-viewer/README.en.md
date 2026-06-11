**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# Break-Glass Backup Ledger Viewer

> Read and verify the backup ledger when the server is unavailable. **Read-only, offline, no backend.**

## Purpose

When the server or database goes down (or is suspected to be compromised), you need an independent way to prove that "the backup history has not been altered." This tool does exactly that:

- Open a single HTML file. **No internet, no backend, no installation.**
- Drop in the `backup-ledger.jsonl` file (the append-only ledger written on every backup).
- The tool runs pure-JavaScript SHA-256 right in the browser to verify:
  1. **Chain linkage:** every line's `prevHash` must match the previous line's `entryHash`. Detects deletions, insertions, and reordering.
  2. **Content integrity (`entryHash`):** if you supply the correct `AUDIT_PEPPER`, the tool recomputes each line's entryHash and compares — detects content tampering.

## When to use it

| Situation | Reason |
|---|---|
| Periodic audit | Prove ledger integrity to an auditor |
| Server down / DB dead | Still verify the backup ledger without any system |
| Suspected insider attack | Spot deleted/altered lines instantly |
| Before trusting a backup | Cross-check the SHA-256 in the ledger against the actual `.sql` dump before restoring |

## Requirements

- Any browser (Chrome, Edge, Firefox, Safari)
- The `backup-ledger.jsonl` file (by default kept on an offsite volume separate from the DB)
- (Optional) `AUDIT_PEPPER` from the backend's `.env` for full entryHash verification

**Not required:**
- Internet
- Backend / API
- MetaMask / wallet
- Admin privileges

## How to access it

### Recommended: same volume as the ledger

```text
USB / NAS offsite/
├── backup-ledger.jsonl
├── backups/
│   ├── BK-20250115-0001.sql
│   └── ...
└── break-glass-viewer/
    └── index.html       ← copy this file here
```

1. Copy this `tools/break-glass-viewer/` directory onto the USB or NAS holding the ledger.
2. Double-click `index.html` (it opens via `file://`).
3. Drop `backup-ledger.jsonl` onto the indicated area.
4. (Optional) Enter `AUDIT_PEPPER` for full verification.
5. Read the result: total entries, chain status, on-chain anchor count.

### Why offsite, not on the server?

The whole point of the break-glass viewer is to be **verifiable when the server is down**. If it lives on the server, then when the server dies the viewer dies with it — defeating the purpose.

## Reading the result

| Indicator | Meaning |
|---|---|
| ✓ "Backup ledger INTACT" + chain unbroken | History is intact (linkage-wise) |
| ⚠ "Chain broken" | A line was deleted / inserted / reordered |
| ⚠ "entryHash mismatch" | A line's content was altered (or wrong pepper) |
| "On-chain anchor" column has a txHash | The manifest was successfully anchored |

> [!IMPORTANT]
> **Works without the pepper:** linkage chain verification doesn't need any secret. That's the point — any auditor with the ledger can verify it independently, without anyone granting them privilege.

## Related docs

- [Backup & Recovery overview](../../docs/backup-recovery/overview.md)
- [Recovery Signer (companion tool)](../recovery-signer/README.en.md)
