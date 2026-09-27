/** 密码验证：正确则种票据 cookie（30 天） */
import { NextRequest, NextResponse } from "next/server";
import { makeTicket, GATE_COOKIE } from "@/lib/gate";

export async function POST(req: NextRequest) {
  const { code } = await req.json().catch(() => ({ code: "" }));
  const expected = process.env.ACCESS_CODE;
  if (!expected) return NextResponse.json({ ok: true }); // 未设防
  if (String(code ?? "").trim() !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, await makeTicket(expected), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
