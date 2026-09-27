/** 词表详情：词列表（分页/搜索/编辑释义/删词）+ 加词入口 + 开始背诵 */
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import WordImport from "@/components/WordImport";

interface W {
  id: string;
  word: string;
  meaning: string;
  is_phrase: boolean;
  err_count: number;
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const adding = params.get("add") === "1";
  const [name, setName] = useState("");
  const [words, setWords] = useState<W[] | null>(null);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const PER = 50;

  async function load() {
    const res = await fetch(`/api/words?listId=${id}`);
    const json = await res.json();
    if (json.ok) setWords(json.words);
  }
  useEffect(() => {
    if (!adding) load();
    fetch(`/api/lists`).then((r) => r.json()).then((j) => {
      const found = (j.lists ?? []).find((l: { id: string }) => l.id === id);
      if (found) setName(found.name);
    });
  }, [id, adding]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (words ?? []).filter((w) => !f || w.word.toLowerCase().includes(f) || w.meaning.toLowerCase().includes(f));
  }, [words, filter]);
  const pageItems = filtered.slice(page * PER, page * PER + PER);

  async function saveMeaning(w: W) {
    await fetch("/api/words", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: w.id, meaning: draft }),
    });
    setEditing(null);
    load();
  }

  async function removeWord(id2: string) {
    if (!confirm("删除这个单词？")) return;
    await fetch(`/api/words?id=${id2}`, { method: "DELETE" });
    load();
  }

  if (adding) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold">加词：{name}</h1>
        <div className="mt-6">
          <WordImport appendListId={id} appendListName={name} />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{name || "…"}</h1>
          <p className="mt-0.5 text-xs text-slate-400">共 {words?.length ?? 0} 词</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/words/${id}?add=1`} className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-600">+ 加词</Link>
          <Link href={`/words/${id}/recite`} className="rounded-xl bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700">开始背诵</Link>
        </div>
      </div>

      <input value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }} placeholder="搜索单词或释义…" className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />

      <div className="mt-4 divide-y rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {pageItems.map((w) => (
          <div key={w.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="w-44 shrink-0 font-medium">{w.word}</span>
            {editing === w.id ? (
              <>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800" />
                <button onClick={() => saveMeaning(w)} className="text-xs text-primary-600">保存</button>
                <button onClick={() => setEditing(null)} className="text-xs text-slate-400">取消</button>
              </>
            ) : (
              <>
                <span className="flex-1 truncate text-xs text-slate-500 dark:text-slate-400">{w.meaning || "（无释义，点笔补）"}</span>
                {w.err_count > 0 ? <span className="text-xs text-amber-500">错{w.err_count}</span> : null}
                <button onClick={() => { setEditing(w.id); setDraft(w.meaning); }} className="text-xs text-slate-400 hover:text-primary-600">✎</button>
                <button onClick={() => removeWord(w.id)} className="text-xs text-red-300 hover:text-red-500">删</button>
              </>
            )}
          </div>
        ))}
        {!pageItems.length ? <p className="px-4 py-10 text-center text-sm text-slate-400">没有单词</p> : null}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 dark:border-slate-600">上一页</button>
        <span>{page + 1} / {Math.max(1, Math.ceil(filtered.length / PER))}</span>
        <button onClick={() => setPage((p) => Math.min(Math.ceil(filtered.length / PER) - 1, p + 1))} className="rounded-lg border border-slate-200 px-3 py-1 dark:border-slate-600">下一页</button>
      </div>
    </main>
  );
}

export default function WordListDetail() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
