import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authed = req.cookies.get("tele_content_auth")?.value === "1";

  if (pathname === "/login" && authed) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (pathname === "/settings" && !authed) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", "/settings");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/settings"],
};
