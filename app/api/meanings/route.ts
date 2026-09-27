/** 批量配释义：POST {words:[≤60]} → GLM glm-4-flash → [{word, meaning}]（两个意思 ; 分隔） */
import { NextRequest, NextResponse } from "next/server";
import { glmChat, extractJson, glmConfigured } from "@/lib/glm";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!glmConfigured()) return NextResponse.json({ ok: false, error: "未配置 GLM_API_KEY" }, { status: 500 });
  const { words } = await req.json();
  if (!Array.isArray(words) || words.length === 0 || words.length > 80) {
    return NextResponse.json({ ok: false, error: "words 数量须在 1~80" }, { status: 400 });
  }
  const list = (words as string[]).map((w) => String(w).trim()).filter(Boolean);
  const prompt = `你是雅思词汇助手。为下面每个英文单词或短语给出【两个最常见的中文释义】，用英文分号;分隔。短语也照样处理。
只输出 JSON 数组，格式：[{"word":"原词","meaning":"释义一;释义二"}]，不要输出任何其他文字。

单词列表：
${list.map((w) => "- " + w).join("\n")}`;

  try {
    const raw = await glmChat([{ role: "user", content: prompt }], 0.2);
    const parsed = extractJson<{ word: string; meaning: string }[]>(raw);
    if (!parsed || !Array.isArray(parsed)) {
      return NextResponse.json({ ok: false, error: "模型返回解析失败" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, items: parsed });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
