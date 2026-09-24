import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { refreshNhostSession } from "@/lib/nhost/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await refreshNhostSession(request, response);
  const path = request.nextUrl.pathname;
  const isPublic = path === "/" || path.startsWith("/records") || path.startsWith("/login");
  if (!session && !isPublic) return NextResponse.redirect(new URL("/login", request.url));
  if (session && path.startsWith("/login")) return NextResponse.redirect(new URL("/records", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
