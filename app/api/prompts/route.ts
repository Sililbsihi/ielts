/** 写作题库：GET 列表 / POST 批量导入 {items:[{content,kind?}]} / DELETE */
import { NextRequest, NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/db";

export const maxDuration = 60;

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ ok: false, error: "未配置数据库" }, { status: 500 });
  const { data, error } = await getDb().from("wr_prompts").select("*").order("created_at", { ascending: true }).limit(2000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, prompts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { items } = await req.json();
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ ok: false, error: "没有可入库的题目" }, { status: 400 });
  if (!isDbConfigured()) return NextResponse.json({ ok: false, error: "未配置数据库" }, { status: 500 });
  const rows = (items as { content: string; kind?: string }[])
    .map((it) => ({ content: String(it.content ?? "").trim().slice(0, 1500), kind: it.kind === "task1" ? "task1" : it.kind === "other" ? "other" : "task2" }))
    .filter((r) => r.content.length > 0);
  if (!rows.length) return NextResponse.json({ ok: false, error: "题目内容全为空" }, { status: 400 });
  // 去重：内容完全一致的跳过
  const { data: existing } = await getDb().from("wr_prompts").select("content").limit(5000);
  const have = new Set((existing ?? []).map((r: { content: string }) => r.content));
  const fresh = rows.filter((r) => !have.has(r.content));
  if (!fresh.length) return NextResponse.json({ ok: true, inserted: 0, note: "全部与已有题目重复" });
  const { error } = await getDb().from("wr_prompts").insert(fresh);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, inserted: fresh.length });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "参数缺失" }, { status: 400 });
  const { error } = await getDb().from("wr_prompts").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
