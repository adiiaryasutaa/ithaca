# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

An `AGENTS.md` file also exists in the repo root with detailed conventions, environment variables, and the full API endpoint list — read it for exhaustive reference. This file focuses on architecture that spans multiple files.

## Project

Ithaca is a storage gateway: users connect multiple Google Drive accounts and/or S3-compatible buckets (MinIO, R2, Wasabi, B2, AWS S3) into one virtual dashboard. Uploads stream through the backend and are routed to whichever connected account has space; files are organized in app-level virtual folders backed by Postgres, not by the underlying provider's folder structure (except Google Drive, which mirrors folders as real Drive folders for the sync feature).

**Single shared workspace — NOT multi-tenant.** Every authenticated user sees and controls the same connected accounts, quota, files, folders, routing policy, API keys, shares and activity log. The `userId` column on `File`/`Folder`/`ConnectedAccount`/etc. records _who created a row_ and is never used to filter reads — new routes must not add `where: { userId: req.user!.id }`. Consequences to keep in mind:

- Any login (and any API key, since `api-key.middleware.ts` makes a key act as its owner) can read, delete, and disconnect everything. Registration is disabled; accounts are admin-created, and that is the only access boundary. `requireAdmin` exists solely for `/users`.
- `UploadRoutingPolicy` is a singleton row for the whole app — always go through `getOrCreateRoutingPolicy()` in `src/modules/storage/routing-policy.service.ts`, never `upsert({ where: { userId } })`.
- `ConnectedAccount` is unique on `(provider, providerAccountId)`, so the same Drive/bucket cannot be connected twice by two users.
- `userId` columns are NOT NULL with `onDelete: Cascade`, so hard-deleting a `User` row would destroy shared files. `DELETE /users/:id` only soft-disables (`status: 'disabled'`) — never delete user rows directly in SQL.

## Commands

Backend (`cd backend`):

- `pnpm dev` — tsx watch dev server
- `pnpm build` — typecheck/compile to `dist/`
- `pnpm start` — run compiled build
- `pnpm prisma:migrate` — dev migration (creates + applies)
- `pnpm db:migrate:deploy` — production migration (applies only)
- `pnpm prisma:generate` — regenerate Prisma client
- `pnpm seed:google-config` — store encrypted global Google OAuth config from env into DB
- `pnpm test:s3` — verify an S3-compatible config's connectivity
- `pnpm test:api-upload` — exercise `POST /api/v1/uploads` with an API key

Frontend (`cd frontend`):

- `pnpm dev` — Vite dev server
- `pnpm build` — `tsc && vite build`
- `pnpm preview` — preview production build

Both packages run Vitest (`pnpm test`, `pnpm test:watch`); backend coverage is thin and the frontend suite is minimal, so "verification" is `pnpm build` (typecheck) + `pnpm test` plus manual smoke testing through the UI.

