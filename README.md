# AMLDOCK

Real-estate AML/compliance web application for a single NZ-based compliance firm. Tracks deals from broker draft through compliance review to approval or rejection, with nested ownership-structure modelling and stubbed NZ verification integrations. See `C:\Users\Shubh Sharma\.claude\plans\let-s-plan-the-work-jaunty-whistle.md` for the full plan.

## Stack
- Backend: Spring Boot 3.5 (Java 21+), PostgreSQL, Flyway
- Frontend: Vite + React + MUI (JavaScript)
- Storage: AWS S3 (later milestones)
- Auth: JWT in `httpOnly` cookies

## Running locally (M1)

### 1. Start Postgres
```
docker compose up -d postgres
```

### 2. Run backend

Set `JWT_SECRET` before launching. It is required and has no default: the backend refuses to start without it. Use a random value of at least 32 bytes, generated once per environment and never committed (for example `openssl rand -base64 48`).

Set the AWS / S3 env vars before launching (required from M4 onwards — Spring will fail to construct the S3 client without a region/bucket, and presigned URLs need real credentials):

PowerShell:
```
$env:JWT_SECRET="<output of: openssl rand -base64 48>"
$env:AWS_ACCESS_KEY_ID="AKIA..."
$env:AWS_SECRET_ACCESS_KEY="..."
$env:AWS_REGION="ap-southeast-2"
$env:S3_BUCKET="aml-dock-dev-documents"
```

bash:
```
export JWT_SECRET="<output of: openssl rand -base64 48>"
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=ap-southeast-2
export S3_BUCKET=aml-dock-dev-documents
```

#### Optional: SMTP for onboarding emails

When an admin creates a user, a welcome email goes out with their temporary password and a deep-link to `/profile`. By default the email service runs in **logging-only** mode: the backend log records the recipient and subject, but not the body, because bodies carry sign-in codes and passwords. On your own machine only, set `MAIL_LOG_BODIES=true` to log bodies too; never set it on a server.

To actually send via SMTP:

```
MAIL_ENABLED=true
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=apikey
MAIL_PASSWORD=...
MAIL_FROM=noreply@yourdomain.example
MAIL_FROM_NAME=AMLDOCK
MAIL_REPLY_TO=support@yourdomain.example   # optional
APP_BASE_URL=http://localhost:5173         # used in email links
```

Defaults: `MAIL_ENABLED=false`, `MAIL_PORT=587`, `MAIL_SMTP_AUTH=true`, `MAIL_SMTP_STARTTLS=true`.

**Local dev (`dev` profile):** mail goes to the Mailpit container in `docker-compose.yml`, not to a public relay — most ISPs block outbound port 25, so external test relays time out. Start it with `docker compose up -d mailpit` and read captured mail at **http://localhost:8025**. The `dev` profile already points at `localhost:1025`; override with `MAIL_HOST`/`MAIL_PORT` if needed.

Then:
```
cd backend
./mvnw spring-boot:run
```
The backend starts on `http://localhost:8080`. On first start, Flyway creates the schema. The seeder creates the ROOT administrator only from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. There is no built-in default: if either is unset, or the password is the retired `Admin123!`, no ROOT is created and the log says why. Set both before the first start of any new database.

Session cookies are `Secure` by default (`COOKIE_SECURE=true`). Chrome, Edge and Firefox accept them on `http://localhost`. Set `COOKIE_SECURE=false` only for local dev in Safari or on a plain-HTTP host that is not localhost; never in production.

The bucket must allow PUT and GET from your dev machine's IP for the presigned URLs to work (default S3 permissions are fine if the credentials' IAM user has `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:HeadObject` on the bucket). CORS on the bucket must allow `PUT` from `http://localhost:5173` — see `infra/s3-cors.example.json`.

### 3. Run frontend
```
cd frontend
npm install
npm run dev
```
Vite serves on `http://localhost:5173`.

## Smoke test
1. Open http://localhost:5173 → redirected to `/login`.
2. Log in as `admin@amldock.local` / `Admin123!`.
3. Go to **Admin → Users**, create a broker and a compliance officer.
4. Log out, log back in as each new user, confirm role-appropriate landing page.

## Repository layout
- `backend/` — Spring Boot service
- `frontend/` — Vite + React app
- `infra/` — deployment notes (later milestones)
- `docker-compose.yml` — local Postgres
