# Technical README — GateQR System Architecture

## 1. Project Overview

GateQR is a production-ready QR-based event entry platform.

It allows organizations to upload attendee lists directly through Excel files, generate secure one-time QR codes, create QR passes with the attendee name displayed above the QR, send/download those passes, and validate those QR codes at the event entrance.

The application is designed for small events initially but must be architected to scale to lakhs of attendees and high-volume scanning.

---

## 2. Recommended Tech Stack

### Core Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js with App Router |
| Backend | Next.js Route Handlers / Server Actions |
| Hosting | Vercel |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Authorization | Supabase Row Level Security + app-level role checks |
| File Storage | Supabase Storage or Vercel Blob |
| QR Generation | `qrcode` npm package |
| Excel Upload Parsing | `xlsx` for `.xlsx` and `.xls`, `papaparse` for `.csv` |
| QR Pass Generation | Canvas/PDF generation using `canvas`, `pdf-lib`, or browser canvas |
| Bulk Download | `jszip` for ZIP generation |
| QR Scanning | `html5-qrcode` or `@zxing/browser` |
| CSV Parsing | `papaparse` for CSV fallback |
| Validation | `zod` |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Charts | Recharts |
| Logging | Supabase audit table + optional external logging |

### Optional Production Add-ons

| Need | Suggested Tool |
|---|---|
| Rate limiting | Upstash Redis |
| Background jobs | Inngest / Trigger.dev / QStash |
| Email sending | Resend / SendGrid |
| WhatsApp sending | WhatsApp Business API provider |
| Error monitoring | Sentry |
| Analytics | PostHog |
| Object storage for ZIPs | Supabase Storage / Vercel Blob |

---

## 3. High-Level Architecture

```text
Client Browser
  ├── Admin Dashboard
  ├── Attendee Upload UI
  ├── QR Download UI
  └── Scanner UI
        ↓
Next.js App on Vercel
  ├── Server Components
  ├── Route Handlers
  ├── Server Actions
  ├── Auth Middleware
  └── API Validation
        ↓
Supabase
  ├── Auth
  ├── PostgreSQL Database
  ├── Row Level Security
  ├── Storage
  └── Realtime / Dashboard Updates
        ↓
Optional Services
  ├── Redis Rate Limiting
  ├── Background Job Queue
  ├── Email Provider
  └── WhatsApp Provider
```

---

## 4. Core System Flow

### 4.1 Admin Upload Flow

```text
Admin logs in
↓
Admin creates/selects event
↓
Admin uploads Excel/CSV
↓
Server parses and validates Excel/CSV
↓
Server creates attendee records
↓
Server generates secure QR tokens and QR passes with attendee names above QR codes
↓
Attendees are stored in Supabase
↓
Admin can preview/download QR passes
```

### 4.2 QR Generation Flow

```text
Attendee created
↓
Server generates secure random token
↓
Token is saved in database
↓
QR image/pass is generated on demand with attendee name above the QR
↓
QR image encodes only token or signed payload
```

### 4.3 Check-In Flow

```text
Scanner staff logs in
↓
Scanner opens /scanner/[eventId]
↓
Camera scans QR
↓
QR token is sent to POST /api/checkin
↓
Server validates scanner permissions
↓
Server atomically updates attendee status
↓
Response returned:
  - Valid entry
  - Already checked in
  - Invalid QR
  - Event inactive
```


---

## 4.4 Excel Upload and Named QR Pass Flow

```text
Admin uploads .xlsx/.xls/.csv file
↓
Server reads first sheet or selected sheet
↓
Server maps columns such as Name, Phone, Email, Company
↓
Server validates each row
↓
For every valid attendee:
  - create attendee record
  - generate secure unique QR token
  - associate token with attendee
↓
Admin opens QR page
↓
System renders QR pass:
  - Event name
  - Attendee name above QR
  - QR code
  - Entry instruction
↓
Admin downloads one pass or all passes as ZIP/PDF
```

The attendee name must be printed above the QR code in the generated pass. The QR content must still contain only the secure token.

---

## 4.5 QR Pass Layout

Required pass layout:

