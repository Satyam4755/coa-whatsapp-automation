# COA WhatsApp Automation: Full Setup From Scratch

This document explains how to set up the system from zero on a new machine when you do not yet have:

- hosting
- domain
- MongoDB
- Redis
- WhatsApp Business webhook configuration
- admin users

It also explains how the product works operationally:

- admin login
- template creation and sync
- architect source and Excel behavior
- job scheduling and monitoring
- inbound automation when a user messages your WhatsApp number

## 1. What this system contains

The repo has two main parts:

- `Client/`: React + Vite admin panel
- `Server/`: Express API, auth, WhatsApp webhook, template APIs, background jobs, Socket.IO

Main runtime responsibilities:

- Admin auth with access token + refresh cookie
- Template creation against Meta WhatsApp template APIs
- Template header image upload for Meta review
- Architect list fetch from COA upstream API
- Schedule/send via background jobs
- Live job monitoring via Socket.IO
- Inbound WhatsApp webhook handling for status/help flows

## 2. Important reality of the current code

Before setup, understand these current implementation facts:

### 2.1 Architect data is not stored in your DB

The architects list is fetched live from:

- `https://coa.gov.in/AllArchitectDataAPI.php`

Code:

- [Server/controllers/admin.js](Server/controllers/admin.js)

There are also a few hardcoded test architects appended in code.

### 2.2 Excel upload is currently preview-only

Uploading Excel in Architects:

- parses rows in the browser
- shows them in the UI
- allows selecting them for scheduling

It does **not** persist architect rows into MongoDB.

If you need Excel import to DB, that needs a separate import API and persistence model.

### 2.3 Webhook verify token is environment-based

The webhook verification route now reads:

- `WA_WEBHOOK_VERIFY_TOKEN`

from server environment configuration.

### 2.4 Background jobs require Redis

The schedule/send flow uses BullMQ. Without Redis:

- job queue processing will not work correctly

Relevant files:

- [Server/services/bulkJobQueue.js](Server/services/bulkJobQueue.js)
- [Server/services/BulkJobProcessor.js](Server/services/BulkJobProcessor.js)

### 2.5 Live job updates require the server process that owns Socket.IO

The admin jobs screen depends on:

- Socket.IO server in `Server/server.js`
- job updates emitted by `BulkJobProcessor`

## 3. Prerequisites

Install:

- Node.js 18+ recommended
- npm
- MongoDB connection string
- Redis connection string
- Meta developer account
- WhatsApp Business Account
- WhatsApp Business phone number

Recommended external services if you have no infrastructure yet:

- MongoDB Atlas free/shared cluster
- Upstash Redis or Redis Cloud
- local tunnel for webhook testing:
  - `ngrok`
  - `cloudflared`

## 4. Folder-level setup

### 4.1 Install client

From repo root:

```bash
cd Client
npm install
```

### 4.2 Install server

```bash
cd ../Server
npm install
```

## 5. Server environment setup

Use:

- [Server/.env.example](Server/.env.example)

Create:

- `Server/.env`

Minimum required values:

```env
NODE_ENV=development
PORT=8080
CLIENT_URL=http://localhost:5173

MONGO_URI=your_mongodb_connection_string

REDIS_URL=redis://localhost:6379
BULK_JOB_CONCURRENCY=1
WA_RATE_LIMIT_PER_SECOND=5
WA_RATE_LIMIT_PER_MINUTE=300

ADMIN_SECRET_KEY=replace_me
ADMIN_ACCESS_TOKEN_SECRET=replace_me
ADMIN_REFRESH_TOKEN_SECRET=replace_me
ADMIN_ACCESS_TOKEN_EXPIRES_IN=15m
ADMIN_REFRESH_TOKEN_EXPIRES_IN=7d
ADMIN_REFRESH_COOKIE_MAX_AGE_MS=604800000

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

WA_ACCESS_TOKEN=your_meta_whatsapp_access_token
WA_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
WA_BUSINESS_ACCOUNT_ID=your_whatsapp_business_account_id
WA_APP_ID=your_meta_app_id
WA_WEBHOOK_VERIFY_TOKEN=replace_with_strong_webhook_verify_token

COA_WELCOME_IMAGE=https://your-public-image-url/example.png

HELPLINE_EMAIL=support@example.com
HELPLINE_NUMBER=011-00000000
COURIER_COMPANY_NAME=India Post
```

