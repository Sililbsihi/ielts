/** 作文：GET 列表或单条 / POST 保存新作文 / PATCH 更新批改与评分 */
import { NextRequest, NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/db";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ ok: false, error: "未配置数据库" }, { status: 500 });
  const db = getDb();
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const { data, error } = await db.from("wr_essays").select("*").eq("id", id).single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
    return NextResponse.json({ ok: true, essay: data });
  }
  const { data, error } = await db
    .from("wr_essays")
    .select("id,title,prompt_text,created_at,seconds,scores,feedback,content")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, essays: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { prompt_id, prompt_text, title, brainstorm, content, seconds } = await req.json();
  if (!content?.trim()) return NextResponse.json({ ok: false, error: "作文内容为空" }, { status: 400 });
  if (!isDbConfigured()) return NextResponse.json({ ok: false, error: "未配置数据库" }, { status: 500 });
  const { data, error } = await getDb()
    .from("wr_essays")
    .insert({
      prompt_id: prompt_id || null,
      prompt_text: String(prompt_text ?? "").slice(0, 1500),
      title: String(title ?? "").slice(0, 120),
      brainstorm: String(brainstorm ?? "").slice(0, 5000),
      content: String(content).slice(0, 20000),
      seconds: Math.max(0, Math.min(7200, Number(seconds) || 0)),
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req: NextRequest) {
  const { id, feedback, scores } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: "参数缺失" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (feedback !== undefined) patch.feedback = feedback;
  if (scores !== undefined) patch.scores = scores;
  if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: "无可更新字段" }, { status: 400 });
  const { error } = await getDb().from("wr_essays").update(patch).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
