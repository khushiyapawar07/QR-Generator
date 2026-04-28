import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withDB } from "@/lib/db";
import { EventRecord } from "@/lib/types";

const createEventSchema = z.object({
  name: z.string().min(2),
  venue: z.string().min(2),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  timezone: z.string().default("Asia/Kolkata"),
});

export async function GET() {
  const data = await withDB(async (db) => db.events);
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

  await withDB(async (db) => {
    db.events.unshift(event);
  });

  return NextResponse.json({ success: true, eventId: event.id, event });
}
