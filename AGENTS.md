# Gestions Access — No-Code Table Builder

## Monorepo layout

```
├── backend/       # Express + Prisma + TypeScript (CommonJS)
└── frontend/      # React + Vite + TypeScript + Tailwind (ESM)
```

## Quick start

```bash
# 1. DB + object storage
docker compose up -d postgres minio

# 2. Backend
cd backend
cp .env.example .env           # already done if .env exists
npm install
npx prisma migrate dev         # apply migrations
npx prisma db seed             # demo users (admin/editor/reader)
npm run dev                    # tsx watch on :3001

# 3. Frontend
cd frontend
npm install
npm run dev                    # Vite on :5173, proxies /api -> :3001
```

## Dev URLs

| Service     | URL                         |
|-------------|-----------------------------|
| Frontend    | http://localhost:5173       |
| API         | http://localhost:3001/api   |
| MinIO admin | http://localhost:9001       |
| PostgreSQL  | localhost:5432              |

## Demo accounts

| Role    | Email              | Password  |
|---------|--------------------|-----------|
| Admin   | admin@example.com  | admin123  |
| Editor  | editor@example.com | editor123 |
| Reader  | reader@example.com | reader123 |

## Backend scripts (all from `backend/`)

| Command                         | What it does                              |
|---------------------------------|-------------------------------------------|
| `npm run dev`                   | Hot-reload via `tsx watch src/index.ts`   |
| `npm run build`                 | `tsc` -> `dist/`                          |
| `npm run start`                 | `node dist/index.js`                      |
| `npx prisma migrate dev`        | Apply + create migration                  |
| `npx prisma db push`            | Sync schema without migration             |
| `npx prisma db seed`            | Run `prisma/seed.ts` (via tsx)            |
| `npx prisma generate`           | Regenerate Prisma client                  |

## Frontend scripts (all from `frontend/`)

| Command         | What it does                     |
|-----------------|----------------------------------|
| `npm run dev`   | `vite` on :5173                  |
| `npm run build` | `tsc -b && vite build`           |
| `npm run preview`| `vite preview`                  |

## API routes

All under `/api/`:
`auth`, `tables`, `columns`, `rows`, `views`, `upload`, `search`, `export`, `import`, `analytics`, `users`, `forms`, `backups`, `documents`, `email-accounts`, `oauth`, `requests`.

JWT auth via `Authorization: Bearer <token>` header. Three roles (ADMIN > EDITOR > READER). Table-level permissions checked in `middleware/auth.ts`.

## Demandes (workflow de validation)

- **Module email** (`src/services/emailSender.ts` + `graphClient.ts`) : envoi via Microsoft Graph API (OAuth2 Outlook/M365) ou fallback SMTP nodemailer. Comptes configurés en base (`EmailAccount`, page admin "Comptes email"). Sélection : OUTLOOK par défaut → OUTLOOK → SMTP par défaut → SMTP.
- **Flux demande** : utilisateur connecté crée une demande (`POST /api/requests`, type + email du supérieur) → email au supérieur avec lien public `/requests/review/:token` (boutons Valider/Refuser, idempotent) → décision notifiée à `NOTIFICATION_EMAIL` (setting en base, page "Comptes email").
- **Settings email** en base (`SystemSetting` : `NOTIFICATION_EMAIL`, `FRONTEND_URL`), fallback `.env`.
- OAuth callback Microsoft : `/api/oauth/outlook/callback` (proxy nginx `/api/` → backend).

## Architecture notes

- **Frontend** uses `@/` path alias (maps to `src/`). Axios instance in `services/api.ts` with auto-token interceptor.
- **Backend** entry: `src/index.ts`. Prisma client singleton in `src/lib/prisma.ts`.
- **Database** schema: `prisma/schema.prisma`. Dynamic table model via polymorphic `CellValue` rows (not separate SQL tables per user table).
- **Uploads**: MinIO (S3-compatible). Dev credentials in `.env.example`.
- **Docker (prod)** serves frontend via nginx on :8888 (docker-compose) or :8080 (docker-compose.prod.yml).
- **No tests, no linter, no formatter, no CI** configured in the repo.

## Prisma safety

- Use `prisma db push` only for rapid prototyping (forces --accept-data-loss in start.sh).
- Prefer `prisma migrate dev` for tracked schema changes.
- Backend `start.sh` runs `prisma db push --accept-data-loss` on container boot (production startup script).
