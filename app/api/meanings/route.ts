/** 批量配释义：POST {words:[≤40]} → GLM → [{word, meaning}]（两个意思 ; 分隔，行式输出更快） */
import { NextRequest, NextResponse } from "next/server";
import { glmChat, glmConfigured } from "@/lib/glm";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!glmConfigured()) return NextResponse.json({ ok: false, error: "未配置 GLM_API_KEY" }, { status: 500 });
  const { words } = await req.json();
  if (!Array.isArray(words) || words.length === 0 || words.length > 40) {
    return NextResponse.json({ ok: false, error: "words 数量须在 1~40" }, { status: 400 });
  }
  const list = (words as string[]).map((w) => String(w).trim()).filter(Boolean);
  const prompt = `给每个英文词一个两义中文释义（用;隔开）。严格按此格式逐行输出，一行一词，不要编号不要多余文字：
原词|释义一;释义二

${list.join("\n")}`;

  try {
    const raw = await glmChat([{ role: "user", content: prompt }], 0.2, 45000);
    const items: { word: string; meaning: string }[] = [];
    const wanted = new Map(list.map((w) => [w.toLowerCase(), w]));
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*(.+?)\s*\|\s*(.+?)\s*$/);
      if (!m) continue;
      const word = m[1].replace(/^\d+[.、)\s]*/, "").replace(/^[*-]\s*/, "").trim();
      const meaning = m[2].replace(/^[`*]|[`*]$/g, "").trim().slice(0, 200);
      if (!word || !meaning) continue;
      const match = wanted.get(word.toLowerCase());
      if (match) items.push({ word: match, meaning });
    }
    if (!items.length) return NextResponse.json({ ok: false, error: "模型返回解析失败，请重试" }, { status: 502 });
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg.includes("abort") ? "AI 响应超时，请重试" : msg }, { status: 502 });
  }
}
