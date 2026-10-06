/** 音标代理：服务端查免费词典 API（dictionaryapi.dev），避免用户浏览器直连不可达 */
import { NextRequest, NextResponse } from "next/server";

export const revalidate = 86400;

function extractPhonetic(j: unknown): string {
  const arr = j as Array<Record<string, unknown>>;
  if (!Array.isArray(arr) || !arr.length) return "";
  const e0 = arr[0] as { phonetic?: string; phonetics?: Array<{ text?: string }> };
  const raw = e0.phonetic || e0.phonetics?.find((x) => x?.text)?.text || "";
  return raw.replace(/^\/+|\/+$/g, "").trim().slice(0, 60);
}

export async function GET(req: NextRequest) {
  const w = (req.nextUrl.searchParams.get("w") || "").trim().toLowerCase();
  if (!/^[a-z][a-z\s'-]{0,40}$/.test(w)) {
    return NextResponse.json({ ok: false, phonetic: "" }, { status: 400 });
  }
  try {
    const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`, {
      next: { revalidate: 86400 },
      headers: { "user-agent": "ielts-site/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return NextResponse.json({ ok: true, phonetic: "" });
    const phonetic = extractPhonetic(await r.json());
    return NextResponse.json({ ok: true, phonetic });
  } catch {
    return NextResponse.json({ ok: true, phonetic: "" });
  }
}
