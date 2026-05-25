# AML_DOCK

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

Set the AWS / S3 env vars before launching (required from M4 onwards — Spring will fail to construct the S3 client without a region/bucket, and presigned URLs need real credentials):

PowerShell:
```
$env:AWS_ACCESS_KEY_ID="AKIA..."
$env:AWS_SECRET_ACCESS_KEY="..."
$env:AWS_REGION="ap-southeast-2"
$env:S3_BUCKET="aml-dock-dev-documents"
```

bash:
```
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=ap-southeast-2
export S3_BUCKET=aml-dock-dev-documents
```

Then:
```
cd backend
./mvnw spring-boot:run
```
The backend starts on `http://localhost:8080`. On first start, Flyway creates the schema and the seeder inserts a default admin:
- email: `admin@amldock.local`
- password: `Admin123!`

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