```text
┌─────────────────────────────┐
│ Annual Company Meeting 2026 │
│                             │
│        Raj Sharma           │
│                             │
│        [ QR CODE ]          │
│                             │
│ Show this QR at entry gate  │
└─────────────────────────────┘
```

Required fields:

- Event name
- Attendee name above QR
- QR code
- Optional company name
- Optional event date/time
- Optional venue
- Entry instruction

The QR token should not contain attendee personal data.

Good QR content:

```text
gqr_live_ev_7K2A9_x4P9mL8vR2sQwT6nZ1bC
```

Bad QR content:

```text
Raj Sharma, 9876543210, ABC Ltd
```

---

## 4.6 Excel Upload Technical Requirements

Supported file formats:

```text
.xlsx
.xls
.csv
```

Use these libraries:

```text
xlsx       → parse .xlsx and .xls
papaparse  → parse .csv fallback
zod        → validate parsed rows
```

Required column:

```text
Name
```

Optional columns:

```text
Phone
Email
Company
Designation
Category
Notes
```

Flexible column aliases should be supported:

```ts
const COLUMN_ALIASES = {
  name: ["name", "full name", "client name", "attendee name", "guest name"],
  phone: ["phone", "mobile", "mobile number", "contact", "contact number"],
  email: ["email", "email id", "email address", "mail"],
  company: ["company", "company name", "organization", "organisation"],
  designation: ["designation", "role", "position", "title"],
  category: ["category", "type", "group"],
  notes: ["notes", "remarks", "comment"]
};
```

Upload validation must return an import summary:

```json
{
  "success": true,
  "totalRows": 400,
  "importedRows": 398,
  "failedRows": 2,
  "duplicateRows": 0,
  "generatedQrCount": 398,
  "errors": [
    {
      "rowNumber": 17,
      "reason": "Name is required"
    }
  ]
}
```

---

## 5. Important Production Rule

Never implement check-in using frontend-only logic.

Bad approach:

```text
Frontend checks if status is unused
Frontend sends update request
```

This can fail during simultaneous scans.

Correct approach:

```sql
UPDATE attendees
SET status = 'used',
    checked_in_at = now(),
    checked_in_by = :scanner_user_id
WHERE event_id = :event_id
  AND qr_token = :qr_token
  AND status = 'unused'
RETURNING *;
```

If the update returns one row, entry is valid.

If it returns zero rows, then query the token:

- If token exists and status is `used`, return `ALREADY_USED`.
- If token does not exist, return `INVALID_QR`.

This makes check-in atomic and prevents duplicate entry.

---

## 6. QR Token Strategy

### 6.1 Do Not Store Personal Data in QR

Bad QR content:

```text
Name: Raj Sharma, Phone: 9876543210, Event: Company Meeting
```

Good QR content:

```text
GQR_evt_8f3a92df_token_k92la81x
```

### 6.2 Token Requirements

- Random
- Unique
- Hard to guess
- Not based on phone number or email
- At least 128 bits of entropy
- Stored securely
- Indexed for fast lookup

### 6.3 Recommended Token Format

```text
gqr_live_<eventShortId>_<randomToken>
```

Example:

```text
gqr_live_ev_7K2A9_x4P9mL8vR2sQwT6nZ1bC
```

### 6.4 Higher-Security Option

Store only `qr_token_hash` in the database instead of raw token.

Flow:

```text
Generated token → hash using SHA-256 → store hash
QR contains raw token
Scanner sends raw token
Server hashes it
Server compares hash
```

This reduces damage if database data leaks.

---

## 7. Database Schema

Use Supabase PostgreSQL.

### 7.1 Organizations Table

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 7.2 Organization Members Table

```sql
create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'org_admin', 'event_admin', 'scanner', 'viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
```

