import JSZip from "jszip";
import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { generateQrDataUrl, passSvg } from "@/lib/qr";

const MAX_SYNC_BULK_PASSES = 400;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  const db = await readDB();
  const event = db.events.find((row) => row.id === eventId);
  if (!event) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 });
  }
  const attendees = db.attendees.filter((row) => row.eventId === eventId);

  if (attendees.length > MAX_SYNC_BULK_PASSES) {
    return NextResponse.json(
      {
        success: false,
        message: `This event has ${attendees.length} attendees. Bulk ZIP is limited to ${MAX_SYNC_BULK_PASSES} for sync download to prevent timeout. Please export CSV and generate passes in batches.`,
      },
      { status: 413 },
    );
  }

  const zip = new JSZip();
  for (const attendee of attendees) {
    const qr = await generateQrDataUrl(attendee.qrToken);
    const svg = passSvg(event.name, attendee.name, qr);
    const fileName = `${attendee.name.replaceAll(/\s+/g, "_")}_${attendee.id.slice(0, 4)}_QR.svg`;
    zip.file(fileName, svg);
  }
  const payload = await zip.generateAsync({ type: "uint8array" });

  return new NextResponse(Buffer.from(payload), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="gateqr-passes-${eventId}.zip"`,
    },
  });
}
