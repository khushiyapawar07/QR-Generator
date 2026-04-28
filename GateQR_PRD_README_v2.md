# PRD README — GateQR QR Entry Management System

## 1. Product Name

**GateQR**  
A production-ready web application for uploading an attendee Excel file, generating unique QR entry passes with the attendee name displayed above each QR code, sending/downloading those passes, and validating each QR only once at event entry.

---

## 2. Product Summary

GateQR is a secure QR-based event entry system designed for private company meetings, corporate events, conferences, exhibitions, and invite-only gatherings.

The system allows an admin to directly upload an Excel file of invited attendees, generate unique QR passes for every attendee, show the attendee name above each QR code, download/send those passes through email or WhatsApp, and scan those QR codes at the venue. Once a QR code is scanned successfully, it becomes invalid for future entry attempts.

The application will be hosted on **Vercel** and built using:

- **Next.js** for frontend and backend API routes
- **Supabase** for authentication, database, storage, and row-level security
- **PostgreSQL** through Supabase for scalable data storage
- **QR Code generation libraries** for QR generation
- **Excel parsing library** such as `xlsx` for `.xlsx` and `.xls` uploads
- **Pass generation tools** for QR cards/PDF/PNG output
- **HTML5 QR Scanner** for browser-based scanning
- Optional production services like queue workers, Redis rate limiting, and object storage for large-scale operations


---

## 2.1 Core Excel Upload and Named QR Requirement

The website must support direct Excel upload from the admin panel.

Required flow:

```text
Admin uploads Excel file
↓
System reads attendee/client names and optional details
↓
System generates one unique QR token for every valid attendee
↓
System creates a QR pass where the attendee name is printed above the QR code
↓
Admin downloads QR passes individually or in bulk
↓
Client shows QR at entry
↓
First scan = valid entry
↓
QR becomes invalid for second scan
```

The attendee/client should not fill any form. All attendee data comes from the uploaded Excel file.

Supported upload formats:

```text
.xlsx
.xls
.csv
```

Minimum required Excel column:

```text
Name
```

Recommended Excel columns:

```text
Name, Phone, Email, Company, Designation, Category, Notes
```

Each generated QR pass must follow this layout:

```text
[Event Name]

[Attendee Name]

[QR Code]

Show this QR at the entry gate.
```

The QR itself must contain only a secure unique token, not personal details such as name, phone number, or email.

---

## 3. Problem Statement

For company meetings and private events, organizers often need to invite hundreds or thousands of clients without asking them to fill forms. The organizer already has the client list and only wants to send each client a unique QR code for entry.

Normal QR generators are not enough because they only create QR images. They do not read Excel attendee data, generate attendee-name QR passes, track whether a QR has already been used, or prevent duplicate entry. This creates the risk of duplicate entries, fake screenshots, and unauthorized re-entry.

GateQR solves this by creating a one-time-use QR entry system.

---

## 4. Target Users

### 4.1 Event Admin

The person who creates events, uploads attendee data, generates QR passes, and monitors attendance.

Examples:

- Company owner
- Event manager
- HR/admin team
- Reception management team

### 4.2 Scanner Staff

The person standing at the entry gate and scanning QR codes.

Examples:

- Security staff
- Registration desk staff
- Event volunteers

### 4.3 Attendee / Client

The invited guest who receives a QR code and shows it at the entry gate.

The attendee does not need to create an account or fill a form.

---

## 5. Main Goal

Allow event organizers to generate unique QR codes for attendees and validate each QR only once at entry.

Core flow:

```text
Admin uploads Excel attendee list
↓
System generates unique QR token for each attendee and creates a QR pass with the attendee name above it
↓
Admin sends QR to attendee
↓
Scanner staff scans QR at entry
↓
System checks status
↓
Unused QR → allow entry and mark as used
Used QR → deny entry and show already checked in
Invalid QR → deny entry and show invalid QR
```

---

## 6. Product Objectives