### 7.3 Events Table

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  venue text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'Asia/Kolkata',
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);
```

### 7.4 Event Staff Table

```sql
create table event_staff (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('event_admin', 'scanner', 'viewer')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
```

### 7.5 Attendees Table

```sql
create table attendees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,

  name text not null,
  email text,
  phone text,
  company text,
  designation text,
  category text,
  notes text,

  qr_token text not null,
  qr_token_hash text,

  status text not null default 'unused'
    check (status in ('unused', 'used', 'blocked', 'cancelled')),

  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id),

  import_batch_id uuid,
  row_number integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (event_id, qr_token)
);
```

### 7.6 Scan Logs Table

```sql
create table scan_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  attendee_id uuid references attendees(id) on delete set null,
  scanner_user_id uuid references auth.users(id) on delete set null,

  qr_token_hash text,
  result text not null check (
    result in (
      'VALID_CHECKED_IN',
      'ALREADY_USED',
      'INVALID_QR',
      'EVENT_INACTIVE',
      'ATTENDEE_BLOCKED',
      'ERROR'
    )
  ),

  device_info jsonb,
  ip_address text,
  message text,

  created_at timestamptz not null default now()
);
```

### 7.7 Upload Jobs Table

```sql
create table upload_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  file_name text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  total_rows integer default 0,
  success_rows integer default 0,
  failed_rows integer default 0,
  error_report jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
```


### 7.8 Import Batches Table

Use this table to track Excel/CSV uploads and error reports.

```sql
create table import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  file_name text,
  file_type text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  total_rows integer default 0,
  imported_rows integer default 0,
  failed_rows integer default 0,
  duplicate_rows integer default 0,
  generated_qr_count integer default 0,
  error_report jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
```

---

## 8. Required Indexes

Indexes are important for lakh-scale usage.

```sql
create index idx_events_org_status on events (organization_id, status);

create index idx_attendees_event_status on attendees (event_id, status);

create unique index idx_attendees_event_token on attendees (event_id, qr_token);

create index idx_attendees_event_phone on attendees (event_id, phone);

create index idx_attendees_event_email on attendees (event_id, email);

create index idx_attendees_event_company on attendees (event_id, company);

create index idx_attendees_import_batch on attendees (import_batch_id);

create index idx_attendees_event_name_trgm on attendees using gin (name gin_trgm_ops);

create index idx_scan_logs_event_created_at on scan_logs (event_id, created_at desc);

create index idx_scan_logs_attendee on scan_logs (attendee_id);
```

Enable trigram extension for fast name search:

```sql
create extension if not exists pg_trgm;
```

---

## 9. Row Level Security

Enable RLS on all important tables.

```sql
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table events enable row level security;
alter table event_staff enable row level security;
alter table attendees enable row level security;
alter table scan_logs enable row level security;
alter table upload_jobs enable row level security;
```

### RLS Policy Concept

Users can access data only if they are members of the organization or assigned to the event.

Scanner users can:

- Read limited attendee fields for their assigned event.
- Perform scan/check-in using a secure server function or API route.
- Not bulk export attendee data.

Admin users can:

- Manage events.
- Upload attendees.
- Export reports.
- View full dashboard.

Important: For complex operations, use secure server-side API routes with Supabase service role key only on the server.

Never expose service role key to the browser.

---

## 10. Supabase Function for Atomic Check-In

Create a database function for safer check-in.

```sql
create or replace function check_in_attendee(
  p_event_id uuid,
  p_qr_token text,
  p_scanner_user_id uuid
)
returns table (
  result text,
  attendee_id uuid,
  attendee_name text,
  attendee_company text,
  checked_in_at timestamptz
)
language plpgsql
security definer
as $$
declare
  updated_attendee attendees%rowtype;
  existing_attendee attendees%rowtype;
  event_status text;
