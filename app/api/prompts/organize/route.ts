/** AI 智能拆题：POST {text} → GLM 把杂乱真题文本拆成 [{content, kind}] */
import { NextRequest, NextResponse } from "next/server";
import { glmChat, extractJson, glmConfigured } from "@/lib/glm";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!glmConfigured()) return NextResponse.json({ ok: false, error: "未配置 GLM_API_KEY" }, { status: 500 });
  const { text } = await req.json();
  if (!text || typeof text !== "string" || text.trim().length < 20) {
    return NextResponse.json({ ok: false, error: "文本太短" }, { status: 400 });
  }
  const prompt = `下面是从雅思真题 PDF 里抽取出来的原始文本，格式很乱。请把它整理成一道道独立的写作题目。
要求：
1. 每道题输出完整的题干原文（把被换行/页眉/页码打断的句子拼回去，去掉与题目无关的目录、页眉、水印文字）
2. kind 判断："task1"（图表/信件类，出现 chart/graph/letter/diagram 等字样）、"task2"（议论/报告类）、其它填 "other"
3. 只输出 JSON 数组：[{"content":"题干全文","kind":"task1|task2|other"}]
4. 题目数量不确定，有多少拆多少，宁可多拆不要把两题并成一条

原始文本：
${String(text).slice(0, 24000)}`;

  try {
    const raw = await glmChat([{ role: "user", content: prompt }], 0.2);
    const items = extractJson<{ content: string; kind: string }[]>(raw);
    if (!items || !Array.isArray(items) || !items.length) {
      return NextResponse.json({ ok: false, error: "模型没拆出题目，试试减少文本量或手动添加" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, items: items.filter((i) => i.content && i.content.length > 20).slice(0, 200) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
