/** AI 批改：识别错词/标点/语法错误 → 存入 essay.feedback */
import { NextRequest, NextResponse } from "next/server";
import { glmChat, extractJson, glmConfigured } from "@/lib/glm";
import { getDb } from "@/lib/db";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!glmConfigured()) return NextResponse.json({ ok: false, error: "未配置 GLM_API_KEY" }, { status: 500 });
  const { essayId } = await req.json();
  if (!essayId) return NextResponse.json({ ok: false, error: "参数缺失" }, { status: 400 });

  const { data: essay, error } = await getDb().from("wr_essays").select("content,prompt_text").eq("id", essayId).single();
  if (error || !essay) return NextResponse.json({ ok: false, error: "作文不存在" }, { status: 404 });

  const prompt = `你是雅思写作批改老师。请逐句检查下面这篇雅思作文，找出所有错误，分为三类：
- grammar（语法错误：时态、主谓一致、冠词、介词、句型等）
- spelling（拼写错误）
- punctuation（标点符号问题：多余/缺失/误用）

只输出 JSON 数组（没有错误就输出 []），每个元素：
{"orig":"原文错误片段","fixed":"修改后","type":"grammar|spelling|punctuation","note":"一句中文说明错误原因"}

注意：orig 必须是作文中【逐字存在】的片段（便于前端高亮），尽量短（一个词组或半句）。

${essay.prompt_text ? "题目：" + essay.prompt_text + "\n\n" : ""}作文：
${essay.content}`;

  try {
    const raw = await glmChat([{ role: "user", content: prompt }], 0.2);
    const items = extractJson<{ orig: string; fixed: string; type: string; note: string }[]>(raw);
    const feedback = Array.isArray(items) ? items.slice(0, 100) : [];
    const { error: upErr } = await getDb().from("wr_essays").update({ feedback }).eq("id", essayId);
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, feedback });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
