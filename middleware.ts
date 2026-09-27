import { NextRequest, NextResponse } from "next/server";
import { checkGate, gateRedirect } from "@/lib/gate";

/** 全站密码门：除 /gate 与静态资源外都需要票据（含 API） */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/gate") || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }
  if (await checkGate(req)) return NextResponse.next();
  return gateRedirect(req);
}

export const config = {
  matcher: ["/((?!api/gate).*)"],
};
