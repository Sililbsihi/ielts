/** 全站密码门：cookie 存 HMAC 签名票据，middleware 统一校验 */
import { NextRequest, NextResponse } from "next/server";

export const GATE_COOKIE = "gate_ticket";

async function ticket(code: string): Promise<string> {
  const data = new TextEncoder().encode("ielts-gate:" + code);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 校验请求带的票据是否有效 */
export async function validTicket(ticketValue: string | undefined): Promise<boolean> {
  const code = process.env.ACCESS_CODE;
  if (!code) return true; // 未配置密码 = 不设防（本地开发）
  return ticketValue === (await ticket(code));
}

export { ticket as makeTicket };

export async function checkGate(req: NextRequest): Promise<boolean> {
  return validTicket(req.cookies.get(GATE_COOKIE)?.value);
}

export function gateRedirect(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  url.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}