## 6. Client environment setup

Client code currently reads:

- `VITE_API_URL`
- `VITE_SERVER_URL`

Create `Client/.env`:

```env
VITE_API_URL=http://localhost:8080/api
VITE_SERVER_URL=http://localhost:8080
```

Notes:

- `VITE_API_URL` is used for REST requests
- `VITE_SERVER_URL` is used for Socket.IO

## 7. MongoDB setup when you have no DB yet

Recommended simple option:

1. Create a MongoDB Atlas account
2. Create a cluster
3. Create database user
4. Allow your current IP
5. Copy connection string
6. Put it into `Server/.env` as `MONGO_URI`

Validate:

```bash
cd Server
npm run check
node server.js
```

You should see MongoDB connect logs in the server console.

## 8. Redis setup when you have no Redis yet

Options:

- local Redis on your machine
- Docker Redis
- Upstash Redis
- Redis Cloud

Example Docker quick start:

```bash
docker run -d --name coa-redis -p 6379:6379 redis:7
```

Then:

```env
REDIS_URL=redis://localhost:6379
```

Without Redis:

- background scheduling and job queue processing are not production-ready

## 9. Run locally

### 9.1 Start server

```bash
cd Server
npm run dev
```

### 9.2 Start client

```bash
cd Client
npm run dev
```

Expected local URLs:

- Client: `http://localhost:5173`
- Server: `http://localhost:8080`

## 10. Create your first admin user

A dedicated script exists now:

- [Server/scripts/create-admin.js](Server/scripts/create-admin.js)

Use:

```bash
cd Server
npm run create-admin -- admin@example.com StrongPassword123
```

Optional name:

```bash
npm run create-admin -- admin@example.com StrongPassword123 "Primary Admin"
```

What it does:

- lowercases email
- hashes password
- creates admin if email does not already exist

If you prefer API-based creation, the repo also has:

- `POST /api/admin/signup`

But the script is simpler for first-time setup.

## 11. Hosting when you have no domain yet

You have two phases:

### Phase A: local development with tunnel

Use a public tunnel so Meta can reach your local webhook.

Example with ngrok:

```bash
ngrok http 8080
```

That gives a public URL like:

- `https://abcd1234.ngrok-free.app`

Use that for webhook setup.

### Phase B: production hosting

Recommended split:

- Client: Vercel / Netlify / static host
- Server: Render / Railway / VPS / DigitalOcean App Platform
- MongoDB: Atlas
- Redis: Upstash / Redis Cloud

You do not need a custom domain to make the system work.

You only need:

- one stable public HTTPS URL for the server

## 12. WhatsApp / Meta setup

You need:

- Meta app
- WhatsApp product added to that app
- WhatsApp Business Account
- Phone Number ID
- Access token

Important repo integration points:

- message sending uses `WA_ACCESS_TOKEN` and `WA_PHONE_NUMBER_ID`
- template APIs use `WA_ACCESS_TOKEN` and `WA_BUSINESS_ACCOUNT_ID`
- header media upload also uses `WA_APP_ID`

## 13. Webhook setup in WhatsApp

Current webhook endpoints in this repo:

- verify endpoint: `GET /webhook`
- event endpoint: `POST /webhook`

Current verify token source:

- `WA_WEBHOOK_VERIFY_TOKEN`

Current full local-tunnel example:

- verify URL: `https://your-public-url/webhook`
- verify token: your `WA_WEBHOOK_VERIFY_TOKEN` value

### Recommended setup steps

1. Start the server
2. Expose it publicly using ngrok or a hosted URL
3. In Meta WhatsApp webhook configuration:
   - callback URL: `https://your-public-url/webhook`
   - verify token: your `WA_WEBHOOK_VERIFY_TOKEN` value
