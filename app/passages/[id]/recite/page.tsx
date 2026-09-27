/**
 * 填空背诵引擎：
 * - 挖空处键入一次；整词/整短语对比（忽略大小写与多余空格）
 * - 错 2 次 → 出现 tips 按钮，每按一次多提示 1 个字母（从左往右）
 * - 也可选「整词提醒」直接亮出答案（标红）
 * - 全部完成出小结
 */
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Mark { start: number; end: number }
interface MarkState { wrong: number; tips: number; revealed: boolean; done: boolean }

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export default function PassageRecitePage() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<{ title: string; body: string; marks: Mark[] } | null>(null);
  const [err, setErr] = useState("");
  const [states, setStates] = useState<Record<number, MarkState>>({});
  const [values, setValues] = useState<Record<number, string>>({});
  const [shake, setShake] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    fetch(`/api/passages?id=${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setP(j.passage);
          const init: Record<number, MarkState> = {};
          (j.passage.marks as Mark[]).forEach((_, i) => (init[i] = { wrong: 0, tips: 0, revealed: false, done: false }));
          setStates(init);
        } else setErr(j.error);
      });
  }, [id]);

  const marks = useMemo(() => [...(p?.marks ?? [])].sort((a, b) => a.start - b.start), [p]);
  const allDone = marks.length > 0 && marks.every((_, i) => states[i]?.done);

  function submit(i: number) {
    if (!p) return;
    const m = marks[i];
    const st = states[i];
    if (!m || !st || st.done) return;
    const answer = norm(p.body.slice(m.start, m.end));
    const got = norm(values[i] ?? "");
    if (got === answer) {
      setStates((s) => ({ ...s, [i]: { ...s[i], done: true } }));
      // 聚焦下一个未完成的空
      const next = marks.findIndex((_, k) => k > i && !states[k]?.done);
      const el = document.querySelector<HTMLInputElement>(`[data-slot="${next >= 0 ? next : marks.findIndex((_, k) => !states[k]?.done)}"]`);
      el?.focus();
      if (marks.every((_, k) => k === i || states[k]?.done)) setFinished(true);
    } else {
      const wrong = st.wrong + 1;
      setStates((s) => ({ ...s, [i]: { ...s[i], wrong } }));
      setShake(i);
      setTimeout(() => setShake(null), 500);
      setValues((v) => ({ ...v, [i]: "" }));
    }
  }

  if (err) return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-red-500">{err}</main>;
  if (!p) return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-slate-400">加载中…</main>;

  const doneCount = marks.filter((_, i) => states[i]?.done).length;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  marks.forEach((m, i) => {
    if (m.start > cursor) nodes.push(<span key={`t${i}`}>{p.body.slice(cursor, m.start)}</span>);
    const word = p.body.slice(m.start, m.end);
    const st = states[i] ?? { wrong: 0, tips: 0, revealed: false, done: false };
    const shown = Math.min(1 + st.tips, word.length); // 首字母 + 提示字母数
    const prefix = word.slice(0, shown);
    const suffix = word.length >= 3 ? word.slice(-1) : "";
    const inputLen = Math.max(1, word.length - shown - (word.length >= 3 ? 1 : 0));

    if (st.done || st.revealed) {
      nodes.push(
        <span key={`m${i}`} className={`mx-0.5 rounded px-1 font-semibold ${st.revealed && !st.done ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"}`}>
          {word}
        </span>
      );
    } else {
      nodes.push(
        <span key={`m${i}`} className="mx-0.5 inline-flex items-center gap-0.5 align-baseline">
          <span className="font-mono text-primary-600 dark:text-primary-300">{prefix}</span>
          <input
            data-slot={i}
            value={values[i] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [i]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit(i);
              }
            }}
            size={Math.max(2, inputLen)}
            autoFocus={i === 0}
            autoComplete="off"
            spellCheck={false}
            className={`rounded border-b-2 bg-transparent px-1 text-center font-mono outline-none transition-colors ${
              shake === i ? "border-red-400" : "border-primary-400 focus:border-primary-600"
            }`}
            style={{ width: `${Math.max(2, inputLen)}ch` }}
          />
          {suffix ? <span className="font-mono text-primary-600 dark:text-primary-300">{suffix}</span> : null}
          {st.wrong >= 2 ? (
            <span className="ml-1 inline-flex gap-1">
              <button
                onClick={() => setStates((s) => ({ ...s, [i]: { ...s[i], tips: Math.min(s[i].tips + 1, Math.max(0, word.length - 2)) } }))}
                className="rounded bg-amber-100 px-1.5 text-[10px] text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300"
              >
                💡提示
              </button>
              <button
                onClick={() => setStates((s) => ({ ...s, [i]: { ...s[i], revealed: true } }))}
                className="rounded bg-red-100 px-1.5 text-[10px] text-red-600 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
              >
                整词提醒
              </button>
            </span>
          ) : null}
        </span>
      );
    }
    cursor = m.end;
  });
  if (cursor < p.body.length) nodes.push(<span key="tail">{p.body.slice(cursor)}</span>);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="truncate text-xl font-bold">{p.title} · 填空背诵</h1>
        <Link href={`/passages/${id}`} className="shrink-0 text-xs text-slate-400 hover:text-slate-600">退出</Link>
      </div>

      <p className="mt-2 text-xs text-slate-400">键入挖空内容后回车 · 错 2 次会出现提示按钮 · 已完成 {doneCount}/{marks.length}</p>

      {allDone ? (
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
          <p className="text-3xl">🎉</p>
          <p className="mt-2 font-semibold">全部完成！{marks.length} 个空都过了</p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => {
                const init: Record<number, MarkState> = {};
                marks.forEach((_, i) => (init[i] = { wrong: 0, tips: 0, revealed: false, done: false }));
                setStates(init);
                setValues({});
                setFinished(false);
              }}
              className="rounded-xl bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              再来一遍
            </button>
            <Link href="/passages" className="rounded-xl border border-slate-200 px-5 py-2 text-sm dark:border-slate-600">返回列表</Link>
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-8 dark:border-slate-700 dark:bg-slate-900">{nodes}</div>
    </main>
  );
}
