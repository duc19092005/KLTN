# Deployment Guide - KLTN Hospital System

This guide deploys the NestJS backend, React/Vite frontend, PostgreSQL, Kafka, and Nginx reverse proxy on an Ubuntu VPS using GitHub Actions, GHCR, Docker, and Docker Compose.

## 1. Production architecture

```text
GitHub Actions -> GHCR -> Tailscale -> Personal server Docker Compose

nginx:80
  ├─ /      -> frontend:80
  └─ /api  -> backend:3001

backend -> postgres:5432
backend -> kafka:9092
```

This project is currently designed for a personal machine used as the server.
GitHub Actions joins your Tailscale tailnet before SSH, so `VPS_HOST` can be the
Tailscale IP, for example `100.89.226.81`.

PostgreSQL and Kafka use named Docker volumes. Do not run `docker compose down -v` in production.

## 2. Create deploy user

```bash
sudo apt update && sudo apt upgrade -y
sudo adduser deploy
sudo usermod -aG sudo deploy
```

Create a dedicated SSH key on your local machine:

```bash
ssh-keygen -t ed25519 -C "kltn-deploy" -f ~/.ssh/kltn_deploy
```

Add the public key to the VPS:

```bash
sudo mkdir -p /home/deploy/.ssh
sudo nano /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Store the private key content in GitHub secret `VPS_SSH_PRIVATE_KEY`.

## 3. Install Docker Engine and Compose plugin

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker deploy
```

Log out and log back in, then verify:

```bash
docker --version
docker compose version
```

## 4. Create deploy directory

```bash
sudo mkdir -p /opt/kltn
sudo chown -R deploy:deploy /opt/kltn
```

GitHub Actions will sync the `infrastructure/` tree into `/opt/kltn`:

```text
infrastructure/
```

## 5. Create production env files on VPS

Use the same env layout as local development, but fill production-safe values:

```text
/opt/kltn/.env
/opt/kltn/apps/hospital-api/.env
/opt/kltn/apps/hospital-web/.env
/opt/kltn/apps/audit-contracts/.env
```

Create directories first:

```bash
mkdir -p /opt/kltn/apps/hospital-api /opt/kltn/apps/hospital-web /opt/kltn/apps/audit-contracts
```

Root env controls Docker Compose infrastructure and image names:

```bash
nano /opt/kltn/.env
chmod 600 /opt/kltn/.env
```

On the first deployment after this refactor, the deploy script securely moves a legacy `/opt/kltn/backend/.env` to `/opt/kltn/apps/hospital-api/.env` and sets mode `600`. If both files exist, the new path wins and the legacy file is only reported.

Backend env controls NestJS runtime secrets:

```bash
nano /opt/kltn/apps/hospital-api/.env
chmod 600 /opt/kltn/apps/hospital-api/.env
```

Frontend env only contains public browser config, for example `VITE_API_URL=/api`.
Blockchain env only contains Hardhat deploy/governance config if you deploy contracts from the VPS.

Important rules:

- Do not commit real `.env` files.
- Root `.env` must contain `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `BACKEND_IMAGE`, and `FRONTEND_IMAGE`.
- `apps/hospital-api/.env` must contain `DATABASE_URL` pointing to `postgres:5432`.
- `apps/hospital-api/.env` should use `KAFKA_ENABLED=true` and `KAFKA_BROKERS=kafka:9092`.
- `apps/hospital-web/.env` values are public because `VITE_*` variables are built into the browser bundle.

## 6. GitHub Secrets

| Secret | Meaning | Example |
|---|---|---|
| `TAILSCALE_AUTHKEY` | Auth key allowing GitHub Actions to join your tailnet | `tskey-auth-...` |
| `VPS_HOST` | Server Tailscale IP or public IP | `100.89.226.81` |
| `VPS_PORT` | SSH port | `22` |
| `VPS_USERNAME` | Deploy user | `deploy` |
| `VPS_SSH_PRIVATE_KEY` | Dedicated private key | OpenSSH private key |
| `VPS_DEPLOY_PATH` | Deploy path | `/opt/kltn` |
| `GHCR_USERNAME` | GitHub username | `duc19092005` |
| `GHCR_TOKEN` | Token for server image pull | PAT with `read:packages` |

The workflow uses `GITHUB_TOKEN` to push images to GHCR. The server uses
`GHCR_USERNAME` and `GHCR_TOKEN` to pull images.

For Tailscale, create an auth key in:

```text
Tailscale Admin Console -> Settings -> Keys -> Generate auth key
```

Recommended settings for GitHub Actions:

- Ephemeral: enabled
- Reusable: disabled
- Pre-approved: enabled if your tailnet supports it


## 7. Firewall

For HTTP only:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw enable
sudo ufw status
```