4. Subscribe to message-related webhook fields
5. Save and verify

If `WA_WEBHOOK_VERIFY_TOKEN` is missing, the server now returns HTTP 500 for
webhook verification requests. That is intentional and helps fail fast on bad
deployment configuration.

## 14. Current inbound automation behavior when someone messages

This app does not only send outbound campaign messages. It also handles inbound WhatsApp messages on the configured webhook.

Current flow in [Server/server.js](Server/server.js):

### 14.1 First inbound message

If a user sends a free-text message and no state is active:

- server sends a welcome menu template

Current welcome template name:

- `coa_welcome_menu`

Menu options handled by button text:

- `Architect Status`
- `Application Status`
- `Dispatch Status`

### 14.2 Architect Status flow

When user selects `Architect Status`:

- bot asks for architect registration number
- validates format like `CA/YYYY/XXXXX` or `CA/YYYY/XXXXXX`
- fetches status from COA verification API
- if sender mobile matches architect mobile, bot returns status directly
- otherwise OTP verification is initiated

### 14.3 Dispatch Status flow

When user selects `Dispatch Status`:

- bot asks for registered mobile number
- later dispatch-specific verification logic runs

### 14.4 Application Status flow

When user selects `Application Status`:

- bot asks for application number
- later application-specific verification logic runs

### 14.5 Status callbacks from WhatsApp

Webhook also logs WhatsApp delivery status updates from:

- `change.value.statuses`

This is separate from admin background-job monitoring.

## 15. Template creation guide

Templates are managed from:

- Admin -> Templates

Backend routes:

- `GET /api/template`
- `GET /api/template/:id`
- `POST /api/template`
- `PUT /api/template/:id`
- `DELETE /api/template/:id`
- `POST /api/template/template/sync-status`
- `POST /api/template/image/upload-header-image`

### 15.1 What the app enforces

Current validation in [Server/controllers/messageTemplate.controller.js](Server/controllers/messageTemplate.controller.js):

- template name must start with lower-case letter
- allowed characters: lower-case letters and underscores
- categories:
  - `AUTHENTICATION`
  - `MARKETING`
  - `UTILITY`
- language must match Meta format like `en_US`
- BODY component is required
- variable placeholders must be sequential:
  - `{{1}}`, `{{2}}`, `{{3}}`
- footer cannot contain variables
- max 3 buttons
- URL buttons must be `https://`
- phone buttons must be international format

### 15.2 Header image flow

For image-header templates:

1. Upload image via `/api/template/image/upload-header-image`
2. Server uploads it to Meta and optionally Cloudinary preview
3. Returned media handle is used in template submission

Requirements enforced in code:

- JPG or PNG only
- file size <= 5 MB

### 15.3 Submit for Meta review

Creating a template in this app:

- validates locally
- submits to Meta template API
- stores local template with Meta status/id

### 15.4 Sync status

Use `Sync Status` in the UI to:

- pull latest status from Meta
- mark local stale templates as `MISSING_ON_META`

### 15.5 Important production behavior

Once submitted to Meta:

- templates in `PENDING` or `APPROVED` are intentionally not editable locally
- create a new template name for changes that require Meta review

## 16. Architect upload guide

There are two architect paths currently:

### 16.1 COA live source

Primary source is remote COA data from backend.

### 16.2 Excel upload

Excel upload in Architects:

- downloads a template with columns:
  - `archRegNum`
  - `archName`
  - `archdob`
  - `archValidityUpTo`
  - `Mobile`
  - `Email`
- previews uploaded rows in the UI
- allows selecting them for schedule/send

Important:

- this does **not** update MongoDB
- this does **not** become a permanent architect dataset
- it is a temporary scheduling audience path only

If you need database persistence for uploaded architects, implement:

- architect model
- import endpoint
- upsert logic by `archRegNum`

## 17. Job schedule guide

The scheduling flow is:

1. Architects
2. Templates
3. Schedule
4. Send
5. Jobs monitoring

### 17.1 Architects step

