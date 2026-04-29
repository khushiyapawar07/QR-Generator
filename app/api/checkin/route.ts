import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withDB } from "@/lib/db";
import { hashToken } from "@/lib/qr";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

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
  const qrTokenHash = hashToken(qrToken);
  const supabase = getSupabaseServiceClient();

  if (supabase) {
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id,status")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      return NextResponse.json({ success: false, message: eventError.message }, { status: 500 });
    }

    if (!event || event.status !== "active") {
      await supabase.from("scan_logs").insert({
        id: randomUUID(),
        event_id: eventId,
        qr_token_hash: qrTokenHash,
        result: "EVENT_INACTIVE",
        created_at: now,
      });
      return NextResponse.json({ success: false, result: "EVENT_INACTIVE", message: "Event is not active." });
    }

    const { data: rpcRows, error: rpcError } = await supabase.rpc("check_in_attendee", {
      p_event_id: eventId,
      p_qr_token: qrToken,
    });

    if (rpcError) {
      return NextResponse.json({ success: false, message: rpcError.message }, { status: 500 });
    }

    const rpcResult = rpcRows?.[0] as
      | { result: string; attendee_id: string | null; attendee_name: string | null; checked_in_at: string | null }
      | undefined;

    if (!rpcResult) {
      return NextResponse.json({ success: false, message: "Unexpected check-in response." }, { status: 500 });
    }

    const { data: attendee } = rpcResult.attendee_id
      ? await supabase
          .from("attendees")
          .select("id,name,company,status,checked_in_at")
          .eq("id", rpcResult.attendee_id)
          .maybeSingle()
      : { data: null };

    const messageByResult: Record<string, string> = {
      VALID_CHECKED_IN: "Entry validated.",
      ALREADY_USED: "This QR has already been checked in.",
      INVALID_QR: "QR code is not valid for this event.",
      EVENT_INACTIVE: "Event is not active.",
      ATTENDEE_BLOCKED: "Attendee is blocked.",
    };

    await supabase.from("scan_logs").insert({
      id: randomUUID(),
      event_id: eventId,
      attendee_id: rpcResult.attendee_id,
      qr_token_hash: qrTokenHash,
      result: rpcResult.result,
      created_at: now,
    });

    return NextResponse.json({
      success: rpcResult.result === "VALID_CHECKED_IN",
      result: rpcResult.result,
      message: messageByResult[rpcResult.result] ?? "Check-in processed.",
      attendee: attendee
        ? {
            name: attendee.name,
            company: attendee.company ?? undefined,
            checkedInAt: attendee.checked_in_at ?? undefined,
          }
        : undefined,
    });
  }

  const result = await withDB(async (db) => {
    const event = db.events.find((e) => e.id === eventId);
    if (!event || event.status !== "active") {
      db.scanLogs.push({
        id: randomUUID(),
        eventId,
        qrTokenHash,
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
        qrTokenHash,
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
        qrTokenHash,
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
        qrTokenHash,
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
      qrTokenHash,
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
