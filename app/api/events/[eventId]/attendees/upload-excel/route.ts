import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { withDB } from "@/lib/db";
import { generateQrToken } from "@/lib/qr";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { parseUpload } from "@/lib/upload";
import { AttendeeRecord } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, message: "Missing file. Send multipart form with key `file`." },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const supabase = getSupabaseServiceClient();

  try {
    const parsed = parseUpload(file.name, bytes);
    const now = new Date().toISOString();
    let importedRows = 0;

    if (supabase) {
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("id")
        .eq("id", eventId)
        .maybeSingle();
      if (eventError) throw new Error(eventError.message);
      if (!event) throw new Error("EVENT_NOT_FOUND");

      const { data: existingRows, error: existingError } = await supabase
        .from("attendees")
        .select("qr_token")
        .eq("event_id", eventId);
      if (existingError) throw new Error(existingError.message);

      const existingTokens = new Set<string>((existingRows ?? []).map((row) => row.qr_token));
      const attendeesToInsert: Record<string, unknown>[] = [];

      for (const row of parsed.rows) {
        let token = generateQrToken(eventId);
        while (existingTokens.has(token)) {
          token = generateQrToken(eventId);
        }
        existingTokens.add(token);

        attendeesToInsert.push({
          id: randomUUID(),
          event_id: eventId,
          name: row.name,
          email: row.email ?? null,
          phone: row.phone ?? null,
          company: row.company ?? null,
          designation: row.designation ?? null,
          category: row.category ?? null,
          notes: row.notes ?? null,
          qr_token: token,
          status: "unused",
          created_at: now,
        });
      }

      if (attendeesToInsert.length > 0) {
        const { error: insertError } = await supabase.from("attendees").insert(attendeesToInsert);
        if (insertError) throw new Error(insertError.message);
      }
      importedRows = attendeesToInsert.length;
    } else {
    await withDB(async (db) => {
      const event = db.events.find((row) => row.id === eventId);
      if (!event) {
        throw new Error("EVENT_NOT_FOUND");
      }

      const existingTokens = new Set<string>(
        db.attendees.filter((a) => a.eventId === eventId).map((a) => a.qrToken),
      );

      for (const row of parsed.rows) {
        let token = generateQrToken(eventId);
        while (existingTokens.has(token)) {
          token = generateQrToken(eventId);
        }

        existingTokens.add(token);

        const attendee: AttendeeRecord = {
          id: randomUUID(),
          eventId,
          name: row.name,
          email: row.email,
          phone: row.phone,
          company: row.company,
          designation: row.designation,
          category: row.category,
          notes: row.notes,
          qrToken: token,
          status: "unused",
          createdAt: now,
        };

        db.attendees.push(attendee);
        importedRows += 1;
      }
    });
    }

    return NextResponse.json({
      success: true,
      totalRows: parsed.totalRows,
      importedRows,
      failedRows: parsed.errors.length,
      duplicateRows: parsed.duplicateRows,
      generatedQrCount: importedRows,
      errors: parsed.errors,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EVENT_NOT_FOUND") {
      return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 });
    }

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
