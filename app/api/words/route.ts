/** 单词 API：GET 列表 / POST 批量入库(去重只插新) / PUT 批量补释义 / PATCH 改词 / DELETE */
import { NextRequest, NextResponse } from "next/server";
import { getDb, isDbConfigured } from "@/lib/db";

export const maxDuration = 60;

function normWord(w: string): string {
  return String(w).trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

export async function GET(req: NextRequest) {
  const listId = req.nextUrl.searchParams.get("listId");
  if (!listId) return NextResponse.json({ ok: false, error: "缺少 listId" }, { status: 400 });
  if (!isDbConfigured()) return NextResponse.json({ ok: false, error: "未配置数据库" }, { status: 500 });
  let degraded = false;
  let { data, error } = await getDb()
    .from("wl_words")
    .select("id,word,norm,meaning,is_phrase,pos,err_count,starred,recited")
    .eq("list_id", listId)
    .order("pos", { ascending: true })
    .limit(20000);
  if (error) {
    // 数据库还没加 starred/recited 列 → 降级：不带新列查询，前端用本地存储兜底
    const retry = await getDb()
      .from("wl_words")
      .select("id,word,norm,meaning,is_phrase,pos,err_count")
      .eq("list_id", listId)
      .order("pos", { ascending: true })
      .limit(20000);
    data = retry.data as typeof data;
    error = retry.error;
    degraded = !retry.error;
  }
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, words: data ?? [] });
}

/** POST {words:[{list_id,word,norm,meaning,is_phrase,pos}]} —— 冲突(list_id,norm)时跳过，不覆盖旧词 */
export async function POST(req: NextRequest) {
  const { words } = await req.json();
  if (!Array.isArray(words) || !words.length) return NextResponse.json({ ok: false, error: "没有可入库的词" }, { status: 400 });
  if (!isDbConfigured()) return NextResponse.json({ ok: false, error: "未配置数据库" }, { status: 500 });
  const rows = (words as Record<string, unknown>[]).map((w) => ({
    list_id: String(w.list_id),
    word: String(w.word).slice(0, 80),
    norm: normWord(String(w.word)),
    meaning: String(w.meaning ?? "").slice(0, 200),
    is_phrase: Boolean(w.is_phrase),
    pos: Number(w.pos) || 0,
  }));
  const { error } = await getDb()
    .from("wl_words")
    .upsert(rows, { onConflict: "list_id,norm", ignoreDuplicates: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, received: rows.length });
}

/** PUT {listId, meanings:[{word, meaning}]} —— 只补空释义 */
export async function PUT(req: NextRequest) {
  const { listId, meanings } = await req.json();
  if (!listId || !Array.isArray(meanings)) return NextResponse.json({ ok: false, error: "参数缺失" }, { status: 400 });
  if (!isDbConfigured()) return NextResponse.json({ ok: false, error: "未配置数据库" }, { status: 500 });
  const db = getDb();
  let updated = 0;
  for (const m of meanings as { word: string; meaning: string }[]) {
    if (!m?.word || !m?.meaning) continue;
    const { error } = await db
      .from("wl_words")
      .update({ meaning: String(m.meaning).slice(0, 200) })
      .eq("list_id", listId)
      .eq("norm", normWord(m.word))
      .eq("meaning", "");
    if (!error) updated += 1;
  }
  return NextResponse.json({ ok: true, updated });
}

export async function PATCH(req: NextRequest) {
  const { id, word, meaning, err_delta, starred, recited } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: "参数缺失" }, { status: 400 });
  if (err_delta) {
    // 累计错误 +1（单用户场景，先读后写足够）
    const { data: cur } = await getDb().from("wl_words").select("err_count").eq("id", id).single();
    const { error } = await getDb().from("wl_words").update({ err_count: ((cur?.err_count as number) ?? 0) + Number(err_delta) }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const patch: Record<string, unknown> = {};
  if (typeof word === "string" && word.trim()) {
    patch.word = word.trim().slice(0, 80);
    patch.norm = normWord(word);
    patch.is_phrase = /\s/.test(patch.word as string);
  }
  if (typeof meaning === "string") patch.meaning = meaning.slice(0, 200);
  if (typeof starred === "boolean") patch.starred = starred;
  if (typeof recited === "boolean") patch.recited = recited;
  if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: "无可更新字段" }, { status: 400 });
  const { error } = await getDb().from("wl_words").update(patch).eq("id", id);
  if (error) {
    const msg = error.message || "";
    if (/column|schema/i.test(msg)) {
      // 列未建：返回降级标记，前端写本地存储
      return NextResponse.json({ ok: true, degraded: true });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ids = sp.get("ids");
  const id = sp.get("id");
  if (!id && !ids) return NextResponse.json({ ok: false, error: "参数缺失" }, { status: 400 });
  const query = getDb().from("wl_words").delete();
  const { error } = ids
    ? await query.in("id", ids.split(",").map((s) => s.trim()).filter(Boolean))
    : await query.eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