After HTTPS is configured:

```bash
sudo ufw allow 443/tcp
```

Do not expose PostgreSQL `5432` or Kafka ports to the Internet.

## 8. GHCR login on server

The deploy script can login using `GHCR_USERNAME` and `GHCR_TOKEN` passed by GitHub Actions. You can also login manually once:

```bash
echo 'YOUR_GHCR_TOKEN' | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

## 9. First deployment

Push or merge into `main`. The workflow will:

1. Run apps/hospital-api/frontend verification.
2. Build apps/hospital-api/frontend images.
3. Push images to GHCR.
4. Join Tailscale using `TAILSCALE_AUTHKEY`.
5. SSH into your server through the Tailscale IP.
6. Sync deployment files.
7. Run `infrastructure/scripts/deploy-production.sh`.

Manual run on VPS, if needed:

```bash
cd /opt/kltn
BACKEND_IMAGE=ghcr.io/owner/repo-backend:sha \
FRONTEND_IMAGE=ghcr.io/owner/repo-frontend:sha \
./infrastructure/scripts/deploy-production.sh
```

## 10. Check deployment

```bash
cd /opt/kltn
docker compose -f infrastructure/compose/compose.prod.yml ps
curl -f http://localhost/health
curl -f http://localhost/api/health
docker compose -f infrastructure/compose/compose.prod.yml logs --tail=100 backend
docker compose -f infrastructure/compose/compose.prod.yml logs --tail=100 kafka
```

## 11. Database migrations

Production deploy uses:

```bash
npx prisma migrate deploy
```

Do not use these in production deploy:

```bash
npx prisma migrate dev
npx prisma db push
npx prisma db push --force-reset
```

For risky migrations, use expand-migrate-contract:

1. Expand: add compatible columns/tables.
2. Migrate: copy/backfill data.
3. Contract: remove old schema only after old app versions are gone.

## 12. Backup PostgreSQL

Run manually:

```bash
cd /opt/kltn
chmod +x infrastructure/scripts/*.sh
./infrastructure/scripts/backup-postgres.sh
```

Recommended cron:

```bash
crontab -e
```

Example daily backup at 02:00:

```cron
0 2 * * * cd /opt/kltn && ./infrastructure/scripts/backup-postgres.sh >> backups/backup.log 2>&1
```

Backups are stored under:

```text
/opt/kltn/backups/postgres/
```

## 13. Restore PostgreSQL

Restore is destructive and intentionally manual:

```bash
cd /opt/kltn
./infrastructure/scripts/restore-postgres.sh backups/postgres/zkp_identity_YYYYMMDD_HHMMSS.sql.gz
```

You must type the confirmation phrase printed by the script.

## 14. Rollback behavior

Before deploy, the script records current apps/hospital-api/frontend image names in:

```text
.previous_backend_image
.previous_frontend_image
```

If deploy fails after image update or health check, the script restores the previous images and runs Docker Compose again.

Database rollback is not automatic. If a migration changed data/schema incompatibly, restore from backup manually after assessing data impact.

## 15. HTTPS/domain

Replace `your-domain.com` in `infrastructure/nginx/conf.d/default.conf` with the real domain.

For HTTPS, either:

- Put the VPS behind Cloudflare proxy/Tunnel, or
- Add Certbot certificates and mount them into the Nginx container.

Do not enable duplicate reverse proxies without understanding the traffic path.

## 16. Recommended GitHub protections

Enable on `main`:

- Required pull request review.
- Required status checks: CI, CodeQL if desired.
- Branch protection preventing direct force-push.
- GitHub Environment `production` with manual approval if the defense/demo needs controlled deploys.
