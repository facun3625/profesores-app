// apps/web/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("accessToken")?.value;

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// ✅ IMPORTANTE: proteger SOLO rutas privadas
export const config = {
  matcher: [
    "/exams/:path*",
    "/subjects/:path*",
    "/topics/:path*",
    "/questions/:path*",
  ],
};