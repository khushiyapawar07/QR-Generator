import { NextResponse } from "next/server";
import { withDB } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("search") ?? "").toLowerCase().trim();

  const payload = await withDB(async (db) => {
    const attendees = db.attendees.filter((a) => a.eventId === eventId);
    const data = query
      ? attendees.filter((a) =>
          [a.name, a.phone, a.email, a.company, a.qrToken]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query),
        )
      : attendees;

    return {
      total: attendees.length,
      data,
    };
  });

  return NextResponse.json({ success: true, ...payload });
}
