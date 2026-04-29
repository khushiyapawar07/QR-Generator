import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readDB, withDB } from "@/lib/db";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { EventRecord } from "@/lib/types";

const createEventSchema = z.object({
  name: z.string().min(2),
  venue: z.string().min(2),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  timezone: z.string().default("Asia/Kolkata"),
});

export async function GET() {
  const db = await readDB();
  const data = db.events;
  return NextResponse.json({ success: true, data });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createEventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Invalid event payload", errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const supabase = getSupabaseServiceClient();
  const event: EventRecord = {
    id: randomUUID(),
    name: parsed.data.name,
    venue: parsed.data.venue,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    timezone: parsed.data.timezone,
    status: "active",
    createdAt: now,
  };

  if (supabase) {
    const { error } = await supabase.from("events").insert({
      id: event.id,
      name: event.name,
      venue: event.venue,
      starts_at: event.startsAt,
      ends_at: event.endsAt ?? null,
      timezone: event.timezone,
      status: event.status,
      created_at: event.createdAt,
    });

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, eventId: event.id, event });
  }

  await withDB(async (db) => {
    db.events.unshift(event);
  });

  return NextResponse.json({ success: true, eventId: event.id, event });
}
