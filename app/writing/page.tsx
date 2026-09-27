/** 板块3首页：题库管理（PDF导入/手动添加/每日选题）+ 作文历史 */
"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { extractTextFromFile } from "@/lib/wordparse";

interface Prompt { id: string; content: string; kind: string }
interface EssayRow { id: string; title: string; prompt_text: string; created_at: string; seconds: number; scores: { overall?: number } | null }

function todayIndex(n: number): number {
  const d = new Date();
  const dayNum = Math.floor(d.getTime() / 86400000);
  return n ? dayNum % n : 0;
}

export default function WritingPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [prompts, setPrompts] = useState<Prompt[] | null>(null);
  const [essays, setEssays] = useState<EssayRow[]>([]);
  const [extracted, setExtracted] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [manual, setManual] = useState("");
  const [tab, setTab] = useState<"library" | "essays">("library");

  async function load() {
    const [pr, es] = await Promise.all([fetch("/api/prompts"), fetch("/api/essays")]);
    const pj = await pr.json();
    const ej = await es.json();
    if (pj.ok) setPrompts(pj.prompts);
    else setErr(pj.error);
    if (ej.ok) setEssays(ej.essays);
  }
  useEffect(() => {
    load();
  }, []);

  async function handlePdf(file: File) {
    setBusy(`正在抽取 ${file.name} 的文字…`);
    setErr("");
    try {
      const text = await extractTextFromFile(file);
      // 启发式切题：按 "Writing Task x" 或 行首编号 切分
      const parts = text
        .split(/(?=(?:^|\n)\s*(?:Writing Task\s*\d|(?:\d{1,3})[.、]))/i)
        .map((s) => s.trim())
        .filter((s) => s.length > 40);
      setExtracted(parts.length ? parts.join("\n=====\n") : text);
      setBusy("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "抽取失败");
      setBusy("");
    }
  }

  async function saveExtracted() {
    const items = extracted
      .split(/\n=====|\n-{3,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 30)
      .map((s) => ({ content: s, kind: /task\s*1/i.test(s.slice(0, 60)) ? "task1" : "task2" }));
    if (!items.length) return setErr("没有识别到可入库的题目（每题需超过 30 字，用 ===== 分隔可手动切题）");
    setBusy("入库中…");
    const res = await fetch("/api/prompts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items }) });
    const json = await res.json();
    setBusy("");
    if (json.ok) {
      setExtracted("");
      load();
    } else setErr(json.error);
  }

  async function saveManual() {
    if (manual.trim().length < 10) return setErr("题目太短");
    await fetch("/api/prompts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: [{ content: manual.trim(), kind: /task\s*1/i.test(manual.slice(0, 60)) ? "task1" : "task2" }] }) });
    setManual("");
    load();
  }

  async function removePrompt(id: string) {
    if (!confirm("删除这道题？")) return;
    await fetch(`/api/prompts?id=${id}`, { method: "DELETE" });
    load();
  }

  const daily = prompts && prompts.length ? prompts[todayIndex(prompts.length)] : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">③ 写作演练</h1>

      {/* 今日一题 */}
      {daily ? (
        <div className="mt-6 rounded-2xl border-2 border-primary-200 bg-primary-50/60 p-5 dark:border-primary-800 dark:bg-primary-900/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300">今日一题（随机轮换）</p>
            <Link href={`/writing/practice?prompt=${daily.id}`} className="rounded-xl bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700">开始脑暴+演练</Link>
          </div>
          <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">{daily.content}</p>
        </div>
      ) : null}

      <div className="mt-6 flex gap-2">
        <button onClick={() => setTab("library")} className={`rounded-lg px-4 py-1.5 text-sm ${tab === "library" ? "bg-primary-600 text-white" : "border border-slate-200 dark:border-slate-600"}`}>题库（{prompts?.length ?? 0}）</button>
        <button onClick={() => setTab("essays")} className={`rounded-lg px-4 py-1.5 text-sm ${tab === "essays" ? "bg-primary-600 text-white" : "border border-slate-200 dark:border-slate-600"}`}>我的作文（{essays.length}）</button>
      </div>

      {tab === "library" ? (
        <div className="mt-4 space-y-4">
          <input ref={fileRef} type="file" accept=".pdf,.txt,.md,.docx" className="hidden" onChange={(e) => e.target.files?.[0] && handlePdf(e.target.files[0])} />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => fileRef.current?.click()} className="rounded-xl border-2 border-dashed border-slate-300 px-5 py-3 text-sm text-slate-500 hover:border-primary-400 dark:border-slate-600">📎 上传历年题目 PDF/TXT（抽取文字，不保存源文件）</button>
            {busy ? <span className="self-center text-xs text-primary-600">{busy}</span> : null}
          </div>

          {extracted ? (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-xs text-slate-400">已按编号/Writing Task 切分，用 ===== 分隔的每段将作为一道题入库；可手动编辑切分。</p>
              <textarea value={extracted} onChange={(e) => setExtracted(e.target.value)} rows={10} className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-xs dark:border-slate-600 dark:bg-slate-800" />
              <button onClick={saveExtracted} className="mt-2 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white">全部入库</button>
            </div>
          ) : null}

          <div className="flex gap-2">
            <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="或手动粘贴一道题…" className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm dark:border-slate-600 dark:bg-slate-800" />
            <button onClick={saveManual} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white">添加</button>
          </div>

          <div className="space-y-2">
            {(prompts ?? []).map((p, i) => (
              <div key={p.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">{p.kind}</span>
                <p className="line-clamp-2 min-w-0 flex-1 text-slate-700 dark:text-slate-200">{p.content}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <Link href={`/writing/practice?prompt=${p.id}`} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs text-white">练</Link>
                  <button onClick={() => removePrompt(p.id)} className="text-xs text-red-300 hover:text-red-500">删</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {!essays.length ? <p className="py-10 text-center text-sm text-slate-400">还没有写过的作文</p> : null}
          {essays.map((e) => (
            <Link key={e.id} href={`/writing/${e.id}`} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 text-sm hover:border-primary-300 dark:border-slate-700 dark:bg-slate-900">
              <div className="min-w-0">
                <p className="truncate font-medium">{e.title || e.prompt_text.slice(0, 40) || "未命名作文"}</p>
                <p className="text-xs text-slate-400">{new Date(e.created_at).toLocaleString("zh-CN")} · 用时 {Math.round(e.seconds / 60)} 分钟</p>
              </div>
              {e.scores?.overall ? <span className="shrink-0 rounded-lg bg-primary-100 px-3 py-1 text-sm font-bold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">{e.scores.overall} 分</span> : <span className="shrink-0 text-xs text-slate-400">未打分</span>}
            </Link>
          ))}
        </div>
      )}

      {err ? <p className="mt-4 text-sm text-red-500">{err}</p> : null}
    </main>
  );
}
