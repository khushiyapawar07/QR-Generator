import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withDB } from "@/lib/db";
import { hashToken } from "@/lib/qr";

const schema = z.object({
  eventId: z.string().uuid(),
  qrToken: z.string().min(10),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid payload" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { eventId, qrToken } = parsed.data;

  const result = await withDB(async (db) => {
    const event = db.events.find((e) => e.id === eventId);
    if (!event || event.status !== "active") {
      db.scanLogs.push({
        id: randomUUID(),
        eventId,
        qrTokenHash: hashToken(qrToken),
        result: "EVENT_INACTIVE",
        createdAt: now,
      });
      return { success: false, result: "EVENT_INACTIVE", message: "Event is not active." };
    }

    const attendee = db.attendees.find((a) => a.eventId === eventId && a.qrToken === qrToken);
    if (!attendee) {
      db.scanLogs.push({
        id: randomUUID(),
        eventId,
        qrTokenHash: hashToken(qrToken),
        result: "INVALID_QR",
        createdAt: now,
      });
      return { success: false, result: "INVALID_QR", message: "QR code is not valid for this event." };
    }

    if (attendee.status === "blocked") {
      db.scanLogs.push({
        id: randomUUID(),
        eventId,
        attendeeId: attendee.id,
        qrTokenHash: hashToken(qrToken),
        result: "ATTENDEE_BLOCKED",
        createdAt: now,
      });
      return { success: false, result: "ATTENDEE_BLOCKED", attendee };
    }

    if (attendee.status === "used") {
      db.scanLogs.push({
        id: randomUUID(),
        eventId,
        attendeeId: attendee.id,
        qrTokenHash: hashToken(qrToken),
        result: "ALREADY_USED",
        createdAt: now,
      });
      return {
        success: false,
        result: "ALREADY_USED",
        message: "This QR has already been checked in.",
        attendee,
      };
    }

    attendee.status = "used";
    attendee.checkedInAt = now;
    attendee.checkedInBy = "scanner-user";

    db.scanLogs.push({
      id: randomUUID(),
      eventId,
      attendeeId: attendee.id,
      qrTokenHash: hashToken(qrToken),
      result: "VALID_CHECKED_IN",
      createdAt: now,
    });

    return {
      success: true,
      result: "VALID_CHECKED_IN",
      attendee,
    };
  });

  return NextResponse.json(result);
}