begin
  select status into event_status
  from events
  where id = p_event_id;

  if event_status is null then
    return query select 'INVALID_QR'::text, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  if event_status != 'active' then
    return query select 'EVENT_INACTIVE'::text, null::uuid, null::text, null::text, null::timestamptz;
    return;
  end if;

  update attendees
  set status = 'used',
      checked_in_at = now(),
      checked_in_by = p_scanner_user_id,
      updated_at = now()
  where event_id = p_event_id
    and qr_token = p_qr_token
    and status = 'unused'
  returning * into updated_attendee;

  if found then
    insert into scan_logs (
      organization_id,
      event_id,
      attendee_id,
      scanner_user_id,
      result,
      created_at
    )
    values (
      updated_attendee.organization_id,
      updated_attendee.event_id,
      updated_attendee.id,
      p_scanner_user_id,
      'VALID_CHECKED_IN',
      now()
    );

    return query select
      'VALID_CHECKED_IN'::text,
      updated_attendee.id,
      updated_attendee.name,
      updated_attendee.company,
      updated_attendee.checked_in_at;
    return;
  end if;

  select * into existing_attendee
  from attendees
  where event_id = p_event_id
    and qr_token = p_qr_token;

  if found then
    insert into scan_logs (
      organization_id,
      event_id,
      attendee_id,
      scanner_user_id,
      result,
      created_at
    )
    values (
      existing_attendee.organization_id,
      existing_attendee.event_id,
      existing_attendee.id,
      p_scanner_user_id,
      case
        when existing_attendee.status = 'used' then 'ALREADY_USED'
        when existing_attendee.status = 'blocked' then 'ATTENDEE_BLOCKED'
        else 'ERROR'
      end,
      now()
    );

    return query select
      case
        when existing_attendee.status = 'used' then 'ALREADY_USED'::text
        when existing_attendee.status = 'blocked' then 'ATTENDEE_BLOCKED'::text
        else 'ERROR'::text
      end,
      existing_attendee.id,
      existing_attendee.name,
      existing_attendee.company,
      existing_attendee.checked_in_at;
    return;
  end if;

  insert into scan_logs (
    event_id,
    scanner_user_id,
    result,
    created_at
  )
  values (
    p_event_id,
    p_scanner_user_id,
    'INVALID_QR',
    now()
  );

  return query select 'INVALID_QR'::text, null::uuid, null::text, null::text, null::timestamptz;
end;
$$;
```

Note for production: add authorization checks before allowing this function to run, either inside the function or in the server API route.

---

## 11. Folder Structure

```text
gateqr/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── events/
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   │   └── page.tsx
│   │   │   └── [eventId]/
│   │   │       ├── dashboard/
│   │   │       │   └── page.tsx
│   │   │       ├── attendees/
│   │   │       │   └── page.tsx
│   │   │       ├── upload/
│   │   │       │   └── page.tsx
│   │   │       ├── qrs/
│   │   │       │   └── page.tsx
│   │   │       ├── exports/
│   │   │       │   └── page.tsx
│   │   │       └── settings/
│   │   │           └── page.tsx
│   │   └── users/
│   │       └── page.tsx
│   ├── scanner/
│   │   ├── page.tsx
│   │   └── [eventId]/
│   │       ├── page.tsx
│   │       └── manual-search/
│   │           └── page.tsx
│   └── api/
│       ├── events/
│       ├── attendees/
│       ├── upload/
│       ├── qr/
│       ├── checkin/
│       └── exports/
├── components/
│   ├── ui/
│   ├── admin/
│   │   ├── ExcelUploadCard.tsx
│   │   ├── UploadSummary.tsx
│   │   └── AttendeeTable.tsx
│   ├── scanner/
│   ├── qr/
│   │   ├── QRPassPreview.tsx
│   │   ├── QRPassCard.tsx
│   │   └── BulkDownloadButton.tsx
│   └── charts/
├── lib/
│   ├── excel/
│   │   ├── parse-excel.ts
│   │   ├── map-columns.ts
│   │   └── validate-rows.ts
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── admin.ts
│   ├── auth/
│   │   ├── get-user.ts
│   │   └── require-role.ts
│   ├── qr/
│   │   ├── generate-token.ts
│   │   ├── generate-qr.ts
│   │   └── validate-token.ts
│   ├── csv/
│   │   ├── parse-attendees.ts
│   │   └── validate-attendees.ts
│   ├── pass/
│   │   ├── generate-pass.ts
│   │   ├── generate-pdf.ts
│   │   └── bulk-download.ts
│   ├── rate-limit.ts
│   └── utils.ts
├── types/
│   ├── database.ts
│   ├── attendee.ts
│   ├── event.ts
│   └── api.ts
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── middleware.ts
├── package.json
├── .env.example
└── README.md
```

---

## 12. Environment Variables

Create `.env.local`.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_APP_URL=http://localhost:3000

QR_TOKEN_SECRET=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

RESEND_API_KEY=
```

