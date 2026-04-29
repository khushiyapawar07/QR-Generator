import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DBShape } from "@/lib/types";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

// Vercel serverless filesystem is read-only except for the runtime temp directory.
// Use a writable location there so JSON-backed storage can still function.
const baseDataDir =
  process.env.VERCEL === "1" ? path.join(os.tmpdir(), "gateqr-data") : path.join(process.cwd(), "data");
const dataDir = baseDataDir;
const dbPath = path.join(dataDir, "db.json");
const isVercelRuntime = process.env.VERCEL === "1";

const defaultDB: DBShape = {
  events: [],
  attendees: [],
  scanLogs: [],
};

let writeQueue: Promise<void> = Promise.resolve();

type EventRow = {
  id: string;
  name: string;
  venue: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  created_at: string;
};

type AttendeeRow = {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  designation: string | null;
  category: string | null;
  notes: string | null;
  qr_token: string;
  status: "unused" | "used" | "blocked" | "cancelled";
  checked_in_at: string | null;
  checked_in_by: string | null;
  created_at: string;
};

type ScanLogRow = {
  id: string;
  event_id: string;
  attendee_id: string | null;
  qr_token_hash: string | null;
  result: "VALID_CHECKED_IN" | "ALREADY_USED" | "INVALID_QR" | "EVENT_INACTIVE" | "ATTENDEE_BLOCKED";
  created_at: string;
};

function mapSupabaseToDBShape(events: EventRow[], attendees: AttendeeRow[], scanLogs: ScanLogRow[]): DBShape {
  return {
    events: events.map((row) => ({
      id: row.id,
      name: row.name,
      venue: row.venue,
      startsAt: row.starts_at,
      endsAt: row.ends_at ?? undefined,
      timezone: row.timezone,
      status: row.status,
      createdAt: row.created_at,
    })),
    attendees: attendees.map((row) => ({
      id: row.id,
      eventId: row.event_id,
      name: row.name,
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      company: row.company ?? undefined,
      designation: row.designation ?? undefined,
      category: row.category ?? undefined,
      notes: row.notes ?? undefined,
      qrToken: row.qr_token,
      status: row.status,
      checkedInAt: row.checked_in_at ?? undefined,
      checkedInBy: row.checked_in_by ?? undefined,
      createdAt: row.created_at,
    })),
    scanLogs: scanLogs.map((row) => ({
      id: row.id,
      eventId: row.event_id,
      attendeeId: row.attendee_id ?? undefined,
      qrTokenHash: row.qr_token_hash ?? undefined,
      result: row.result,
      createdAt: row.created_at,
    })),
  };
}

function mapDBEventToSupabase(row: DBShape["events"][number]) {
  return {
    id: row.id,
    name: row.name,
    venue: row.venue,
    starts_at: row.startsAt,
    ends_at: row.endsAt ?? null,
    timezone: row.timezone,
    status: row.status,
    created_at: row.createdAt,
  };
}

function mapDBAttendeeToSupabase(row: DBShape["attendees"][number]) {
  return {
    id: row.id,
    event_id: row.eventId,
    name: row.name,
    email: row.email ?? null,
    phone: row.phone ?? null,
    company: row.company ?? null,
    designation: row.designation ?? null,
    category: row.category ?? null,
    notes: row.notes ?? null,
    qr_token: row.qrToken,
    status: row.status,
    checked_in_at: row.checkedInAt ?? null,
    checked_in_by: row.checkedInBy ?? null,
    created_at: row.createdAt,
  };
}

function mapDBScanLogToSupabase(row: DBShape["scanLogs"][number]) {
  return {
    id: row.id,
    event_id: row.eventId,
    attendee_id: row.attendeeId ?? null,
    qr_token_hash: row.qrTokenHash ?? null,
    result: row.result,
    created_at: row.createdAt,
  };
}

export async function readDB(): Promise<DBShape> {
  const supabase = getSupabaseServiceClient();
  if (supabase) {
    const [eventsRes, attendeesRes, scanLogsRes] = await Promise.all([
      supabase.from("events").select("*").order("created_at", { ascending: false }),
      supabase.from("attendees").select("*"),
      supabase.from("scan_logs").select("*"),
    ]);

    if (eventsRes.error) throw new Error(`Failed to read events: ${eventsRes.error.message}`);
    if (attendeesRes.error) throw new Error(`Failed to read attendees: ${attendeesRes.error.message}`);
    if (scanLogsRes.error) throw new Error(`Failed to read scan logs: ${scanLogsRes.error.message}`);

    return mapSupabaseToDBShape(
      (eventsRes.data ?? []) as EventRow[],
      (attendeesRes.data ?? []) as AttendeeRow[],
      (scanLogsRes.data ?? []) as ScanLogRow[],
    );
  }

  if (isVercelRuntime) {
    throw new Error(
      "Supabase service role env vars are missing. Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel.",
    );
  }

  await mkdir(dataDir, { recursive: true });

  try {
    const raw = await readFile(dbPath, "utf8");
    return JSON.parse(raw) as DBShape;
  } catch {
    await writeFile(dbPath, JSON.stringify(defaultDB, null, 2), "utf8");
    return defaultDB;
  }
}

export async function writeDB(db: DBShape): Promise<void> {
  const supabase = getSupabaseServiceClient();
  if (supabase) {
    void db;
    throw new Error(
      "writeDB() does not support Supabase mode. Use targeted per-route Supabase inserts/updates for safe concurrent writes.",
    );
  }

  if (isVercelRuntime) {
    throw new Error(
      "Supabase service role env vars are missing. Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel.",
    );
  }

  await mkdir(dataDir, { recursive: true });

  writeQueue = writeQueue.then(() =>
    writeFile(dbPath, JSON.stringify(db, null, 2), "utf8"),
  );

  await writeQueue;
}

export async function withDB<T>(handler: (db: DBShape) => Promise<T>): Promise<T> {
  const db = await readDB();
  const result = await handler(db);
  await writeDB(db);
  return result;
}
