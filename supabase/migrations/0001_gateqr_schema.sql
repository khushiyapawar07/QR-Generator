create extension if not exists pg_trgm;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  venue text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'Asia/Kolkata',
  status text not null default 'active'
    check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  company text,
  designation text,
  category text,
  notes text,
  qr_token text not null,
  status text not null default 'unused'
    check (status in ('unused', 'used', 'blocked', 'cancelled')),
  checked_in_at timestamptz,
  checked_in_by text,
  created_at timestamptz not null default now(),
  unique (event_id, qr_token)
);

create table if not exists scan_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  attendee_id uuid references attendees(id) on delete set null,
  result text not null check (
    result in ('VALID_CHECKED_IN', 'ALREADY_USED', 'INVALID_QR', 'EVENT_INACTIVE', 'ATTENDEE_BLOCKED', 'ERROR')
  ),
  qr_token_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_attendees_event_status on attendees(event_id, status);
create unique index if not exists idx_attendees_event_token on attendees(event_id, qr_token);
create index if not exists idx_attendees_event_name_trgm on attendees using gin (name gin_trgm_ops);

create or replace function check_in_attendee(
  p_event_id uuid,
  p_qr_token text
)
returns table (
  result text,
  attendee_id uuid,
  attendee_name text,
  checked_in_at timestamptz
)
language plpgsql
as $$
declare
  updated_attendee attendees%rowtype;
  existing_attendee attendees%rowtype;
begin
  update attendees
  set status = 'used',
      checked_in_at = now()
  where event_id = p_event_id
    and qr_token = p_qr_token
    and status = 'unused'
  returning * into updated_attendee;

  if found then
    return query select 'VALID_CHECKED_IN'::text, updated_attendee.id, updated_attendee.name, updated_attendee.checked_in_at;
    return;
  end if;

  select * into existing_attendee
  from attendees
  where event_id = p_event_id and qr_token = p_qr_token;

  if found then
    return query select
      case
        when existing_attendee.status = 'used' then 'ALREADY_USED'::text
        when existing_attendee.status = 'blocked' then 'ATTENDEE_BLOCKED'::text
        else 'ERROR'::text
      end,
      existing_attendee.id,
      existing_attendee.name,
      existing_attendee.checked_in_at;
    return;
  end if;

  return query select 'INVALID_QR'::text, null::uuid, null::text, null::timestamptz;
end;
$$;