Rules:

- `NEXT_PUBLIC_*` values can be exposed to browser.
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to browser.
- Use service role only in server-only files.
- Add `server-only` import in files that use secret keys.

---

## 13. API Design


### 13.0 Upload Excel

`POST /api/events/:eventId/attendees/upload-excel`

Request:

- Multipart form data
- Key: `file`
- Accepted formats: `.xlsx`, `.xls`, `.csv`

Server behavior:

```text
Validate file extension and size
↓
Parse Excel/CSV
↓
Map columns
↓
Validate rows
↓
Generate unique QR token per valid row
↓
Insert attendees in batches
↓
Return upload summary
```

Response:

```json
{
  "success": true,
  "batchId": "uuid",
  "totalRows": 400,
  "importedRows": 398,
  "failedRows": 2,
  "duplicateRows": 0,
  "generatedQrCount": 398,
  "errors": []
}
```

### 13.0.1 Get QR Pass

`GET /api/events/:eventId/attendees/:attendeeId/pass`

Response:

- PNG or PDF pass file
- The pass must display attendee name above the QR code.

### 13.0.2 Bulk Download QR Passes

`POST /api/events/:eventId/qr/bulk-download`

For small events, return a ZIP download.

For large events, create a background job and return a job ID.


### 13.1 Create Event

`POST /api/events`

Request:

```json
{
  "name": "Annual Company Meeting",
  "venue": "Mumbai",
  "startsAt": "2026-05-02T10:00:00+05:30",
  "endsAt": "2026-05-02T14:00:00+05:30",
  "timezone": "Asia/Kolkata"
}
```

Response:

```json
{
  "success": true,
  "eventId": "uuid"
}
```

### 13.2 Upload Attendees

`POST /api/events/:eventId/attendees/upload`

Request:

- Multipart form data
- CSV file

Required CSV columns:

```text
name,email,phone,company,designation
```

Response:

```json
{
  "success": true,
  "uploadJobId": "uuid",
  "totalRows": 400,
  "successRows": 398,
  "failedRows": 2
}
```

### 13.3 Get Attendees

`GET /api/events/:eventId/attendees?page=1&limit=50&status=unused&search=raj`

Response:

```json
{
  "data": [],
  "page": 1,
  "limit": 50,
  "total": 400
}
```

### 13.4 Generate QR

`GET /api/events/:eventId/attendees/:attendeeId/qr`

Response:

- PNG image or signed QR URL

### 13.5 Check In

`POST /api/checkin`

Request:

```json
{
  "eventId": "uuid",
  "qrToken": "gqr_live_ev_7K2A9_x4P9mL8vR2sQwT6nZ1bC"
}
```

Response for valid entry:

```json
{
  "success": true,
  "result": "VALID_CHECKED_IN",
  "attendee": {
    "id": "uuid",
    "name": "Raj Sharma",
    "company": "ABC Ltd",
    "checkedInAt": "2026-05-02T10:35:00+05:30"
  }
}
```

Response for duplicate:

```json
{
  "success": false,
  "result": "ALREADY_USED",
  "message": "This QR has already been checked in.",
  "attendee": {
    "name": "Raj Sharma",
    "company": "ABC Ltd",
    "checkedInAt": "2026-05-02T10:35:00+05:30"
  }
}
```

Response for invalid QR:

```json
{
  "success": false,
  "result": "INVALID_QR",
  "message": "QR code is not valid for this event."
}
```

### 13.6 Dashboard

`GET /api/events/:eventId/dashboard`

Response:

```json
{
  "totalAttendees": 400,
  "checkedIn": 125,
  "pending": 275,
  "duplicateAttempts": 8,
  "invalidAttempts": 3,
  "recentCheckIns": []
}
```

---

## 14. Frontend Components

### Admin Components

- `EventCard`
- `CreateEventForm`
- `UploadCsvCard`
- `AttendeeTable`
- `QRCodeCard`
- `DashboardStats`
- `RecentCheckins`
- `ExportButton`
- `RoleGuard`

### Scanner Components

