import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "soundsense_session";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  if (!request.cookies.get(COOKIE_NAME)) {
    response.cookies.set(COOKIE_NAME, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
