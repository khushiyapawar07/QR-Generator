# GateQR

GateQR is a QR-based event entry management MVP built from your PRD + technical README.

It supports:
- Event creation
- Excel/CSV attendee upload (`.xlsx`, `.xls`, `.csv`)
- Flexible column mapping (`name`, `phone`, `email`, etc.)
- Unique secure QR token generation per attendee
- QR pass download with attendee name shown above the QR
- Bulk ZIP download of all QR passes
- One-time check-in validation (`VALID_CHECKED_IN`, `ALREADY_USED`, `INVALID_QR`, etc.)
- Attendance dashboard stats
- CSV attendance export
- Refreshed UI with a clean blue/slate palette and simplified flows
- Middleware-based role guard scaffolding (`admin`, `scanner`)

## Tech Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- `qrcode`, `xlsx`, `papaparse`, `zod`, `jszip`
- Supabase packages included (`@supabase/supabase-js`) for production integration

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

3. Start dev server:

```bash
npm run dev
```

4. Open:

- Home: `http://localhost:3000`
- Admin: `http://localhost:3000/admin`
- Scanner: `http://localhost:3000/scanner`
- Login: `http://localhost:3000/login`

## Auth / Role Guard (Next Step Ready)

- By default, `ENABLE_AUTH=false` so routes stay open during local MVP usage.
- Set `ENABLE_AUTH=true` in `.env.local` to enforce middleware route guards.
- Dev role login helper endpoint is available at `POST /api/auth/dev-role` (used by `/login` buttons).
- Supabase helpers are scaffolded in:
  - `lib/supabase/client.ts`
  - `lib/supabase/server.ts`

## How To Use

1. Go to `/admin` and create an event.
2. Click **Upload Attendees** for that event.
3. Upload `.xlsx`, `.xls`, or `.csv` file.
4. System validates rows and generates unique QR tokens.
5. Download individual passes or bulk ZIP.
6. Open scanner (`/scanner/[eventId]`) and paste QR token to check in.
7. Second scan of same token returns `ALREADY_USED`.

## API Endpoints Implemented

- `POST /api/events`
- `GET /api/events`
- `POST /api/events/:eventId/attendees/upload-excel`
- `GET /api/events/:eventId/attendees`
- `GET /api/events/:eventId/attendees/export`
- `GET /api/events/:eventId/attendees/:attendeeId/pass`
- `POST /api/events/:eventId/qr/bulk-download`
- `POST /api/checkin`
- `GET /api/events/:eventId/dashboard`

## Data Storage Note

Current MVP uses local JSON storage in `data/db.json` so the project runs instantly without external setup.

For production, switch storage/auth to Supabase (schema starter SQL included in `supabase/migrations/0001_gateqr_schema.sql`).

## Production Migration Notes

- Configure Supabase keys in `.env.local`
- Apply SQL migration
- Replace `lib/db.ts` calls with Supabase queries/RPC (`check_in_attendee`)
- Add Supabase Auth + role guards (`admin`, `scanner`)
- Add RLS policies before deployment