- `ScannerCamera`
- `ScanResultCard`
- `ManualSearch`
- `ScannerEventSelector`
- `LastScansList`

### Shared Components

- `Navbar`
- `Sidebar`
- `DataTable`
- `StatusBadge`
- `LoadingState`
- `ErrorState`
- `ConfirmDialog`

---

## 15. Scanner UX Requirements

The scanner page must be extremely simple.

### Valid Entry

Display:

```text
VALID ENTRY
Name: Raj Sharma
Company: ABC Ltd
Checked in at: 10:35 AM
```

Use green background/card.

### Already Used

Display:

```text
ALREADY CHECKED IN
Name: Raj Sharma
First check-in: 10:35 AM
Do not allow duplicate entry.
```

Use red or yellow warning.

### Invalid QR

Display:

```text
INVALID QR
This QR code does not belong to this event.
```

Use red background/card.

---

## 16. CSV Upload Rules

### Required Column

- `name`

### Optional Columns

- `email`
- `phone`
- `company`
- `designation`
- `notes`

### Validation

- Empty name rows should fail.
- Phone numbers should be cleaned.
- Email should be validated if present.
- Duplicate rows should be flagged.
- Large files should be chunked.
- CSV formula injection should be prevented when exporting.

### CSV Example

```csv
name,email,phone,company,designation
Raj Sharma,raj@example.com,9876543210,ABC Ltd,Manager
Amit Shah,amit@example.com,9876543211,XYZ Pvt Ltd,Director
```

---

## 17. Scaling Strategy for Lakhs of Users

### 17.1 Database

- Use indexes on `event_id`, `status`, `qr_token`, `phone`, and `email`.
- Use server-side pagination.
- Never fetch all attendees at once.
- Use aggregate queries for dashboard counts.
- Partition large tables by event or time in future if needed.
- Store scan logs separately from attendee table.

### 17.2 QR Generation

For small events:

- Generate QR on demand.

For large events:

- Generate QR ZIP as background job.
- Store generated ZIP in object storage.
- Notify admin when ZIP is ready.
- Avoid storing individual QR images unless required.

### 17.3 CSV Upload

For small events:

- Parse and insert immediately.

For large events:

- Upload CSV to storage.
- Create upload job.
- Process rows in background.
- Insert in batches.
- Store failed rows in error report.

### 17.4 Scanner API

- Use atomic database function.
- Keep response payload small.
- Rate-limit repeated invalid scan attempts.
- Avoid heavy joins during check-in.
- Cache event permission checks briefly if needed.

### 17.5 Dashboard

- Use summary counts.
- Use materialized views or cached aggregates for very large events.
- Use Supabase Realtime only for small/medium dashboards.
- For large events, poll every few seconds instead of subscribing to every row change.

---

## 18. Security Checklist

- Use HTTPS only.
- Use Supabase Auth.
- Enable RLS.
- Protect all admin routes.
- Protect scanner route.
- Never expose service role key.
- Validate every API input using Zod.
- Use secure random QR tokens.
- Do not encode personal data in QR.
- Rate-limit check-in endpoint.
- Log every scan attempt.
- Prevent duplicate check-in using atomic DB update.
- Escape CSV export values.
- Add audit trails for manual check-ins.
- Use least privilege for scanner users.
- Disable event scanning when event is completed or paused.

---

## 19. Error Handling

### Scanner Errors

The scanner UI should handle:

- Camera permission denied
- QR not readable
- Network error
- Server error
- Invalid QR
- Already used QR
- Event inactive
- Unauthorized scanner

### Upload Errors

The upload UI should handle:

- Missing CSV file
- Invalid file type
- Missing required column
- Duplicate attendees
- Large file timeout
- Partial upload failure

### Dashboard Errors

The dashboard should handle:

- No attendees
- Event not found
- Unauthorized user
- API failure

---

## 20. Testing Strategy

### Unit Tests

Test:

- Token generation
- Excel/CSV parsing
- Excel/CSV validation
- QR payload creation
- QR pass generation with name above QR
- Role permission helpers
- Status mapping
- API validation schemas

### Integration Tests

Test:

