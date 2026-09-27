/** 词表 CRUD：GET 列表(含词数) / POST 建表 / PATCH 改名 / DELETE 删表 */
import { NextRequest, NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/db";

export const maxDuration = 60;

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ ok: false, error: "未配置数据库" }, { status: 500 });
  const db = getDb();
  const { data, error } = await db
    .from("wl_lists")
    .select("id,name,created_at,wl_words(count)");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const lists = (data ?? []).map((r: { id: string; name: string; created_at: string; wl_words: { count: number }[] }) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    wordCount: r.wl_words?.[0]?.count ?? 0,
  }));
  return NextResponse.json({ ok: true, lists });
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ ok: false, error: "词表名不能为空" }, { status: 400 });
  const db = getDb();
  const { data, error } = await db.from("wl_lists").insert({ name: String(name).trim().slice(0, 60) }).select("id,name").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, list: data });
}

export async function PATCH(req: NextRequest) {
  const { id, name } = await req.json();
  if (!id || !name?.trim()) return NextResponse.json({ ok: false, error: "参数缺失" }, { status: 400 });
  const { error } = await getDb().from("wl_lists").update({ name: String(name).trim().slice(0, 60) }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "参数缺失" }, { status: 400 });
  const { error } = await getDb().from("wl_lists").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