1. Allow admin to upload attendee/client data directly using Excel.
2. Generate unique QR codes for invited attendees.
3. Display the attendee name above every generated QR code.
4. Allow bulk upload of attendee data using `.xlsx`, `.xls`, or `.csv`.
5. Prevent duplicate entry using one-time QR validation.
6. Provide a fast scanner page for entry gate staff.
7. Provide a live dashboard for admins.
8. Support future scaling to lakhs of attendees across multiple events.
9. Keep the system simple enough for non-technical event staff.
10. Make the system secure enough for real production use.

---

## 7. Scope

### 7.1 In Scope for MVP

The MVP must include:

- Admin login
- Event creation
- Excel/CSV attendee upload
- Automatic unique QR token generation
- QR code preview with attendee name above QR
- Download individual QR
- Bulk QR download as ZIP/PDF
- Scanner page
- One-time QR validation
- Attendance dashboard
- Manual search by name, phone, email, or QR token
- Export attendance report as CSV
- Role-based access for admin and scanner staff

### 7.2 Out of Scope for MVP

The MVP does not need:

- Payment collection
- Public event registration page
- Seat selection
- Complex ticket pricing
- Vendor booth management
- Native mobile app
- Facial recognition
- Offline-first scanner app

These can be added later.


---

## 7.3 Excel Upload Requirements

The admin panel must include a direct Excel upload feature.

### Supported Files

```text
.xlsx
.xls
.csv
```

### Required Column

```text
Name
```

### Optional Columns

```text
Phone
Email
Company
Designation
Category
Notes
```

### Flexible Column Mapping

The system should accept common variations.

For attendee name:

```text
Name, Full Name, Client Name, Attendee Name, Guest Name
```

For phone:

```text
Phone, Mobile, Mobile Number, Contact, Contact Number
```

For email:

```text
Email, Email ID, Email Address, Mail
```

### Upload Validation

The upload system must:

- Ignore empty rows.
- Require attendee name.
- Clean phone numbers.
- Validate email if available.
- Detect duplicate rows in the uploaded file.
- Detect duplicates already existing in the same event where possible.
- Generate QR only for valid rows.
- Show failed rows with reasons.
- Show an upload summary.

Example upload summary:

```text
Total rows: 400
Imported rows: 398
Failed rows: 2
QR codes generated: 398
```

---

## 7.4 QR Pass Requirements

Each attendee must receive a unique QR pass.

The pass must show:

```text
Event Name
Attendee Name
QR Code
Entry Instruction
```

The attendee name must be displayed clearly above the QR code.

Example pass layout:

```text
Annual Company Meeting 2026

Raj Sharma

[QR CODE]

Please show this QR at the entry gate.
```

### QR Uniqueness

Every attendee must get a unique QR token, even if two attendees have the same name.

The QR token must not be generated only from name, phone, email, company, or row number.

Correct token example:

```text
gqr_live_ev_7K2A9_x4P9mL8vR2sQwT6nZ1bC
```

### QR Content Security

The QR code must not contain personal information.

Do not encode:

```text
Raj Sharma, 9876543210, ABC Ltd
```

Encode only:

```text
Secure random QR token
```

### Download Options

Admin should be able to:

- Preview QR pass.
- Download one QR pass as PNG/PDF.
- Download all QR passes as ZIP.
- Download one combined PDF with one QR pass per page in future.

Recommended filename format:

```text
Raj_Sharma_QR.png
Amit_Shah_QR.png
```

For duplicate names:

```text
Raj_Sharma_001_QR.png
Raj_Sharma_002_QR.png
```

---

## 8. User Stories

### 8.1 Admin User Stories

#### Excel Upload

As an admin, I want to upload an Excel file of clients so that the system can generate QR passes without asking clients to fill forms.

Acceptance criteria:

- Admin can upload `.xlsx`, `.xls`, or `.csv`.
- System reads attendee names and optional details.
- System validates all rows.
- System generates a secure unique QR token for each valid attendee.
- Invalid rows are shown with reasons.
- Admin can continue with valid rows even if some rows fail.

#### QR Pass With Name Above QR

As an admin, I want each QR pass to display the attendee name above the QR code so that the pass is identifiable and professional.

Acceptance criteria:

- QR pass shows event name.
- QR pass shows attendee name above QR.
- QR pass contains a scannable QR code.
- QR code contains only a secure token.
- Admin can preview and download the pass.
- Bulk download is supported.

#### Event Creation

As an admin, I want to create an event with name, date, time, venue, and description so that I can manage entry for that event.

Acceptance criteria:

- Admin can create a new event.
- Admin can edit event details.
- Admin can mark event as draft, active, completed, or archived.
- Event name, date, time, and venue are required fields.

#### Upload Attendees

As an admin, I want to upload a CSV file containing attendee details so that I do not have to manually enter 400+ clients.

Acceptance criteria:

- Admin can upload CSV.
- CSV supports name, phone, email, company, designation, and custom notes.
- System validates required columns.
- System rejects duplicate phone/email/token within the same event.
- System shows upload success and failure rows.
- System generates QR tokens automatically.

#### Generate QR Codes

As an admin, I want the system to generate one unique QR per attendee.

Acceptance criteria:

- Each attendee receives a unique QR token.
- QR token must not contain sensitive personal data.
- QR code should encode only a secure token or signed payload.
- Admin can preview each QR.
- Admin can download a QR as PNG.
- Admin can download all QRs as a ZIP.

#### Send QR Codes

As an admin, I want to send QR passes to attendees using email or export them for WhatsApp sharing.

Acceptance criteria:

- Admin can download all passes.
- Admin can export attendee list with QR links.
- Email sending may be added in phase 2.
- WhatsApp integration may be added in phase 2.

#### Dashboard

As an admin, I want to see live attendance numbers.

Acceptance criteria:

- Dashboard shows total attendees.
- Dashboard shows checked-in attendees.
- Dashboard shows pending attendees.
- Dashboard shows duplicate scan attempts.
- Dashboard updates quickly after scans.
- Admin can filter by company, status, and time.

#### Export Report

As an admin, I want to export a report after the event.

Acceptance criteria:

- Export contains name, phone, email, company, status, check-in time, and scanner staff.
- Export is available as CSV.
- Report can be filtered before export.

---

### 8.2 Scanner Staff User Stories

#### Scanner Login

As scanner staff, I want to log in and access only the scanner page.

Acceptance criteria:

- Scanner staff can log in securely.
- Scanner staff cannot access admin upload or settings pages.
- Scanner staff can only scan QR and view scan result.

#### Scan QR

As scanner staff, I want to scan a QR at the entry gate and instantly know whether to allow entry.

Acceptance criteria:

- Camera opens in browser.
- Scanner reads QR token.
- System checks token against database.
- If unused, show green success screen and mark used.
- If already used, show red warning screen.
- If invalid, show invalid QR screen.
- Result should appear in less than 2 seconds under normal network conditions.

#### Manual Search

As scanner staff, I want to search by name or phone if the QR is not readable.

Acceptance criteria:

- Staff can search attendee by name, phone, email, or company.
- Staff can manually check in an attendee after confirmation.
- Manual check-in action is logged.

---

### 8.3 Attendee User Stories

#### Receive QR

As an attendee, I want to receive my QR pass without filling a form.

Acceptance criteria:

- Attendee receives QR via email, WhatsApp, or manual sharing.
- QR pass contains event name, date, venue, attendee name, and QR code.
- Attendee does not need to create an account.

#### Entry

As an attendee, I want to show my QR at the gate and enter quickly.

Acceptance criteria:

- QR can be scanned from phone screen or printed paper.
- Entry decision is instant.
- QR cannot be used by another person after first successful scan.

---

## 9. Functional Requirements

### 9.1 Authentication

- Admin and scanner staff must log in.
- Use Supabase Auth.
- Roles must be stored in the database.
- Unauthorized users must be redirected away from protected pages.
- Admin can invite scanner staff.
- Scanner staff should have limited access.

### 9.1.1 Excel Upload

- Admin must be able to upload `.xlsx`, `.xls`, and `.csv` files.
- Server must parse the uploaded file securely.
- Server must map flexible column names.
- Server must validate rows before import.
- Server must generate a unique QR token for each valid attendee.
- Server must store upload summary and failed rows.

