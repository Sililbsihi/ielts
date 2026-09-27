/** AI 智能拆题（单块）：POST {text≤9000字} → GLM → [{content, kind}]；长文由客户端分块循环调用 */
import { NextRequest, NextResponse } from "next/server";
import { glmChat, extractJson, glmConfigured } from "@/lib/glm";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!glmConfigured()) return NextResponse.json({ ok: false, error: "未配置 GLM_API_KEY" }, { status: 500 });
  const { text } = await req.json();
  if (!text || typeof text !== "string" || text.trim().length < 20) {
    return NextResponse.json({ ok: false, error: "文本太短" }, { status: 400 });
  }
  const chunk = String(text).slice(0, 3000);
  const prompt = `下面是从雅思真题 PDF 里抽取出来的一段原始文本，格式很乱（可能混有页眉、微博水印、页码、题号）。请把它整理成一道道独立的写作题目。
要求：
1. 每道题输出完整题干（把被换行打断的句子拼回去；去掉"新浪微博：@xxx"、纯页码、目录行等与题干无关的内容）
2. 一条真题 = 一个观点论述题干；若一段里含多道题（以日期如 2013.02.02 分隔），必须拆成多道
3. kind："task1"（图表/信件：chart/graph/letter/diagram 等字样）、"task2"（议论/报告类，本段绝大多数是这种）、不确定填 "other"
4. 只输出 JSON 数组：[{"content":"题干英文全文","kind":"task1|task2|other"}]，不要任何其他文字
5. 本段如果被切断在题目中间，整理出能完整理解的部分即可

文本：
${chunk}`;

  try {
    const raw = await glmChat([{ role: "user", content: prompt }], 0.2, 45000);
    const items = extractJson<{ content: string; kind: string }[]>(raw);
    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ ok: false, error: "模型返回解析失败，请重试一次" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, items: items.filter((i) => i.content && i.content.length > 20) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg.includes("abort") ? "本块处理超时，请重试" : msg }, { status: 502 });
  }
}
