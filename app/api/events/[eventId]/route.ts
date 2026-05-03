import { NextResponse } from "next/server";
import { withDB } from "@/lib/db";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function DELETE(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;

  const supabase = getSupabaseServiceClient();

  if (supabase) {
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  await withDB(async (db) => {
    db.events = db.events.filter((e) => e.id !== eventId);
    // Optionally remove attendees and scan logs associated with this event
    db.attendees = db.attendees.filter((a) => a.eventId !== eventId);
    db.scanLogs = db.scanLogs.filter((s) => s.eventId !== eventId);
  });

  return NextResponse.json({ success: true });
}