Docker: `docker compose up -d --build` runs Postgres + backend + frontend; backend runs `db:migrate:deploy` and Google config seeding automatically on container start. Production/staging run against [Neon](https://neon.com) (serverless Postgres, free-tier friendly) instead of the local Postgres container — see `DATABASE_URL` in `backend/.env.example`. Neon branches double as environments: `main` = prod, a `dev` branch = pre-prod, each with its own connection string; storage (0.5 GB on the free tier) is shared across all branches in a project, so stale branches should be deleted rather than left to accumulate.

## Backend architecture

Entry: `src/server.ts` → `src/app.ts` mounts one router per feature under `src/modules/<feature>/`. Route mount order in `app.ts` matters for `/api` vs `/api-keys` disambiguation — check it before adding new top-level paths.

**Two parallel storage providers, one upload path.** `src/modules/uploads/` is the center of the system (split into `upload.routes.ts`/`upload.controller.ts`/`upload.service.ts`/`upload.repository.ts` — see Conventions below). `selectAccount()` in `upload.service.ts` picks which `ConnectedAccount` (provider `google_drive` or `s3`) receives an upload, based on the user's `UploadRoutingPolicy` (`most_available` | `round_robin` | `priority`), live-synced quota (`StorageAccount.availableBytes`, re-synced if stale >5min via `syncGoogleQuota`/`syncS3Quota`), and an explicit folder-pinned account override. Provider-specific logic then branches: Google uploads go through `src/modules/google/google.service.ts` (googleapis client, uploads into a Drive folder literally named `Ithaca`, files made public `anyone`/`writer` after upload) or S3 uploads go through `src/modules/s3/s3.service.ts` (`@aws-sdk/client-s3`). A `File` row is written to Postgres either way (`provider` column distinguishes them) — Postgres is the source of truth for the app UI, the remote provider is the source of truth for bytes.

- Non-resumable upload buffers each file fully into memory (`Buffer.concat`) before handing it to the provider SDK — it does not disk-buffer, but it is not true zero-copy streaming either.
- Google-only resumable upload endpoints (`/uploads/resumable/init|status|chunk`) talk to the Drive resumable API directly via `fetch` rather than `googleapis`, and are not implemented for S3.
- `POST /files/sync-google` treats the Google Drive `Ithaca` folder as ground truth and reconciles Postgres `File` rows against it (create/update/mark-deleted). There is no equivalent reconciliation job for S3.
- Postgres is case-sensitive by default (MySQL's default collation wasn't). Email lookups go through `normalizeEmail()` (`src/utils/email.ts`) on every write and read path, and file-name search filters use `mode: 'insensitive'` — both exist specifically to preserve the case-insensitive behavior the app relied on under MySQL.

**Two auth systems for uploads.** Normal app usage uses JWT bearer auth (`requireAuth` / `AuthRequest`, `src/middleware/auth.middleware.ts`). External integrations use per-user API keys (`requireApiKey(scope)`, `src/middleware/api-key.middleware.ts`) mounted at `/api/v1/uploads` (`src/modules/public-api/public-api.routes.ts`), which reuses the exact same `handleUpload` function from `upload.controller.ts` — keep that handler provider-agnostic and auth-agnostic (it reads `req.user!.id`, populated by either middleware) when touching it.

**Provider credentials and OAuth config are layered:** a global `ProviderConfig` (userId `null`) holds the Google OAuth client id/secret, encrypted, seedable via `seed:google-config` or `/system/google-config` (any authenticated user, not just an admin role — there is no admin role in this schema). Per-connection secrets (`ConnectedAccount` tokens, `S3StorageConfig` access keys) are separately encrypted with `src/utils/crypto.ts`. `OauthState` and `AuthHandoff` rows are short-lived, hashed, single-use tokens used to keep OAuth state and post-login handoff out of plain query params.

**Where cross-cutting helpers live:** domain-specific logic shared by 2+ feature modules is homed in whichever module owns the underlying entity/provider, never a generic `shared/` directory. Google OAuth exchange/auth-url issuance and Drive file/folder operations (create, rename, move, delete, make-public, resumable upload) live in `google/google.service.ts` (+`google.repository.ts`, `google-resumable.service.ts`); provider-agnostic quota-sync dispatch and `StorageAccount` serialization live in `storage/quota-sync.service.ts` and `storage/storage.service.ts`; `File` serialization and provider-stream fetching live in `files/file.service.ts` and `files/stream-file.ts`, consumed cross-module by `uploads`/`public`/`public-api` the same way those already depended on `google.service.ts`/`s3.service.ts`. Generic, provider-agnostic infra (`asyncHandler`, `HttpError`, `bigintToString`, shared Zod primitives) lives in `src/middleware/async-handler.ts` and `src/utils/{http-error,serialize,validation}.ts`.

**`src/modules/system/`** is a grab-bag of ops endpoints, all gated by `requireAuth` only (no elevated-privilege check exists in this codebase): triggers `update.sh` (`git reset --hard && git pull` + rebuild + `pm2 restart`) in the background, tails `update.log`, and exposes DB backup/restore. The backup/restore handlers assume a SQLite file on disk (`getDatabaseFilePath()` parses `sqlite:`/`file:` URLs) even though the documented/primary setup is Postgres — `isSqliteMode()` gates both endpoints to return `501` outside SQLite-mode deployments, since a hosted Postgres/Neon instance has no local DB file to back up at all.

Audit logging (`AuditLog` model, `src/utils/audit.ts` → `createAuditLog`) is called inconsistently — present in some mutation paths (e.g. resumable upload completion) and absent in others. Don't assume every mutation is audited.

Prisma models worth knowing: `ConnectedAccount` (1:1 with `StorageAccount` for quota and optionally `S3StorageConfig`) is the shared abstraction over both providers; `File`/`Folder` both carry a nullable `connectedAccountId`/`provider`; `UploadRoutingPolicy` is 1:1 per user.

## Frontend architecture

Vite + React 19 + React Router 7, Tailwind CSS 4. Route table lives in `frontend/src/App.tsx`; protected pages are wrapped in `ProtectedRoute` (`frontend/src/routes/`) + `DriveLayout` (`frontend/src/components/templates/DriveLayout.tsx`, the sidebar/header/quota shell). Pages beyond the core file browser (`AllFilesPage.tsx`) include `ApiManagementPage.tsx` (API key CRUD/docs), `ActivityLogPage.tsx` (audit log viewer), `ArchivedPage.tsx`/`StarredPage.tsx`/`RecentPage.tsx` (static mockups still rendering `data/drive-data` fixtures, not wired to the backend), `TrashPage.tsx`, `QuotaTrackerPage.tsx`, `SettingsPage.tsx`, and the Google OAuth handoff/connect pages.

**Components follow Atomic Design.** `frontend/src/components/` is `ui/` (vendored shadcn primitives) → `atoms/` → `molecules/` → `organisms/` → `templates/`, with `pages/` on top; imports only go _down_ that list, never up and never sideways within a tier. `ui/` is exempt from the scheme: the shadcn CLI writes to the path in `components.json`, so it must not move. A dialog a page opens stays presentational (props in, callbacks out, mutations in the page); a self-contained section organism like `SystemUpdateCard` or `GoogleOAuthCredentialsCard` may own its own fetching. Types, constants and request helpers belong in `lib/`, stateful reusable logic in `hooks/` (`use-drive-files`, `use-file-selection`, `use-share-link`, `use-theme`, …) — not in component files. No barrel `index.ts` files. Nothing enforces this automatically; there is no ESLint in this project.

**Design system: shadcn/ui, Base UI flavor.** `frontend/components.json` was initialized from a hosted preset (`style: base-mira`, `baseColor: mist`, `iconLibrary: hugeicons`), so UI primitives in `frontend/src/components/ui/` are built on `@base-ui/react` (not `@radix-ui/*`) and icons come from `@hugeicons/*` (older pages still import `lucide-react` — both are installed). Add components with `pnpm dlx shadcn@latest add <name>` from `frontend/` (Vite target — no `--template`/`--monorepo`). Theming is shadcn semantic tokens only: `frontend/src/style.css` holds the `:root`/`.dark` token blocks + `@theme inline` map — style with token utilities (`bg-card`, `border-border`, `text-muted-foreground`, `bg-primary`, `ring-ring`, `bg-destructive`), never raw `slate`/`blue` palette classes. Dark mode is the `.dark` class on `documentElement` (toggle + `ithaca:theme` persistence in `DriveLayout.tsx`). `--font-sans` is self-hosted Google Sans. base-mira is a compact scale (Button default `h-7 text-xs`). Button variants: `default|outline|secondary|ghost|destructive|link`. `<TooltipProvider>` + sonner `<Toaster />` are mounted in `App.tsx`.

`frontend/src/lib/api.ts` (`apiFetch`) centralizes JSON calls plus access-token refresh-and-retry; `frontend/src/lib/auth.ts` centralizes local session storage. Upload progress/state is global via `frontend/src/context/UploadContext.tsx`, driving the bottom-right upload progress panel referenced throughout the pages. Use raw `fetch`/`XMLHttpRequest` only where streaming/blob/progress requires it (uploads, downloads); everything else goes through `apiFetch`.

## Conventions (see AGENTS.md for the full list)

- New backend routes: layer them `<feature>.routes.ts` (thin wiring, each handler wrapped in `asyncHandler` from `src/middleware/async-handler.ts`, mounted in `app.ts`) → `<feature>.controller.ts` (Zod validation, calls the service, shapes the HTTP response) → `<feature>.service.ts` (business logic; throws `HttpError` from `src/utils/http-error.ts` for expected failures; no Express types) → `<feature>.repository.ts` (Prisma calls only, module-private — returns raw data, un-serialized). Provider/infra modules with no mounted router (`google/`, `s3/`, `storage/`'s routing-policy/quota-sync) get `service.ts`(+`repository.ts`) only. Cross-module imports target a module's `service.ts` exclusively, never its `controller.ts`/`repository.ts`. Convert `bigint` to string before JSON responses (`src/utils/serialize.ts`'s `bigintToString`, or a module's own `to*Response` serializer).
- Keep uploaded-file bytes off local disk end-to-end (buffer-in-memory-then-forward is fine, writing to a temp file is not) — the one sanctioned exception is `system/`'s SQLite backup/restore, which is disk I/O by necessity.
- Don't change auth/token storage, Google OAuth scopes/redirect behavior, or upload-to-disk behavior without an explicit reason — these are called out as fragile in AGENTS.md.
- Frontend: a button that submits a `<form>` MUST pass `type="submit"` explicitly — `Button` wraps `@base-ui/react/button`, which injects `type="button"` when the caller omits it, so a bare `<Button>` inside a form silently never submits (clicking does nothing; Enter still works via implicit submission).
- Frontend: use `@/*` imports, the shadcn primitives in `frontend/src/components/ui/` (`Button`/`Card`/`Input`/`Dialog`/`Select`/`DropdownMenu`/`Tooltip`/`Label`/sonner), shadcn semantic-token utilities (never raw `slate`/`blue` classes), `cn()` from `frontend/src/lib/utils.ts`, and keep file/folder navigation state in query params (`folderId`, `q`).
- Frontend: put a new component in the tier that matches what it does — atom = one element with no app state, molecule = a few atoms and still dumb, organism = owns a section, template = page shell — and check for an existing molecule before hand-rolling markup (`PageHeader`, `MetricCard`, `StatTile`, `EmptyState`, `CodeBlock`, `QuotaBar`, `TablePagination`, `DummyModal`).
