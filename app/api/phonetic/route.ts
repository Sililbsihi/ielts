/** 音标代理：主源有道（稳），兜底 dictionaryapi.dev；结果缓存 1 天 */
import { NextRequest, NextResponse } from "next/server";

export const revalidate = 86400;

function fromYoudao(j: unknown): string {
  const o = j as { simple?: { word?: Array<{ usphone?: string; ukphone?: string }> } };
  const w = o?.simple?.word?.[0];
  return (w?.usphone || w?.ukphone || "").replace(/^\/+|\/+$/g, "").trim().slice(0, 60);
}

function fromFreeDict(j: unknown): string {
  const arr = j as Array<Record<string, unknown>>;
  if (!Array.isArray(arr) || !arr.length) return "";
  const e0 = arr[0] as { phonetic?: string; phonetics?: Array<{ text?: string }> };
  return (e0.phonetic || e0.phonetics?.find((x) => x?.text)?.text || "")
    .replace(/^\/+|\/+$/g, "").trim().slice(0, 60);
}

async function tryFetch(url: string, ms: number): Promise<unknown | null> {
  try {
    const r = await fetch(url, {
      next: { revalidate: 86400 },
      headers: { "user-agent": "Mozilla/5.0 (compatible; ielts-site/1.0)" },
      signal: AbortSignal.timeout(ms),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const w = (req.nextUrl.searchParams.get("w") || "").trim().toLowerCase();
  if (!/^[a-z][a-z\s'-]{0,40}$/.test(w)) {
    return NextResponse.json({ ok: false, phonetic: "" }, { status: 400 });
  }
  const q = encodeURIComponent(w);
  const phonetic =
    fromYoudao(await tryFetch(`https://dict.youdao.com/jsonapi?q=${q}&strict=false&dicts=%7B%22count%22%3A1%2C%22dicts%22%3A%5B%5B%22ec%22%5D%5D%7D`, 6000)) ||
    fromFreeDict(await tryFetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${q}`, 6000));
  return NextResponse.json({ ok: true, phonetic });
}
