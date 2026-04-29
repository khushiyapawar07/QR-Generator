import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;

  const db = await readDB();
  const rows = db.attendees.filter((a) => a.eventId === eventId);
  const header = [
    "name",
    "email",
    "phone",
    "company",
    "designation",
    "status",
    "checkedInAt",
    "qrToken",
  ];

  const lines = rows.map((row) =>
    [
      row.name,
      row.email ?? "",
      row.phone ?? "",
      row.company ?? "",
      row.designation ?? "",
      row.status,
      row.checkedInAt ?? "",
      row.qrToken,
    ]
      .map(escapeCsv)
      .join(","),
  );

  const csv = [header.join(","), ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="event-${eventId}-attendance.csv"`,
    },
  });
}

function escapeCsv(value: string): string {
  const sanitized = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n")) {
    return `"${sanitized.replaceAll('"', '""')}"`;
  }
  return sanitized;
}
