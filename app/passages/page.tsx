/** 板块2首页：短文列表 */
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Row {
  id: string;
  title: string;
  created_at: string;
  markCount: number;
  words: number;
}

export default function PassagesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/passages");
      const json = await res.json();
      if (json.ok && Array.isArray(json.list)) setRows(json.list);
      else {
        setRows([]);
        setErr(json.error || "返回数据异常");
      }
    } catch (e) {
      setRows([]);
      setErr(e instanceof Error ? e.message : "网络异常");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function remove(id: string, title: string) {
    if (!confirm(`删除短文「${title}」？不可恢复`)) return;
    await fetch(`/api/passages?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">② 短文填空</h1>
        <Link href="/passages/new" className="rounded-xl bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700">+ 导入短文</Link>
      </div>

      {err ? <p className="mt-6 text-sm text-red-500">{err}</p> : null}
      {!rows && !err ? <p className="mt-6 text-sm text-slate-400">加载中…</p> : null}

      {rows && !rows.length ? (
        <p className="mt-10 text-center text-sm text-slate-400">还没有短文，点右上角导入第一篇</p>
      ) : null}

      <div className="mt-6 space-y-3">
        {(rows ?? []).map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900">
            <Link href={`/passages/${p.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-900 dark:text-white">{p.title}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                约 {p.words} 词 · {p.markCount} 个挖空 · {new Date(p.created_at).toLocaleDateString("zh-CN")}
              </p>
            </Link>
            <div className="ml-4 flex shrink-0 items-center gap-2">
              <Link href={`/passages/${p.id}/recite`} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700">背诵</Link>
              <Link href={`/passages/new?edit=${p.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">编辑</Link>
              <button onClick={() => remove(p.id, p.title)} className="rounded-lg px-2 py-1.5 text-xs text-red-400 hover:bg-red-50 dark:hover:bg-red-950">删</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
