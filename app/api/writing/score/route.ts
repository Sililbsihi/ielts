/** AI 四标准打分：TR/CC/LR/GRA + 总分 + 中文总评 → 存入 essay.scores */
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

  const prompt = `你是雅思官方考官。请按雅思写作四项评分标准给这篇作文打分（Task 2 按 6 分制上限 9 分，支持 0.5）：
- task_response：任务回应（审题/立场/展开）
- coherence：连贯与衔接（结构/逻辑/衔接词）
- lexical：词汇资源（丰富度/准确性/搭配）
- grammar：语法多样性与准确性

只输出 JSON：{"task_response":6.5,"coherence":6.0,"lexical":6.5,"grammar":6.0,"overall":6.5,"comment":"80字以内的中文总评，先说优点再给最重要的一条提升建议"}

${essay.prompt_text ? "题目：" + essay.prompt_text + "\n\n" : ""}作文：
${essay.content}`;

  try {
    const raw = await glmChat([{ role: "user", content: prompt }], 0.2);
    const scores = extractJson<{ task_response: number; coherence: number; lexical: number; grammar: number; overall: number; comment: string }>(raw);
    if (!scores || typeof scores.overall !== "number") {
      return NextResponse.json({ ok: false, error: "模型返回解析失败" }, { status: 502 });
    }
    const { error: upErr } = await getDb().from("wr_essays").update({ scores }).eq("id", essayId);
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, scores });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
