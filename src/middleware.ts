import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export default async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

// Tool pages (/stem-split, /reel-to-mp3, /reel-download) are public to view for SEO & AdSense,
// and require login only when clicking the Convert / Extract action button!
export const config = {
  matcher: ["/dashboard/:path*"],
};