- select recipients from live COA list or uploaded preview rows
- click `Schedule`

### 17.2 Templates step

- select one approved template
- continue to Schedule

### 17.3 Schedule step

Schedule page shows:

- selected architects count
- selected template
- mobile preview
- send action

Only approved templates can be sent.

### 17.4 Send action

Send does not immediately push everything in the browser loop.

It creates a background job by calling:

- `POST /api/admin/create-background-job`

That job is stored in MongoDB and queued through BullMQ + Redis.

## 18. How automation works after scheduling

When admin clicks send:

1. backend validates template is `APPROVED`
2. backend validates recipients and phone numbers
3. backend creates a `BulkMessageJob`
4. backend enqueues job into Redis-backed queue
5. `BulkJobProcessor` consumes the queue
6. each recipient is processed and sent via Meta API
7. job progress is saved in MongoDB
8. progress is emitted over Socket.IO
9. admin jobs UI updates live

Relevant files:

- [Server/controllers/admin-background-jobs.js](Server/controllers/admin-background-jobs.js)
- [Server/services/BulkJobProcessor.js](Server/services/BulkJobProcessor.js)
- [Server/services/bulkJobQueue.js](Server/services/bulkJobQueue.js)
- [Client/src/Components/Admin/JobMonitoringDashboard.jsx](Client/src/Components/Admin/JobMonitoringDashboard.jsx)

## 19. Jobs monitoring guide

Jobs page supports:

- list of jobs
- filters
- status chips
- job detail deep link
- recipient-level detail
- export recipients
- live updates through Socket.IO

Important operational requirement:

- Server and Redis must both be healthy
- Socket.IO client must point to the right `VITE_SERVER_URL`

## 20. Recommended first-time smoke test

After setup, test in this order:

1. Run MongoDB
2. Run Redis
3. Start server
4. Start client
5. Create admin with script
6. Log in
7. Open Templates and create one Meta-approved template
8. Open Architects and verify list loads
9. Select one architect
10. Continue to Schedule
11. Verify audience and template preview
12. Send one test job
13. Confirm job appears in Jobs
14. Confirm recipient status updates live
15. Send a WhatsApp message to the business number and verify webhook flow

## 21. Recommended production hardening before go-live

These are high-value improvements before calling the system production-ready:

1. Rotate and manage `WA_WEBHOOK_VERIFY_TOKEN` like any other production secret
2. Replace Excel preview-only flow with proper import API if persistence is required
3. Remove hardcoded test architects from backend
4. Add health endpoints for:
   - MongoDB
   - Redis
   - Socket.IO readiness
5. Add structured logging for webhook and background jobs
6. Add admin audit trail for:
   - template creation
   - job creation
   - deletes
7. Add rate-limit and retry observability around Meta send failures
8. Add proper secrets management on hosted environment
9. Add a documented backup/restore plan for templates and job history
10. Add automated tests for:
   - auth
   - template validation
   - job creation
   - websocket job updates

## 22. Useful commands

### Server

```bash
cd Server
npm install
npm run dev
npm run check
npm run create-admin -- admin@example.com StrongPassword123
```

### Client

```bash
cd Client
npm install
npm run dev
npm run build
```

### Redis with Docker

```bash
docker run -d --name coa-redis -p 6379:6379 redis:7
```

### ngrok

```bash
ngrok http 8080
```

## 23. Setup checklist

- [ ] Node installed
- [ ] Client dependencies installed
- [ ] Server dependencies installed
- [ ] MongoDB configured
- [ ] Redis configured
- [ ] Server `.env` created
- [ ] Client `.env` created
- [ ] Meta app created
- [ ] WhatsApp product added
- [ ] Access token set
- [ ] Phone number ID set
- [ ] Business account ID set
- [ ] Cloudinary set
- [ ] Webhook callback configured
- [ ] Webhook verify token matched
- [ ] Admin created
- [ ] Template created and approved
- [ ] Architects list verified
- [ ] One background job successfully processed
- [ ] Inbound WhatsApp webhook verified