- Create event
- Upload attendees
- Generate QR token
- Generate QR pass with attendee name above QR
- Check in unused QR
- Check in same QR again
- Invalid QR
- Event inactive QR scan
- Unauthorized scanner

### E2E Tests

Use Playwright.

Test:

- Admin login
- Create event
- Upload CSV
- View attendees
- Open scanner
- Scan QR token manually
- See valid result
- Scan again and see already used
- Export report

### Load Testing

For production readiness:

- Test 10,000 attendees upload.
- Test 100 concurrent scanners.
- Test repeated duplicate scans.
- Test dashboard with 100,000 attendees.
- Test large CSV imports.

---

## 21. Deployment Guide

### 21.1 Supabase Setup

1. Create Supabase project.
2. Run SQL migrations.
3. Enable RLS.
4. Configure Auth providers.
5. Create storage bucket if needed.
6. Add initial organization and admin user.

### 21.2 Vercel Setup

1. Import GitHub repo into Vercel.
2. Add environment variables.
3. Set production domain.
4. Deploy.
5. Test login and database connection.

### 21.3 Production Checklist

Before going live:

- Admin login works.
- RLS policies tested.
- Event created.
- CSV upload tested.
- QR scan tested.
- Duplicate scan tested.
- Export tested.
- Scanner works on mobile.
- Camera permission works.
- Database backup enabled.
- Error monitoring enabled.
- Rate limiting enabled for check-in endpoint.

---

## 22. LLM Code Generation Instructions

When using an LLM to generate the codebase, give these instructions:

```text
Build a production-ready Next.js App Router project for a QR-based event entry system called GateQR. The website must allow the admin to directly upload an Excel file (.xlsx/.xls/.csv), generate one unique QR per attendee, display the attendee name above each QR code on the generated pass, and invalidate the QR after the first successful scan.

Use:
- Next.js with TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security
- qrcode for QR generation
- html5-qrcode or @zxing/browser for scanning
- xlsx for Excel parsing
- papaparse for CSV parsing
- zod for validation

Core features:
1. Admin login
2. Upload Excel
3. Preview QR pass with attendee name above QR
2. Event creation
3. Excel/CSV attendee upload
4. Unique secure QR token generation
5. QR preview and download with attendee name above QR
6. Scanner page
7. Atomic check-in API
8. Duplicate scan prevention
9. Attendance dashboard
10. CSV export report
11. Role-based access for admin and scanner

Production requirements:
- Never expose Supabase service role key to client
- Use server-only code for privileged database operations
- Generate QR passes with attendee name above QR
- Use atomic SQL update or Supabase RPC for check-in
- Enable RLS
- Add database indexes
- Validate all inputs using Zod
- Handle large attendee lists with pagination
- Log every scan attempt
- Do not store personal data inside QR
- QR token must be unique even when two attendees have the same name
- Make scanner UI very simple and fast
```

---

## 23. Development Phases

### Phase 1 — MVP

- Auth
- Event creation
- Attendee CSV upload
- QR token generation
- QR preview
- Scanner page
- Atomic check-in
- Dashboard
- Export report

### Phase 2 — Production Hardening

- RLS policies
- Audit logs
- Role management
- Rate limiting
- Error monitoring
- Bulk QR ZIP generation
- Better upload error handling

### Phase 3 — Scale

- Background jobs
- Email sending
- WhatsApp integration
- Multi-organization billing
- Advanced analytics
- Offline scanner mode

---

## 24. Most Important Implementation Detail

The check-in endpoint must be atomic.

Do not do this:

```text
1. Read attendee status
2. If unused, update to used
```

Do this:

```text
Update attendee where token matches and status is unused.
Return updated row.
```

This prevents two devices from validating the same QR at the same time.

---

## 25. Final System Behavior

Expected scan behavior:

| QR State | Result | Action |
|---|---|---|
| Valid and unused | Valid Entry | Mark as used |
| Valid and already used | Already Checked In | Reject |
| Invalid token | Invalid QR | Reject |
| Event inactive | Event Inactive | Reject |
| Blocked attendee | Blocked | Reject |

The system must always protect the rule:

```text
One QR code can create only one successful entry.
```
