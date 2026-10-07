# Docker Setup

This project runs with four containers:

- `client`: React/Vite app served by Nginx on `http://localhost:5173`
- `server`: Express API and BullMQ worker on `http://localhost:8080`
- `mongo`: MongoDB for application data and bulk job progress
- `redis`: Redis for BullMQ background job queueing

## Run Locally

1. Create the Compose env file:

   ```bash
   cp .env.docker.example .env
   ```

2. Replace the placeholder values in `.env`, especially:

   ```env
   ADMIN_SECRET_KEY=
   ADMIN_ACCESS_TOKEN_SECRET=
   ADMIN_REFRESH_TOKEN_SECRET=
   CLOUDINARY_CLOUD_NAME=
   CLOUDINARY_API_KEY=
   CLOUDINARY_API_SECRET=
   WA_ACCESS_TOKEN=
   WA_PHONE_NUMBER_ID=
   WA_BUSINESS_ACCOUNT_ID=
   WA_APP_ID=
   COA_WELCOME_IMAGE=
   ```

3. Start everything:

   ```bash
   docker compose up --build
   ```

4. Open:

   ```text
   Client: http://localhost:5173
   Server: http://localhost:8080
   MongoDB: localhost:27017
   Redis: localhost:6379
   ```

## Background Jobs

Bulk message jobs are now queued in Redis with BullMQ. Job details, progress, recipient status, and dashboard data remain stored in MongoDB through `BulkMessageJob`.

When the server starts, it re-enqueues MongoDB jobs with `pending` or `processing` status so unfinished jobs can continue after a restart.

WhatsApp sending is rate-limited by env variables:

```env
BULK_JOB_CONCURRENCY=1
WA_RATE_LIMIT_PER_SECOND=5
WA_RATE_LIMIT_PER_MINUTE=300
```

Keep these conservative unless your WhatsApp phone number is approved for higher throughput. `BULK_JOB_CONCURRENCY=1` is recommended because WhatsApp limits apply to the sending phone number, not just one job.

## Useful Commands

```bash
docker compose up --build
docker compose down
docker compose down -v
docker compose logs -f server
docker compose logs -f redis
```

Use `docker compose down -v` only when you intentionally want to delete local MongoDB and Redis data volumes.
