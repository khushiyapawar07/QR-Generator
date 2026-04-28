import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { withDB } from "@/lib/db";
import { generateQrToken } from "@/lib/qr";
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

  try {
    const parsed = parseUpload(file.name, bytes);
    const existingTokens = new Set<string>();
    const now = new Date().toISOString();
    let importedRows = 0;

    await withDB(async (db) => {
      const event = db.events.find((row) => row.id === eventId);
      if (!event) {
        throw new Error("EVENT_NOT_FOUND");
      }

      for (const row of parsed.rows) {
        let token = generateQrToken(eventId);
        while (existingTokens.has(token) || db.attendees.some((a) => a.eventId === eventId && a.qrToken === token)) {
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
