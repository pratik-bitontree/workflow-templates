# Workflow Templates FE

Next.js app for browsing workflow templates, running them with dynamic forms, and managing integrations.

## Setup

1. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_API_BASE_URL` – backend base URL (templates-workflow-BE). `/api` is appended automatically.
   - `NEXT_PUBLIC_CONNECT_BASE_URL` (optional) – base URL for OAuth Connect links in Integration Hub.

2. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

1. Import the project in Vercel and connect the repo.
2. Set environment variables in the Vercel project:
   - `NEXT_PUBLIC_API_BASE_URL` – e.g. `https://api.yourdomain.com`
   - `NEXT_PUBLIC_CONNECT_BASE_URL` (optional) – e.g. `https://api.yourdomain.com` if OAuth runs on the same host.
3. Deploy. The app uses the default Next.js build; no extra config is required.

## Routes

- `/` – Home with links to Templates and Integrations.
- `/templates` – List of prebuilt workflow templates.
- `/templates/[id]` – Run a template (dynamic form + run + results).
- `/integrations` – Integration Hub (connect status and Connect/Manage links).
