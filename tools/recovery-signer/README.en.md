**🌐 Language:** [🇻🇳 Tiếng Việt](./README.md) · [🇬🇧 English](./README.en.md) · [🇷🇺 Русский](./README.ru.md)

# Recovery Signer

> Sign a challenge string with MetaMask to perform an emergency database restore when normal login is impossible.

## Purpose

When the DB is wiped/encrypted or tampered with so severely that **no User exists to log in and biometric data can no longer be trusted**, the system needs an alternative "root key." This tool uses the **Admin's Web3 wallet** registered in the `IdentityRegistry` contract as the out-of-band root of trust.

End-to-end flow:

```text
SSH the dying server                Admin's personal machine (safe)
─────────────────                   ─────────────────────────────
$ npm run db:emergency-restore      ┌──→ Open recovery-signer/index.html
        │                            │   Connect MetaMask
        ▼                            │   Paste challenge → Sign
EMERGENCY_..._CHALLENGE:abc:t   ─────┘
        │                                 │
        ▼                                 ▼
   (Admin copies challenge)         0xabcdef... (signature)
        │                                 │
        └──── Admin pastes signature ◄────┘
        │
        ▼
Verify on-chain: ethers.verifyMessage()
                 → IdentityRegistry.isAuthorized()
        │
        ▼
Drop DB + load dump via psql
```

## When to use

| Situation | Reason |
|---|---|
| DB wiped or encrypted | No User table left to log in with |
| Biometric data not trustworthy | Face scan can't be used for authentication |
| Server compromised | Nothing on the server can be trusted |
| Need to restore the entire DB from a `.sql` backup | Only path left when all access is gone |

> [!CAUTION]
> **Do not use this for routine recovery.** If the Admin UI still works, use "Surgical Restore" at `/admin/backup` (recovers only the tampered records — much safer). Recovery Signer is the last resort.

## Requirements

- **On the Admin's personal machine (NOT on the server):**
  - Browser with MetaMask installed
  - Admin wallet registered in the `IdentityRegistry` contract (via the deploy script)
- **On the server:**
  - SSH access
  - A valid `.sql` backup file (transferred via SCP/USB)
  - Backend repo cloned (to run `npm run db:emergency-restore`)

**Not required:** internet on the browser while signing (signing happens locally inside MetaMask).

## How to access it

There are three places to run this file, in order of safety:

### 1. USB / private GitHub Pages owned by Admin (MOST RECOMMENDED)

```bash
# On the Admin's personal machine, copy this directory onto a USB drive
cp -r tools/recovery-signer/ /Volumes/AdminUSB/

# When needed, plug the USB into the personal machine and open
open /Volumes/AdminUSB/recovery-signer/index.html
```

**Why:** Fully isolated from the suspect infrastructure. Even if a hacker owns the server, they can't modify a file on the Admin's USB.

### 2. The repo on the personal machine

```bash
# On the Admin's laptop (with the repo cloned)
xdg-open tools/recovery-signer/index.html   # Linux
open tools/recovery-signer/index.html       # macOS
```

**Suitable when:** Admin has the repo locally and hasn't set up a USB yet. Still safe — the personal machine isn't the failing server.

### 3. URL on a running frontend

```text
https://<your-frontend-domain>/recovery-signer.html
```

`frontend/public/recovery-signer.html` is a **synced copy** of `tools/recovery-signer/index.html`, served as-is by Vite (static file in `public/`).

> [!CAUTION]
> Use this option **only if the frontend is still running normally and you trust it**. If the frontend shares infrastructure with the dying DB, don't use it — a hacker could have edited the HTML to steal the signature.

## Step-by-step procedure

See [docs/backup-recovery/emergency-restore.md](../../docs/backup-recovery/emergency-restore.md) for screenshots.

Summary:

1. **SSH** into the server, `cd backend`, run:
   ```bash
   npm run db:emergency-restore /path/to/dump.sql
   ```
2. The terminal prints `EMERGENCY_DATABASE_RESTORE_CHALLENGE:<hex>:<timestamp>` — copy it.
3. **On the personal machine:** open `recovery-signer/index.html`, click "Connect MetaMask wallet".
4. Paste the challenge into the input field, click "Sign rescue message", confirm in MetaMask.
5. Copy the hex signature (`0x...`).
6. Back in the SSH terminal, paste the signature, hit Enter.
7. The backend verifies on-chain → if valid, drops the DB and restores it.

## Why out-of-band?

When the server is suspect, **nothing on the server can be trusted**:

- Private keys must never be entered on the server (an attacker could log keystrokes).
- Checking "who is Admin" cannot rely on the DB (suspect) or the server's `.env`.
- The source of truth must live **independently** of the failing server.

The solution:
1. **Private key:** stays inside MetaMask on the personal machine, never leaves.
2. **Admin authorization check:** read directly from the `IdentityRegistry` smart contract on-chain — cannot be forged.
3. **Random challenge + timestamp:** prevents replay (old signatures can't be reused).

## Synced files

| Path | Role |
|---|---|
| `tools/recovery-signer/index.html` | **Canonical** — edit here |
| `frontend/public/recovery-signer.html` | Vite-deployed copy — sync from canonical |

When updating, edit the canonical file then:
```bash
cp tools/recovery-signer/index.html frontend/public/recovery-signer.html
```

## Related docs

- [Step-by-step Emergency Restore](../../docs/backup-recovery/emergency-restore.md)
- [Backup & Recovery overview](../../docs/backup-recovery/overview.md)
- [Break-Glass Viewer (companion tool)](../break-glass-viewer/README.en.md)
