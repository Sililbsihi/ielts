/** 短文 CRUD：GET 列表或单条 / POST 新建 {title,body,marks} / PATCH / DELETE */
import { NextRequest, NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/db";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isDbConfigured()) return NextResponse.json({ ok: false, error: "未配置数据库" }, { status: 500 });
  const db = getDb();
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const { data, error } = await db.from("ps_passages").select("*").eq("id", id).single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
    return NextResponse.json({ ok: true, passage: data });
  }
  const { data, error } = await db.from("ps_passages").select("id,title,created_at,body,marks").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const list = (data ?? []).map((p: { id: string; title: string; created_at: string; body: string; marks: unknown[] }) => ({
    id: p.id,
    title: p.title,
    created_at: p.created_at,
    words: (p.body.match(/\S+/g) ?? []).length,
    markCount: Array.isArray(p.marks) ? p.marks.length : 0,
  }));
  return NextResponse.json({ ok: true, list });
}

export async function POST(req: NextRequest) {
  const { title, body, marks } = await req.json();
  if (!title?.trim() || !body?.trim()) return NextResponse.json({ ok: false, error: "标题和正文不能为空" }, { status: 400 });
  if (!isDbConfigured()) return NextResponse.json({ ok: false, error: "未配置数据库" }, { status: 500 });
  const { data, error } = await getDb()
    .from("ps_passages")
    .insert({ title: String(title).trim().slice(0, 80), body: String(body), marks: Array.isArray(marks) ? marks : [] })
    .select("id")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req: NextRequest) {
  const { id, title, body, marks } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: "参数缺失" }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (typeof title === "string" && title.trim()) patch.title = title.trim().slice(0, 80);
  if (typeof body === "string") patch.body = body;
  if (Array.isArray(marks)) patch.marks = marks;
  const { error } = await getDb().from("ps_passages").update(patch).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "参数缺失" }, { status: 400 });
  const { error } = await getDb().from("ps_passages").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
