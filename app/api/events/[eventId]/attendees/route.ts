import { NextResponse } from "next/server";
import { readDB } from "@/lib/db";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("search") ?? "").toLowerCase().trim();
  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "100") || 100, 1), 200);
  const offset = (page - 1) * limit;
  const supabase = getSupabaseServiceClient();

  if (supabase) {
    let listQuery = supabase.from("attendees").select("*", { count: "exact" }).eq("event_id", eventId);

    if (query) {
      listQuery = listQuery.or(
        `name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%,qr_token.ilike.%${query}%`,
      );
    }

    const { data, count, error } = await listQuery.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      total: count ?? 0,
      page,
      limit,
      hasMore: (count ?? 0) > offset + (data?.length ?? 0),
      data: (data ?? []).map((a) => ({
        id: a.id,
        eventId: a.event_id,
        name: a.name,
        email: a.email ?? undefined,
        phone: a.phone ?? undefined,
        company: a.company ?? undefined,
        designation: a.designation ?? undefined,
        category: a.category ?? undefined,
        notes: a.notes ?? undefined,
        qrToken: a.qr_token,
        status: a.status,
        checkedInAt: a.checked_in_at ?? undefined,
        checkedInBy: a.checked_in_by ?? undefined,
        createdAt: a.created_at,
      })),
    });
  }

  const db = await readDB();
  const attendees = db.attendees.filter((a) => a.eventId === eventId);
  const filtered = query
    ? attendees.filter((a) =>
        [a.name, a.phone, a.email, a.company, a.qrToken]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
    : attendees;
  const data = filtered.slice(offset, offset + limit);

  return NextResponse.json({
    success: true,
    total: filtered.length,
    page,
    limit,
    hasMore: filtered.length > offset + data.length,
    data,
  });
}
