import { NextResponse, type NextRequest } from "next/server";

const protectedPrefixes = ["/admin", "/scanner"];
const authEnabled = process.env.ENABLE_AUTH === "true";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!authEnabled || !isProtected) return NextResponse.next();

  const role = request.cookies.get("gateqr_role")?.value;

  if (!role) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/admin") && !["admin", "super_admin"].includes(role)) {
    return NextResponse.redirect(new URL("/scanner", request.url));
  }

  if (pathname.startsWith("/scanner") && !["admin", "super_admin", "scanner"].includes(role)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/scanner/:path*"],
};