### 9.1.2 QR Pass Generation

- Each QR pass must show attendee name above the QR code.
- Each QR pass must contain the event name.
- The QR image must be generated from a unique secure token.
- The QR must become invalid after the first successful scan.
- Admin must be able to download individual and bulk QR passes.

### 9.2 Event Management

Admin can:

- Create event
- Edit event
- Archive event
- View event dashboard
- View attendees for each event

Event fields:

- Event name
- Slug
- Description
- Venue
- Start date/time
- End date/time
- Timezone
- Status
- Organization ID
- Created by

### 9.3 Attendee Management

Admin can:

- Upload attendees using CSV
- Add attendee manually
- Edit attendee
- Delete attendee before check-in
- Search attendee
- Filter attendees
- Export attendee data

Attendee fields:

- Name
- Email
- Phone
- Company
- Designation
- Notes
- QR token
- Status
- Check-in time
- Checked-in by

### 9.4 QR Generation

- Generate secure random token for every attendee.
- QR should not contain personal information.
- QR should contain either:
  - Plain secure token, or
  - Signed token payload
- QR image can be generated on demand.
- Store token in database.
- Do not store large QR image files unless necessary.
- For bulk ZIP downloads, generate files in background for large events.

### 9.5 QR Scanning

- Scanner page uses device camera.
- Scanner reads QR token.
- API validates token.
- API performs atomic check-in.
- API returns result:
  - VALID_CHECKED_IN
  - ALREADY_USED
  - INVALID_QR
  - EVENT_INACTIVE
  - ATTENDEE_BLOCKED
  - SERVER_ERROR

### 9.6 One-Time Validation

This is the most important rule.

A QR must be marked as used only once.

Correct logic:

```text
If QR exists and status is unused:
    mark as used
    allow entry
Else if QR exists and status is used:
    reject entry
Else:
    show invalid QR
```

The database update must be atomic to prevent two scanners from checking in the same QR at the same time.

### 9.7 Dashboard

Dashboard should display:

- Total attendees
- Checked-in count
- Pending count
- Duplicate scan attempts
- Invalid scan attempts
- Recent check-ins
- Check-ins over time
- Scanner staff activity

### 9.8 Audit Logs

Every scan attempt should be logged.

Log fields:

- Event ID
- Attendee ID if found
- QR token hash
- Scan result
- Scanner staff ID
- Device info
- IP address if available
- Timestamp

Audit logs help identify duplicate attempts and security issues.

---

## 10. Non-Functional Requirements

### 10.1 Performance

- Scanner result should appear within 2 seconds under normal internet.
- Dashboard should load within 3 seconds for events with up to 100,000 attendees.
- CSV upload for large files should be handled asynchronously.
- QR ZIP generation for large attendee lists should be handled in background.

### 10.2 Scalability

The system should be designed to support:

- Multiple organizations
- Multiple events per organization
- Lakhs of attendees
- Multiple scanner devices working simultaneously
- High scan rate at event entry

Scaling approach:

- Use PostgreSQL indexes.
- Use atomic database updates.
- Use pagination for large tables.
- Use server-side filtering.
- Use background jobs for bulk operations.
- Avoid loading all attendees on the frontend.
- Avoid storing unnecessary QR images.

### 10.3 Security

- Use Supabase Auth.
- Use role-based access control.
- Use Row Level Security.
- Do not expose service role keys to frontend.
- QR tokens must be random and hard to guess.
- Store only token hash if higher security is required.
- Rate-limit scanner API.
- Validate all input on server.
- Sanitize CSV uploads.
- Prevent formula injection in CSV exports.
- Log suspicious scan attempts.

### 10.4 Reliability

- Scanner page should show clear errors.
- Failed scans should be retryable.
- Check-in operation must be idempotent.
- Database operations should avoid race conditions.
- Export should not break for large events.

### 10.5 Usability

- Scanner result screen should be very clear:
  - Green = allow entry
  - Red = reject entry
  - Yellow = already checked in
- Scanner staff should not see complicated admin options.
- Admin dashboard should be simple and readable.

---

## 11. Production-Level Features

