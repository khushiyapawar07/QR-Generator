import { NextResponse } from "next/server";
import { withDB } from "@/lib/db";
import { generateQrDataUrl, passSvg } from "@/lib/qr";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; attendeeId: string }> },
) {
  const { eventId, attendeeId } = await params;

  const payload = await withDB(async (db) => {
    const event = db.events.find((row) => row.id === eventId);
    const attendee = db.attendees.find((row) => row.id === attendeeId && row.eventId === eventId);
    if (!event || !attendee) return null;

    const qr = await generateQrDataUrl(attendee.qrToken);
    const svg = passSvg(event.name, attendee.name, qr);

    return {
      svg,
      fileName: `${attendee.name.replaceAll(/\s+/g, "_")}_QR.svg`,
    };
  });

  if (!payload) {
    return NextResponse.json({ success: false, message: "Pass not found" }, { status: 404 });
  }

  return new NextResponse(payload.svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${payload.fileName}"`,
    },
  });
}
