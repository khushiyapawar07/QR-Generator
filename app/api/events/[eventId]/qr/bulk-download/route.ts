import JSZip from "jszip";
import { NextResponse } from "next/server";
import { withDB } from "@/lib/db";
import { generateQrDataUrl, passSvg } from "@/lib/qr";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  const payload = await withDB(async (db) => {
    const event = db.events.find((row) => row.id === eventId);
    if (!event) return null;

    const attendees = db.attendees.filter((row) => row.eventId === eventId);
    const zip = new JSZip();

    for (const attendee of attendees) {
      const qr = await generateQrDataUrl(attendee.qrToken);
      const svg = passSvg(event.name, attendee.name, qr);
      const fileName = `${attendee.name.replaceAll(/\s+/g, "_")}_${attendee.id.slice(0, 4)}_QR.svg`;
      zip.file(fileName, svg);
    }

    const file = await zip.generateAsync({ type: "uint8array" });
    return file;
  });

  if (!payload) {
    return NextResponse.json({ success: false, message: "Event not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(payload), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="gateqr-passes-${eventId}.zip"`,
    },
  });
}