### 11.1 Multi-Organization Support

The app should support multiple organizations in future.

Example:

```text
Organization A
  ├── Event 1
  ├── Event 2

Organization B
  ├── Event 1
  ├── Event 2
```

Each organization must only access its own data.

### 11.2 Role-Based Access

Roles:

- `super_admin`
- `org_admin`
- `event_admin`
- `scanner`
- `viewer`

Permissions:

| Feature | Super Admin | Org Admin | Event Admin | Scanner | Viewer |
|---|---|---|---|---|---|
| Create organization | Yes | No | No | No | No |
| Create event | Yes | Yes | Yes | No | No |
| Upload attendees | Yes | Yes | Yes | No | No |
| Scan QR | Yes | Yes | Yes | Yes | No |
| View dashboard | Yes | Yes | Yes | Limited | Yes |
| Export report | Yes | Yes | Yes | No | Yes |

### 11.3 Event Status

Event statuses:

- `draft`
- `active`
- `paused`
- `completed`
- `archived`

QR scanning should work only when event is active, unless admin enables override.

### 11.4 Large Event Support

For events with lakhs of attendees:

- CSV upload should be chunked.
- Processing should happen in background.
- Duplicate validation should happen server-side.
- QR ZIP generation should be queued.
- Frontend should use pagination and search.
- Dashboard should use aggregated counts.

---

## 12. Suggested MVP Pages

### Public / Auth

- `/login`
- `/forgot-password`

### Admin

- `/admin`
- `/admin/events`
- `/admin/events/new`
- `/admin/events/[eventId]/dashboard`
- `/admin/events/[eventId]/attendees`
- `/admin/events/[eventId]/upload`
- `/admin/events/[eventId]/qr`
- `/admin/events/[eventId]/exports`
- `/admin/events/[eventId]/settings`
- `/admin/users`

### Scanner

- `/scanner`
- `/scanner/[eventId]`
- `/scanner/[eventId]/manual-search`

---

## 13. Suggested API Routes

- `POST /api/events`
- `GET /api/events`
- `GET /api/events/:id`
- `PATCH /api/events/:id`
- `POST /api/events/:id/attendees/upload-excel`
- `GET /api/events/:id/attendees`
- `POST /api/events/:id/attendees`
- `PATCH /api/events/:id/attendees/:attendeeId`
- `GET /api/events/:id/attendees/export`
- `GET /api/events/:id/qr/:attendeeId
- GET /api/events/:id/qr/:attendeeId/pass`
- `POST /api/events/:id/qr/zip`
- `POST /api/checkin`
- `GET /api/events/:id/dashboard`
- `GET /api/events/:id/audit-logs`

---

## 14. MVP Success Metrics

The product is successful if:

- Admin can upload 400 attendees directly using an Excel file without technical help.
- System generates 400 unique QR passes with attendee names above the QR codes.
- Scanner can validate QR codes at the venue.
- Used QR cannot be reused.
- Admin can see live checked-in count.
- Admin can export final attendance report.
- Scanner response time is fast enough for real entry gate usage.

---

## 15. Future Enhancements

- Email sending through Resend/SendGrid.
- WhatsApp sending through WhatsApp Business API.
- Branded PDF passes.
- Offline scanner mode with sync.
- Multiple entry gates.
- VIP tags.
- Blacklist/block attendee.
- Seat/table assignment.
- Badge printing.
- SMS notifications.
- Mobile app using React Native.
- Analytics for event attendance patterns.
- Webhook integrations.
- API access for enterprise clients.

---

## 16. LLM Development Instruction Summary

When generating code for this product, prioritize:

1. Direct Excel upload support first.
2. QR pass generation with attendee name above QR.
3. Security first.
4. Atomic check-in logic.
5. Clean role-based access.
6. Supabase Row Level Security.
7. Scalable database schema.
8. Server-side validation.
9. Simple UI for non-technical staff.
10. Production-ready error handling.
11. Clear folder structure.
12. Avoid fake frontend-only logic.

The most critical feature is:

```text
One attendee = one unique QR pass with their name above it. One QR = one successful entry only.
```
