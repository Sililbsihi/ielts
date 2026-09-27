/** 短文详情：预览挖空效果 + 进入背诵 */
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Mark { start: number; end: number }

export default function PassageDetail() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<{ title: string; body: string; marks: Mark[]; created_at: string } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/passages?id=${id}`)
      .then((r) => r.json())
      .then((j) => (j.ok ? setP(j.passage) : setErr(j.error)));
  }, [id]);

  if (err) return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-red-500">{err}</main>;
  if (!p) return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-slate-400">加载中…</main>;

  const marks = [...(p.marks ?? [])].sort((a, b) => a.start - b.start);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  marks.forEach((m, i) => {
    if (m.start > cursor) nodes.push(<span key={`t${i}`}>{p.body.slice(cursor, m.start)}</span>);
    const w = p.body.slice(m.start, m.end);
    const show = w.length >= 3 ? `${w.slice(0, 1)}……${w.slice(-1)}` : `${w.slice(0, 1)}……`;
    nodes.push(<span key={`m${i}`} className="mx-0.5 rounded bg-amber-100 px-1 font-mono text-primary-700 dark:bg-amber-900/30 dark:text-primary-300">{show}</span>);
    cursor = m.end;
  });
  if (cursor < p.body.length) nodes.push(<span key="tail">{p.body.slice(cursor)}</span>);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{p.title}</h1>
          <p className="mt-1 text-xs text-slate-400">{marks.length} 个挖空 · {new Date(p.created_at).toLocaleDateString("zh-CN")}</p>
        </div>
        <Link href={`/passages/${id}/recite`} className="shrink-0 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700">开始背诵</Link>
      </div>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-7 dark:border-slate-700 dark:bg-slate-900">{nodes}</div>
    </main>
  );
}
