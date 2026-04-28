import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  role: z.enum(["admin", "scanner", "super_admin"]),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid role" }, { status: 400 });
  }

  const response = NextResponse.json({ success: true, role: parsed.data.role });
  response.cookies.set("gateqr_role", parsed.data.role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
