# AGENTS.md

## Project Overview

Ithaca is a Google Drive storage gateway. It lets users log in with email/password or Google, automatically connect the first Drive account during Google sign-in, connect additional Google Drive accounts, track combined quota, upload files through the backend into a dedicated Google Drive `Ithaca` folder, organize files in virtual folders, preview/download/share files, sync Postgres file records from Google Drive, invite other users to files/folders, and route uploads to a connected Drive account with enough free space.

## Repository Structure

- `backend/`: Express API, TypeScript, Prisma schema/migrations, Postgres access, auth, Google OAuth/Drive integration.
- `frontend/`: Vite React app, protected dashboard UI, file/folder management, sharing, uploads, quota/settings pages.
- `docker-compose.yml`: Postgres, backend, and nginx-served frontend services. Production/staging point `DATABASE_URL` at a Neon (serverless Postgres) branch instead of the local container.
- `.env.docker.example`: Docker environment template.
- `README.md`: local setup, Google Cloud setup, Docker notes, deployment notes.

## Requirements

- Node.js 20+
- pnpm 10 (pinned by the `packageManager` field in each package; run it via `corepack pnpm@10.34.5` if your global pnpm is newer)
- Postgres 16+ (or a [Neon](https://neon.com) connection string)
- Google Cloud project with Google Drive API enabled
- Google OAuth client ID and secret

## Backend

Stack:

- Express 5
- TypeScript
- Prisma 6
- Postgres
- Zod
- JWT bearer auth
- Argon2 password hashing
- Busboy streaming uploads
- Google APIs client
- Undici for Google file streaming

Important files:

- `backend/src/server.ts`: server entrypoint.
- `backend/src/app.ts`: Express app and route mounting.
- `backend/src/config/env.ts`: environment validation.
- `backend/src/config/prisma.ts`: Prisma client.
- `backend/prisma/schema.prisma`: database schema.
- `backend/src/middleware/auth.middleware.ts`: bearer auth.
- `backend/src/middleware/error.middleware.ts`: JSON error responses.
- `backend/src/middleware/async-handler.ts`: wraps route handlers so a rejected promise reaches `error.middleware.ts` without a per-handler `try/catch`.
- `backend/src/utils/http-error.ts`: `HttpError(status, code, message)` — the exception type service layers throw for expected failures; `error.middleware.ts` maps it straight to its `status`/`code`/`message`.
- `backend/src/modules/**`: feature modules, each layered `<feature>.routes.ts` → `.controller.ts` → `.service.ts` → `.repository.ts` (see Backend conventions below), plus provider services (`google/`, `s3/`).
- `backend/src/modules/files/stream-google-file.ts`: Google file preview/download streaming.
- `backend/src/scripts/seed-google-config.ts`: stores encrypted global Google OAuth config.

Commands:

- `cd backend && pnpm dev`: start development server.
- `cd backend && pnpm build`: typecheck/build backend.
- `cd backend && pnpm start`: run compiled backend from `dist/server.js`.
- `cd backend && pnpm prisma:migrate`: run Prisma dev migration.
- `cd backend && pnpm prisma:generate`: regenerate Prisma client.
- `cd backend && pnpm seed:google-config`: store encrypted Google OAuth config.

Environment:

- `DATABASE_URL`
- `APP_PORT`
- `FRONTEND_URL`
- `JWT_ACCESS_SECRET`
- `TOKEN_ENCRYPTION_KEY`
- `ACCESS_TOKEN_TTL_SECONDS`
- `REFRESH_TOKEN_TTL_DAYS`
- `MAX_UPLOAD_BYTES`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Backend conventions:

- Layer new backend features across four files under `backend/src/modules/<feature>/`:
  - `<feature>.routes.ts` — `Router()` + middleware wiring only; every handler wrapped in `asyncHandler(...)`.
  - `<feature>.controller.ts` — Zod-parses `req.params`/`query`/`body`, calls the service, shapes the HTTP response (status code, JSON body).
  - `<feature>.service.ts` — business logic and orchestration; throws `HttpError` for expected failures; never imports Express `Request`/`Response`/`NextFunction`.
  - `<feature>.repository.ts` — Prisma calls only, module-private (not imported by other modules); returns raw data, bigint/Date untouched.
  - Provider/infra modules with no mounted router (`google/`, `s3/`, `storage/`'s routing-policy/quota-sync) get `service.ts`(+`repository.ts`) only — no `routes.ts`/`controller.ts`.
  - Cross-module imports target a module's `service.ts` exclusively, never its `controller.ts`/`repository.ts` — this is what lets one module's internal layering change without rippling into another module's import paths.
  - A repository query only needs to be centralized cross-module when it encapsulates real logic beyond one static-shape Prisma call; a trivial existence check may legitimately live in more than one module's own `repository.ts`.
  - Domain-specific helpers shared by 2+ modules are homed in whichever module owns the underlying entity/provider (e.g. Google Drive operations in `google/google.service.ts`, quota-sync dispatch in `storage/quota-sync.service.ts`) — never a generic `shared/` directory.
- Mount new routers in `backend/src/app.ts`.
- Use `requireAuth` for authenticated routes.
- Use `AuthRequest` when accessing `req.user`.
- Validate request bodies/query params with Zod.
- Use Prisma from `backend/src/config/prisma.ts`.
- Return JSON errors with stable `code` and human-readable `message` — throw `HttpError` from a service rather than constructing the response inline in a controller.
- Unexpected errors reach `next(error)` automatically via `asyncHandler` — no per-handler `try/catch` needed.
- Convert `bigint` values to strings before sending JSON responses (`backend/src/utils/serialize.ts`'s `bigintToString`, or a module's own `to*Response` serializer).
- Keep Google-specific OAuth/Drive behavior in provider modules/services when possible.
- Keep public-token routes outside `requireAuth`; verify token hash, status, and expiry before streaming/returning data.
- Google sign-in uses one-time auth handoff tokens; never send app access/refresh tokens through URL query params.

Security rules:

- Never commit `.env` files or secrets.
- Never log access tokens, refresh tokens, OAuth client secrets, JWT secrets, encryption keys, or raw public share tokens.
- Google tokens are encrypted before database storage.
- App refresh tokens are hashed before database storage.
- Auth handoff, share, and preview tokens are stored as hashes where applicable.
- Uploaded files must stream through backend to Google Drive folder `Ithaca`; do not store uploaded files on disk.
- Keep CORS restricted by `FRONTEND_URL`.
- Keep auth/token storage behavior centralized; do not change without explicit reason.

Database rules:

- Change DB schema through Prisma schema and migrations.
- Do not hand-edit generated Prisma client files.
- After schema changes, run Prisma migration/generation and backend build.
- Add indexes for new common filters before relying on them in hot paths.

## Frontend

Stack:

- React 19
- Vite 8
- TypeScript
- React Router 7
- Tailwind CSS 4
- lucide-react
- class-variance-authority
- clsx
- tailwind-merge

Component organization is Atomic Design. Components live under `frontend/src/components/` in
five tiers, and imports only ever point _down_ the list:

| Tier                       | Holds                                                                                                                       | May import                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `ui/`                      | shadcn primitives, vendored by the CLI                                                                                      | —                                         |
| `atoms/`                   | one element, no app state (BrandLogo, FileIcon, StatusBadge)                                                                | `ui/`, `lib/`                             |
| `molecules/`               | a few atoms, still dumb (PageHeader, MetricCard, CodeBlock, QuotaBar)                                                       | atoms, `ui/`, `lib/`                      |
| `organisms/`               | owns a whole section; may read hooks/context and fetch its own data (FileTable, AppHeader, the dialogs, the settings cards) | molecules and below, `hooks/`, `context/` |
| `templates/`               | page shell (DriveLayout)                                                                                                    | organisms and below                       |
| `pages/` (in `src/pages/`) | route + state + composition                                                                                                 | everything                                |

Rules:

- `components/ui/` is off-limits to the tier scheme. It is vendored by `pnpm dlx shadcn@latest add`
  against the path in `components.json`; do not move it or hand-edit generated primitives.
- Never import upward, and never sideways within a tier. An atom that needs another atom is a
  molecule.
- A dialog opened _by a page_ stays presentational: props in, callbacks out, mutations in the
  page. A self-contained section organism (e.g. `SystemUpdateCard`) may own its own fetching
  when nothing else on the page reads that data.
- Non-component code does not belong in component files: types, constants, formatters and
  request helpers go to `lib/`; stateful reusable logic goes to `hooks/`.
- No barrel `index.ts` files — import the exact path so the dependency direction stays visible.
- There is no ESLint in this project, so the tier rule is review-enforced.

Important files:

- `frontend/src/main.tsx`: React entrypoint.
- `frontend/src/App.tsx`: route registration.
- `frontend/src/routes/ProtectedRoute.tsx`: auth guard wrapping the dashboard routes.
- `frontend/src/components/templates/DriveLayout.tsx`: protected app shell (sidebar, header, upload panel).
- `frontend/src/components/organisms/AppHeader.tsx`: search box and advanced filters; writes them to the URL.
- `frontend/src/pages/AllFilesPage.tsx`: core file/folder UI, uploads, context menus, preview, share/invite modals.
- `frontend/src/pages/SharedPage.tsx`: shared links and invites UI.
- `frontend/src/pages/QuotaTrackerPage.tsx`: connected-account quota UI.
- `frontend/src/pages/SettingsPage.tsx`: account, connected storage, and admin ops UI.
- `frontend/src/pages/GoogleAuthPage.tsx`: Google auth handoff exchange page.
- `frontend/src/pages/PublicFilePage.tsx`: public shared file viewer/embed page.
- `frontend/src/components/ui/**`: vendored shadcn primitives.
- `frontend/src/hooks/use-drive-files.ts`: file/folder listing, folder path, upload-completed refresh.
- `frontend/src/lib/api.ts`: API helper, token refresh retry, formatting utilities.
- `frontend/src/lib/auth.ts`: local auth session storage.
- `frontend/src/lib/provider.ts`: ConnectedAccount type and provider/quota labels.
- `frontend/src/lib/drive-mappers.ts`: backend file/folder payloads to UI shapes.
- `frontend/src/lib/google-connect.ts`: shared Google OAuth popup flow.
- `frontend/src/lib/download.ts`: authenticated blob downloads.
- `frontend/src/lib/plyr.ts`: video preview player loading.
- `frontend/src/style.css`: Tailwind import and global styles.

Commands:

- `cd frontend && pnpm dev`: start Vite dev server.
- `cd frontend && pnpm build`: typecheck/build frontend.
- `cd frontend && pnpm preview`: preview production build.

Environment:

- `VITE_API_URL`: backend base URL. Vite embeds this at build time.

Frontend conventions:

- Use `@/*` imports for files under `frontend/src`.
- Place new components in the correct Atomic Design tier and respect the one-way import rule above.
- Keep route registration in `frontend/src/App.tsx`.
- Use `apiFetch` for normal JSON API calls.
- Use raw `fetch` or `XMLHttpRequest` only when response streaming/blob/progress requires it.
- Keep access/refresh token handling centralized in `frontend/src/lib/api.ts` and `frontend/src/lib/auth.ts`.
- Use existing `Button`, `Card`, and `Input` primitives before adding new UI primitives.
- Use `cn` from `frontend/src/lib/utils.ts` for conditional class names.
- Preserve current Tailwind visual style unless task explicitly asks redesign.
- Keep protected dashboard pages inside `ProtectedRoute` and `DriveLayout`.
- Keep file/folder URL state in query params when it affects navigation, e.g. `folderId` and file search `q`.

## API Notes

General:

- `GET /health`
- Authenticated routes expect `Authorization: Bearer <accessToken>` unless listed as public.
- Every authenticated route serves one shared workspace: responses are never filtered by the calling user. See the tenancy rule under Agent Rules.

Auth:

- `POST /auth/login`
- `GET /auth/google/url`
- `GET /auth/google/callback`
- `POST /auth/google/exchange`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

Provider configs:

- `POST /provider-configs/google`
- `GET /provider-configs`
- `DELETE /provider-configs/:id`

Google connected accounts:

- `GET /connected-accounts/google/connect-url`
- `GET /connected-accounts/google/connect`
- `GET /connected-accounts/google/callback`
- `GET /connected-accounts`
- `POST /connected-accounts/:id/sync-quota`
- `DELETE /connected-accounts/:id`

Storage:

- `GET /storage/summary`
- `GET /storage/breakdown`

Folders:

- `GET /folders?parentId=<id>`
- `GET /folders?all=1`
- `GET /folders/recent?limit=4`
- `POST /folders`
- `PATCH /folders/:id`
- `DELETE /folders/:id`

Files:

- `GET /files`
- `GET /files?folderId=<id>`
- `GET /files?q=<search>`
- `GET /files/shared-links`
- `GET /files/:id`
- `PATCH /files/:id`
- `PATCH /files/batch`
- `DELETE /files/batch`
- `POST /files/sync-google`
- `POST /files/:id/share`
- `DELETE /files/:id/share`
- `POST /files/:id/preview-token`
- `GET /files/:id/view-url`
- `GET /files/:id/download`
- `DELETE /files/:id`
- `GET /files/preview/:token`

Invites:

- `GET /invites`
- `POST /invites`
- `DELETE /invites/:id`

Public shared files:

- `GET /public/files/:token`
- `GET /public/files/:token/download`
- `GET /public/files/:token/preview`

Uploads:

- `POST /uploads`
- Content type: `multipart/form-data`.
- Current frontend sends metadata first as `filesMeta`: JSON array of `{ fieldName, fileName, mimeType, sizeBytes, folderId? }`.
- File fields then match `filesMeta[*].fieldName`, e.g. `file-0`, `file-1`.
- Backend selects a connected Drive account with enough available quota and streams each file directly to Google Drive.
- Google Drive uploads are placed under the root Drive folder named `Ithaca`; virtual folders remain app/database-only.
- `POST /files/sync-google` treats Google Drive folder `Ithaca` as source of truth for physical files: create missing Postgres file rows, update changed metadata, and mark missing Drive files as deleted.

## Docker

Commands:

- `docker compose up -d --build`: build and start Postgres, backend, frontend.
- `docker compose exec backend pnpm seed:google-config`: seed Google config inside backend container.
- `docker compose logs -f backend`: backend logs.
- `docker compose logs -f frontend`: frontend logs.
- `docker compose logs -f postgres`: Postgres logs.
- `docker compose down`: stop services.
- `docker compose down -v`: stop services and remove DB volume.

Docker notes:

- Postgres image is `postgres:16`.
- Backend listens on `4000`.
- Frontend build is served by nginx on host port `5173`.
- Frontend build arg `VITE_API_URL` is embedded at build time.
- Rebuild frontend when `VITE_API_URL` changes.

## Verification

Before finishing backend changes:

- `cd backend && pnpm build`

Before finishing frontend changes:

- `cd frontend && pnpm build`

Before finishing schema changes:

- `cd backend && pnpm prisma:migrate`
- `cd backend && pnpm build`

Manual smoke test:

- Login.
- Open Settings.
- Connect Google Drive.
- Verify connected account appears.
- Open Quota Tracker and sync quota.
- Create nested folders in All Files.
- Use header search for an uploaded file name.
- Upload one or more files and verify progress panel.
- Switch file list/grid view.
- Right-click file and test preview/download/rename/move/share/invite/delete where relevant.
- Open Shared page and verify shared links/invites.
- Open public file link and test preview/download.

## Agent Rules

- Ithaca is a single shared workspace, not multi-tenant. `userId` columns record who created a row; they must never be used to filter reads or to gate mutations. Do not add `where: { userId: req.user!.id }` to a new route, and keep passing `userId` in `create` data (the columns are NOT NULL).
- Read the routing-policy singleton through `getOrCreateRoutingPolicy()` (`backend/src/modules/storage/routing-policy.service.ts`); there is one policy row for the whole app.
- Never hard-delete a `User` row (`onDelete: Cascade` would take shared files, folders and connected accounts with it). Disable instead.
- Prefer small, targeted changes.
- Preserve existing architecture and naming.
- Do not introduce new dependencies unless necessary.
- Do not commit secrets.
- Do not edit `node_modules`, build output, or generated Prisma client.
- Do not change auth/token storage behavior without explicit reason.
- Do not change Google OAuth scopes or redirect behavior without checking README and env requirements.
- Do not change upload behavior to write files to disk.
