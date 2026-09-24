import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DEFAULT_SESSION_KEY } from "@nhost/nhost-js/session";
import { refreshNhostSession } from "@/lib/nhost/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await refreshNhostSession(request, response);
  const path = request.nextUrl.pathname;
  const isPublic = path === "/" || path.startsWith("/records") || path.startsWith("/login");

  // An expired or malformed session must not reach Server Components. Nhost can
  // return a non-JSON maintenance response while Auth is restarting; a single
  // cookie-clearing redirect lets public pages continue as a visitor.
  if (!session && request.cookies.has(DEFAULT_SESSION_KEY)) {
    const destination = isPublic ? request.nextUrl.clone() : new URL("/login", request.url);
    const resetResponse = NextResponse.redirect(destination);
    resetResponse.cookies.delete(DEFAULT_SESSION_KEY);
    return resetResponse;
  }

  if (!session && !isPublic) return NextResponse.redirect(new URL("/login", request.url));
  if (session && path.startsWith("/login")) return NextResponse.redirect(new URL("/records", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
