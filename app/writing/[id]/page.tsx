/** 作文结果页：原文+错误高亮 + AI批改按钮 + 四标准打分 */
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface FeedbackItem { orig: string; fixed: string; type: string; note: string }
interface Scores { task_response: number; coherence: number; lexical: number; grammar: number; overall: number; comment: string }
interface Essay {
  title: string;
  prompt_text: string;
  content: string;
  seconds: number;
  created_at: string;
  feedback: FeedbackItem[] | null;
  scores: Scores | null;
}

const TYPE_LABEL: Record<string, string> = { grammar: "语法", spelling: "拼写", punctuation: "标点" };

export default function EssayPage() {
  const { id } = useParams<{ id: string }>();
  const [essay, setEssay] = useState<Essay | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    const j = await (await fetch(`/api/essays?id=${id}`)).json();
    if (j.ok) setEssay(j.essay);
    else setErr(j.error);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function grade() {
    setBusy("AI 正在逐句批改（约 10~30 秒）…");
    setErr("");
    const j = await (await fetch("/api/writing/grade", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ essayId: id }) })).json();
    setBusy("");
    if (j.ok) setEssay((e) => (e ? { ...e, feedback: j.feedback } : e));
    else setErr(j.error);
  }

  async function score() {
    setBusy("AI 考官正在按四项标准打分…");
    setErr("");
    const j = await (await fetch("/api/writing/score", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ essayId: id }) })).json();
    setBusy("");
    if (j.ok) setEssay((e) => (e ? { ...e, scores: j.scores } : e));
    else setErr(j.error);
  }

  if (err && !essay) return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-red-500">{err}</main>;
  if (!essay) return <main className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-slate-400">加载中…</main>;

  const fb = essay.feedback ?? [];
  const sc = essay.scores;

  /** 把 feedback 的 orig 片段在原文中高亮 */
  function renderContent() {
    let text = essay!.content;
    const nodes: React.ReactNode[] = [];
    let last = 0;
    let key = 0;
    for (const f of fb) {
      const at = text.indexOf(f.orig, last);
      if (at === -1) continue;
      if (at > last) nodes.push(<span key={key++}>{text.slice(last, at)}</span>);
      nodes.push(
        <mark key={key++} title={`${TYPE_LABEL[f.type] ?? f.type}：${f.note} → ${f.fixed}`} className={`rounded px-0.5 ${f.type === "grammar" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : f.type === "spelling" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"}`}>
          {f.orig}
        </mark>
      );
      last = at + f.orig.length;
    }
    nodes.push(<span key={key++}>{text.slice(last)}</span>);
    return nodes;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{essay.title || "写作练习"}</h1>
          <p className="mt-1 text-xs text-slate-400">{new Date(essay.created_at).toLocaleString("zh-CN")} · 用时 {Math.round(essay.seconds / 60)} 分钟</p>
        </div>
        <Link href="/writing" className="shrink-0 text-xs text-slate-400 hover:text-slate-600">← 返回</Link>
      </div>

      {essay.prompt_text ? (
        <div className="mt-4 rounded-xl bg-slate-100 p-4 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <span className="font-semibold">题目：</span>
          {essay.prompt_text}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={grade} disabled={!!busy} className="rounded-xl bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">🪄 AI 批改（错词/标点/语法）</button>
        <button onClick={score} disabled={!!busy} className="rounded-xl bg-amber-500 px-5 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50">🎯 AI 四标准打分</button>
        {busy ? <span className="self-center text-xs text-primary-600">{busy}</span> : null}
        {err ? <span className="self-center text-xs text-red-500">{err}</span> : null}
      </div>

      {sc ? (
        <div className="mt-5 rounded-2xl border border-primary-200 bg-primary-50/60 p-5 dark:border-primary-800 dark:bg-primary-900/20">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary-700 dark:text-primary-300">{sc.overall}</p>
              <p className="text-[10px] text-slate-400">总分</p>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {[["任务回应", sc.task_response], ["连贯衔接", sc.coherence], ["词汇", sc.lexical], ["语法", sc.grammar]].map(([k, v]) => (
                <div key={k as string} className="rounded-lg bg-white p-2 text-center dark:bg-slate-900">
                  <p className="text-lg font-bold text-primary-600 dark:text-primary-300">{v as number}</p>
                  <p className="text-[10px] text-slate-400">{k as string}</p>
                </div>
              ))}
            </div>
          </div>
          {sc.comment ? <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">考官总评：{sc.comment}</p> : null}
        </div>
      ) : null}

      {fb.length ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold">批改结果（{fb.length} 处）</p>
          <div className="mt-3 space-y-2 text-xs">
            {fb.map((f, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] dark:bg-slate-700">{TYPE_LABEL[f.type] ?? f.type}</span>
                <span className="font-mono text-red-500 line-through">{f.orig}</span>
                <span className="text-slate-400">→</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">{f.fixed}</span>
                <span className="text-slate-400">{f.note}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-7 dark:border-slate-700 dark:bg-slate-900">
        {renderContent()}
      </div>
    </main>
  );
}
