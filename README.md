# Ithaca

Ithaca is a storage gateway web app that unifies multiple Google Drive accounts and S3-compatible buckets (MinIO, Cloudflare R2, Wasabi, Backblaze B2, AWS S3) into one virtual storage dashboard. Uploads stream through the backend and are routed to whichever connected account has enough free space; files are organized in app-level virtual folders backed by Postgres, with quota tracking, preview, sharing, and manual sync from the Google Drive `Ithaca` folder.

Ithaca is a single shared workspace, not a multi-tenant service: every signed-in user sees and controls the same connected accounts, files, folders, and settings. There is no self-registration — accounts are created by an admin from the Users page, and Google sign-in connects the first Drive account automatically.

## Fork Notice

Ithaca is a personal-use fork of [9drive](https://github.com/zenhosta/9drive) by zenhosta, rebranded and reworked for a single private deployment. It is not affiliated with or supported by upstream, and changes here are made for personal needs rather than general use.

## Features

- Google Drive and S3-compatible storage gateway in one virtual storage dashboard.
- S3-compatible storage support with custom endpoints for providers like MinIO, Cloudflare R2, Wasabi, Backblaze B2, and AWS S3.
- Direct upload stream to Google Drive. Files are not stored on the server.
- Google Drive uploads are stored under a root `Ithaca` folder.
- Direct upload stream to S3-compatible storage through the backend without exposing storage credentials to the frontend.
- Upload routing policies with most-available, round-robin, and priority-order modes.
- External upload API using API keys at `POST /api/v1/uploads`.
- API key management with one-time secret display, hashed key storage, last-used tracking, and revocation.
- Email/password auth plus Google sign-in with automatic first Drive connection.
- Multi-account storage quota summary.
- Quota tracker page.
- Manual sync from the Google Drive `Ithaca` folder back into the database.
- Virtual folders.
- File preview, download, rename, move, and delete actions.
- In-app API documentation with cURL and JavaScript upload examples.
- Bottom-right upload progress panel.
- Bearer token authentication.
- Global Google OAuth config stored encrypted in DB (can be set via seed command or directly in Settings UI).
- Automated system updates via `update.sh` directly from the Settings UI (PM2 setup).
- Admin-managed user accounts (no public registration).
- PostgreSQL database with Prisma migrations (Neon-compatible).
- Express + TypeScript backend.
- React + Vite frontend.

## Project Structure

```txt
backend/   Express API, Prisma schema, Google Drive integration
frontend/  Vite React app
```

## Requirements

- Node.js 20+
- pnpm 10 (pinned by the `packageManager` field in `backend/package.json` and `frontend/package.json`; enable with `corepack enable`)
- PostgreSQL running locally, or a free [Neon](https://neon.com) project
- Google Cloud project
- Google OAuth Client ID and Client Secret

Default database used by this project (matches `docker-compose.yml` / `backend/.env.example`):

```txt
host: localhost
port: 5432
database: ithaca
user: postgres
password: root
```

## 1. Install Dependencies

Install backend dependencies:

```bash
cd backend
pnpm install
```

Install frontend dependencies:

```bash
cd ../frontend
pnpm install
```

## 2. Create Database

Local Postgres:

```sql
CREATE DATABASE ithaca;
```

If using `psql` CLI:

```bash
psql -U postgres -c "CREATE DATABASE ithaca;"
```

Or use a free [Neon](https://neon.com) project instead of a local Postgres install — create a project, then copy its connection string into `DATABASE_URL` below (see [Neon Deployment](#neon-deployment) for branching/pooling notes).

## 3. Environment Setup

Create `backend/.env` (see `backend/.env.example`):

```env
DATABASE_URL="postgresql://postgres:root@localhost:5432/ithaca"
APP_PORT=4000
FRONTEND_URL="http://localhost:5173"
JWT_ACCESS_SECRET="change-this-jwt-secret-at-least-32-chars"
TOKEN_ENCRYPTION_KEY="change-this-encryption-key-32bytes!"
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30
MAX_UPLOAD_BYTES=5368709120

# Used only by `pnpm seed:google-config`.
# These values are encrypted and stored in DB as global Google OAuth config.
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:4000/connected-accounts/google/callback"
```

Important:

- `JWT_ACCESS_SECRET` should be long and random.
- `TOKEN_ENCRYPTION_KEY` should be long and random.
- Do not commit `backend/.env`.
- Google OAuth credentials are used by the seed script, then stored encrypted in the database.

## 4. Frontend Environment

Create or confirm `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000
```

## 5. Run Prisma Migrations

```bash
cd backend
pnpm prisma:migrate
```

If Prisma client generation is blocked on Windows by a running Node process, stop running backend/frontend dev servers and run:

```bash
pnpm exec prisma generate
```

## 6. Google Cloud Setup

Google setup is done in Google Cloud Console, not Google Search Console. Google Search Console is for website indexing/search ownership. OAuth and Drive API are managed in Google Cloud Console.

Open Google Cloud Console:

```txt
https://console.cloud.google.com/
```

### 6.1 Create Or Select Project

1. Open Google Cloud Console.
2. Click project selector in top bar.
3. Create a new project or select an existing project.
4. Remember the project name because OAuth client and Drive API must be in the same project.

### 6.2 Enable Google Drive API

1. Go to:

```txt
APIs & Services -> Library
```

2. Search:

```txt
Google Drive API
```

3. Open `Google Drive API`.
4. Click `Enable`.
5. Wait a few minutes if Google says the API was enabled recently.

Direct URL pattern:

```txt
https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=YOUR_PROJECT_ID
```

If Google Drive API is disabled, you will see an error like:

```txt
Google Drive API has not been used in project ... before or it is disabled.
```

### 6.3 Configure OAuth Consent Screen

1. Go to:

```txt
APIs & Services -> OAuth consent screen
```

2. Choose app type:

```txt
External
```

3. Fill required fields:

```txt
App name
User support email
Developer contact email
```

4. Add scopes:

```txt
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
```

Full Drive access is required so Google sign-in can connect the first Drive account automatically and sync files manually added to the `Ithaca` folder.

5. If publishing status is `Testing`, add test users.

Add every Google account that will test the app:

```txt
OAuth consent screen -> Test users -> Add users
```

If you do not add test users, Google may show:

```txt
Access blocked: app has not completed the Google verification process
Error 403: access_denied
```

### 6.4 Create OAuth Client

1. Go to:

```txt
APIs & Services -> Credentials
```

2. Click:

```txt
Create Credentials -> OAuth client ID
```

3. Application type:

```txt
Web application
```

4. Add authorized JavaScript origin:

```txt
http://localhost:5173
```

5. Add authorized redirect URI:

```txt
http://localhost:4000/connected-accounts/google/callback
```

6. Click Create.
7. Copy:

```txt
Client ID
Client Secret
```

### 6.5 Seed Google OAuth Config

Put values into `backend/.env`:

```env
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:4000/connected-accounts/google/callback"
```

Then run:

```bash
cd backend
pnpm seed:google-config
```

This stores the Google OAuth config as a global encrypted provider config in the database. Google sign-in uses the same config and automatically connects the first Drive account. Logged-in users can still click `Connect Drive` in Settings to add more Drive accounts.

## 7. Run Development Servers

Start backend:

```bash
cd backend
pnpm dev
```

Backend runs at:

```txt
http://localhost:4000
```

Start frontend:

```bash
cd frontend
pnpm dev
```

Frontend runs at:

```txt
http://localhost:5173
```

## Docker Deployment

This repository includes Docker files for running Postgres, backend, and frontend together.

Files:

```txt
docker-compose.yml
.env.docker.example
backend/Dockerfile
frontend/Dockerfile
frontend/nginx.conf
```

### 1. Prepare Docker Env

Copy the example env file:

```bash
cp .env.docker.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.docker.example .env
```

Edit `.env` (see `.env.docker.example`):

```env
POSTGRES_PASSWORD=root
POSTGRES_DB=ithaca

FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:4000

JWT_ACCESS_SECRET=replace-with-long-random-secret
TOKEN_ENCRYPTION_KEY=replace-with-long-random-secret

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/connected-accounts/google/callback
```

### 2. Start Containers

```bash
docker compose up -d --build
```

Services:

```txt
frontend: http://localhost:5173
backend:  http://localhost:4000
postgres: localhost:5432
adminer:  http://localhost:8081
```

The backend container runs Prisma migrations automatically on startup:

```txt
pnpm db:migrate:deploy
```

This applies pending migrations such as S3 storage support before the API starts, so deployments from an older database can update safely without dropping data.

It also seeds the global Google OAuth config automatically when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set to real values in `.env`. If those values are blank or still placeholders, the backend still starts and logs a warning. Google connect/sign-in will be unavailable until you set real Google OAuth credentials and restart the stack:

```bash
docker compose up -d --build
```

### 3. Seed Google OAuth Config Manually

Automatic Docker startup seeding is usually enough. If you update Google OAuth values while containers are already running, seed the global Google OAuth config manually:

```bash
docker compose exec backend pnpm seed:google-config
```

This stores `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` from Docker env into the database as encrypted global config.

### 4. View Logs

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

### 5. Stop Containers

```bash
docker compose down
```

Remove database volume too:

```bash
docker compose down -v
```

### Docker Production Notes

- Replace localhost URLs with production domain.
- Update Google OAuth authorized JavaScript origin.
- Update Google OAuth redirect URI.
- Use strong `JWT_ACCESS_SECRET` and `TOKEN_ENCRYPTION_KEY`.
- Do not expose the Postgres port publicly in production.
- Put frontend/backend behind HTTPS reverse proxy.
- Rebuild frontend when `VITE_API_URL` changes because Vite embeds env at build time.

### VPS Deployment (Step-by-Step)

Follow these steps to deploy Ithaca to a VPS (such as Ubuntu/Debian) using Docker:

#### 1. Install Docker & Docker Compose on your VPS

```bash
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl enable --now docker
```

#### 2. Clone the Repository

```bash
git clone https://github.com/your-github-username/ithaca.git
cd ithaca
```

#### 3. Setup the Production Environment

Copy the example environment file to `.env`:

```bash
cp .env.docker.example .env
```

Edit the `.env` file (e.g., `nano .env`) and configure the values for your production VPS domain/IP:

- **`FRONTEND_URL`**: Set to your public domain or VPS IP (e.g., `http://103.xxx.xxx.xxx:5173` or `https://ithaca.yourdomain.com`).
- **`VITE_API_URL`**: Set to your public backend URL (e.g., `http://103.xxx.xxx.xxx:4000` or `https://api.ithaca.yourdomain.com`).
- **`GOOGLE_REDIRECT_URI`**: Set to your public redirect callback URL (e.g., `http://103.xxx.xxx.xxx:4000/connected-accounts/google/callback`).
- Set secure credentials for **`JWT_ACCESS_SECRET`** and **`TOKEN_ENCRYPTION_KEY`** (encryption key must be exactly 32 characters/bytes).
- Add your **`GOOGLE_CLIENT_ID`** and **`GOOGLE_CLIENT_SECRET`**.

#### 4. Deploy the Containers

Run Docker Compose to build and start the database, backend, and frontend containers in the background:

```bash
docker compose up -d --build
```

#### 5. Seed the Google Configuration

Initialize the encrypted Google configuration in the database:

```bash
docker compose exec backend pnpm seed:google-config
```

#### 6. Add Authorized URIs in Google Cloud Console

1. Go to **APIs & Services** -> **Credentials** in the Google Cloud Console.
2. Edit your OAuth 2.0 Web Client.
3. In **Authorized JavaScript origins**, add your frontend URL (e.g., `http://your-vps-ip:5173` or `https://ithaca.yourdomain.com`).
4. In **Authorized redirect URIs**, add your redirect URI (e.g., `http://your-vps-ip:4000/connected-accounts/google/callback` or `https://api.ithaca.yourdomain.com/connected-accounts/google/callback`).
5. Save changes.

### Neon Deployment

Instead of running Postgres yourself (local container or VPS), point `DATABASE_URL` at a [Neon](https://neon.com) project — a free-tier serverless Postgres host with instant branching, which pairs well with `main`/`dev` environment separation:

1. Create a Neon project. It ships with a default `main`/`production` branch.
2. Create a `dev` branch off it (Neon console, or `pnpm exec prisma migrate dev` locally against it) for pre-prod checks — each branch gets its own connection string, so `dev` and prod never collide.
3. Copy the branch's **pooled** connection string (`-pooler` in the hostname) into `DATABASE_URL`.
4. Run `pnpm db:migrate:deploy` against that URL to apply migrations, same as any other Postgres target.

Neon's free tier: 0.5 GB storage and 10 branches per project, shared across branches — see [Neon's plan limits](https://neon.com/docs/introduction/plans) for current numbers.

### Non-Docker Production Startup

Run production migrations before starting the backend:

```bash
cd backend
pnpm db:migrate:deploy
pnpm start
```

Or use the combined command:

```bash
cd backend
pnpm start:deploy
```

`pnpm db:migrate:deploy` uses Prisma production migrations and does not reset the database. If Prisma reports migration drift, stop the deploy and repair migration history first; do not run `prisma migrate reset` on production.

## 8. Manual Test Flow

1. Open frontend:

```txt
http://localhost:5173
```

2. Sign in with an admin-created email/password account, or click `Continue with Google and connect Drive`.
3. If using Google sign-in, approve Drive access once and confirm `/settings` already shows the connected account.
4. If using email/password, open `Settings`, click `Connect Drive`, approve access, and confirm the account appears.
5. Open `Quota Tracker`.
6. Confirm quota appears.
7. Open `All Files`.
8. Create nested virtual folders.
9. Upload a file and confirm it appears under Google Drive root folder `Ithaca`.
10. Add or remove a file manually inside Google Drive folder `Ithaca`, then click `Sync Drive` in All Files.
11. Watch bottom-right upload progress.
12. Right-click file row for actions:

```txt
View
Download
Rename
Move to Folder
Delete
```

## API Overview

Auth:

```txt
POST /auth/login
GET /auth/google/url
GET /auth/google/callback
POST /auth/google/exchange
POST /auth/refresh
POST /auth/logout
GET /auth/me
```

Google accounts:

```txt
GET /connected-accounts/google/connect-url
GET /connected-accounts/google/callback
GET /connected-accounts
POST /connected-accounts/:id/sync-quota
DELETE /connected-accounts/:id
```

Storage:

```txt
GET /storage/summary
```

Folders:

```txt
GET /folders
GET /folders/recent?limit=4
POST /folders
DELETE /folders/:id
```

Files:

```txt
GET /files
GET /files?folderId=<id>
GET /files?q=<search>
GET /files/shared-links
GET /files/:id
PATCH /files/:id
PATCH /files/batch
DELETE /files/batch
POST /files/sync-google
POST /files/:id/share
DELETE /files/:id/share
POST /files/:id/preview-token
GET /files/:id/view-url
GET /files/:id/download
DELETE /files/:id
GET /files/preview/:token
```

Uploads:

```txt
POST /uploads
```

Upload is `multipart/form-data`. Metadata fields should be appended before the file:

```txt
sizeBytes
fileName
mimeType
folderId optional
file
```

## Security Notes

- Backend never stores uploaded files on disk.
- Uploads are streamed through the backend to Google Drive folder `Ithaca`.
- Google tokens are encrypted in the database.
- Refresh tokens for app sessions are hashed in the database.
- Google auth handoff tokens, public share tokens, and preview tokens are hashed before lookup/use.
- `backend/.env` is ignored by git.
- Do not expose `TOKEN_ENCRYPTION_KEY`, `JWT_ACCESS_SECRET`, OAuth client secrets, or raw share/preview/handoff tokens.

## Production Notes

- Replace localhost redirect URIs with production URLs.
- Add production domain to Google OAuth authorized origins.
- Set OAuth consent screen to production when ready.
- Google may require verification for public apps.
- Use strong secrets.
- Put the backend behind HTTPS.
- Consider secure cookies or stronger token storage for production.

## Google OAuth Configuration via UI

Instead of seeding Google credentials manually using `pnpm seed:google-config`, you can set them up directly from the frontend dashboard:

1. Log in to the dashboard.
2. Go to **Settings** -> **Google Credentials**.
3. Input your **Google Client ID**, **Google Client Secret**, and **Redirect URI** (e.g. `https://103.65.237.136.nip.io:4000/connected-accounts/google/callback`).
4. Click **Save Configuration**.

The config is automatically encrypted and saved into the database, enabling Google sign-in and Google Drive connections instantly.

## Automated Updates & PM2 Management

For native VPS setups running with PM2, Ithaca includes a fully automated system update trigger and log monitor in the **Settings** UI.

### How it works

1. When you trigger an update from the frontend dashboard, the backend triggers the `update.sh` script in the background.
2. The script:
   - Resets any local Git conflicts (`git reset --hard`) and pulls the latest changes.
   - Installs dependencies and builds both backend and frontend.
   - Deploys Prisma database migrations.
   - Restarts the backend process using PM2 (`pm2 restart ithaca-backend`).
3. You can monitor the real-time rebuild progress using the log viewer inside the Settings UI.

### Manual update command

If you want to update manually via the terminal, run:

```bash
./update.sh
```

Or run the commands individually:

```bash
git reset --hard
git pull origin main
cd backend && pnpm install && pnpm exec prisma generate && pnpm build && pnpm exec prisma migrate deploy
cd ../frontend && pnpm install && pnpm build
pm2 restart ithaca-backend
```

## Build

Backend:

```bash
cd backend
pnpm build
```

Frontend:

```bash
cd frontend
pnpm build
```
