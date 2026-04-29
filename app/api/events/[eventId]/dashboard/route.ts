import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  const db = await readDB();
  const attendees = db.attendees.filter((a) => a.eventId === eventId);
  const logs = db.scanLogs.filter((l) => l.eventId === eventId);

  const totalAttendees = attendees.length;
  const checkedIn = attendees.filter((a) => a.status === "used").length;
  const pending = attendees.filter((a) => a.status === "unused").length;
  const duplicateAttempts = logs.filter((l) => l.result === "ALREADY_USED").length;
  const invalidAttempts = logs.filter((l) => l.result === "INVALID_QR").length;

  const recentCheckIns = attendees
    .filter((a) => a.checkedInAt)
    .sort((a, b) => (a.checkedInAt! < b.checkedInAt! ? 1 : -1))
    .slice(0, 10);

  const dashboard = {
    totalAttendees,
    checkedIn,
    pending,
    duplicateAttempts,
    invalidAttempts,
    recentCheckIns,
  };

  return NextResponse.json(dashboard);
}
