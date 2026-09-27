/** 板块1首页：词表列表 */
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface ListRow {
  id: string;
  name: string;
  wordCount: number;
  created_at: string;
}

export default function WordsPage() {
  const [lists, setLists] = useState<ListRow[] | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    const res = await fetch("/api/lists");
    const json = await res.json();
    if (json.ok) setLists(json.lists);
    else setErr(json.error || "加载失败");
  }
  useEffect(() => {
    load();
  }, []);

  async function remove(id: string, name: string) {
    if (!confirm(`删除词表「${name}」及其全部单词？不可恢复`)) return;
    await fetch(`/api/lists?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">① 单词抄写</h1>
        <Link href="/words/new" className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
          + 新建词表 / 导入
        </Link>
      </div>
      {err ? <p className="mt-4 text-sm text-red-500">{err}</p> : null}
      {lists && lists.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-400">
          还没有词表。点右上角「新建词表 / 导入」开始，支持电子书、文档、图片。
        </p>
      ) : null}
      <div className="mt-6 space-y-3">
        {(lists ?? []).map((l) => (
          <div key={l.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <Link href={`/words/${l.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900 dark:text-white">{l.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {l.wordCount} 词 · {new Date(l.created_at).toLocaleDateString("zh-CN")}
              </p>
            </Link>
            <div className="ml-4 flex shrink-0 items-center gap-2">
              <Link href={`/words/${l.id}/recite`} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700">
                背诵
              </Link>
              <Link href={`/words/${l.id}?add=1`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
                加词
              </Link>
              <button onClick={() => remove(l.id, l.name)} className="rounded-lg px-2 py-1.5 text-xs text-red-400 hover:bg-red-50 dark:hover:bg-red-950">
                删
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
