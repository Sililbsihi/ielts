/** 计时写作页：脑暴草稿 + 50 分钟倒计时（刷新不丢，localStorage 存开始时间） */
"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const TOTAL = 50 * 60; // 50 分钟
const LS_KEY = "ielts_practice_started";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const promptId = params.get("prompt") || "";
  const [promptText, setPromptText] = useState("");
  const [custom, setCustom] = useState("");
  const [brainstorm, setBrainstorm] = useState("");
  const [content, setContent] = useState("");
  const [left, setLeft] = useState(TOTAL);
  const [started, setStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const submittedRef = useRef(false);
  const contentRef = useRef("");
  contentRef.current = content;

  useEffect(() => {
    if (promptId) {
      fetch("/api/prompts")
        .then((r) => r.json())
        .then((j) => {
          if (j.ok) setPromptText(j.prompts.find((p: { id: string }) => p.id === promptId)?.content ?? "");
        });
    }
  }, [promptId]);

  useEffect(() => {
    if (!started) return;
    const saved = Number(localStorage.getItem(LS_KEY) || 0);
    const base = saved && Date.now() - saved < TOTAL * 1000 ? saved : Date.now();
    localStorage.setItem(LS_KEY, String(base));
    const t = setInterval(() => {
      const remain = TOTAL - Math.floor((Date.now() - base) / 1000);
      setLeft(Math.max(0, remain));
      if (remain <= 0 && !submittedRef.current) {
        clearInterval(t);
        doSubmit(true);
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  async function doSubmit(auto = false) {
    if (submittedRef.current) return;
    if (!auto && !confirm("确定提前交卷？")) return;
    submittedRef.current = true;
    setSubmitting(true);
    localStorage.removeItem(LS_KEY);
    const used = TOTAL - left;
    try {
      const res = await fetch("/api/essays", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt_id: promptId || null,
          prompt_text: promptText || custom,
          title: `${new Date().toLocaleDateString("zh-CN")} ${auto ? "自动交卷" : "练习"}`,
          brainstorm,
          content,
          seconds: used || TOTAL,
        }),
      });
      const json = await res.json();
      if (json.ok) router.push(`/writing/${json.id}`);
      else {
        setErr(json.error || "保存失败");
        setSubmitting(false);
        submittedRef.current = false;
      }
    } catch {
      setErr("网络异常，作文内容未丢失，请重试交卷");
      setSubmitting(false);
      submittedRef.current = false;
    }
  }

  const mm = pad(Math.floor(left / 60));
  const ss = pad(left % 60);
  const urgent = left < 5 * 60;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* 题目 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-relaxed dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-semibold text-primary-600 dark:text-primary-300">题目</p>
        {promptText ? (
          <p className="mt-2 whitespace-pre-wrap">{promptText}</p>
        ) : (
          <textarea value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="粘贴/输入今天的写作题目…" rows={3} className="mt-2 w-full rounded-lg border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-800" />
        )}
      </div>

      {/* 脑暴 */}
      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">脑暴区（结构 / 观点 / 展开思路，不参与批改）</p>
        <textarea value={brainstorm} onChange={(e) => setBrainstorm(e.target.value)} rows={4} placeholder="开头立场 → 主体段1观点+例子 → 主体段2观点+例子 → 结尾…" className="mt-2 w-full rounded-lg border border-amber-200 bg-white/70 p-3 text-sm dark:border-amber-800 dark:bg-slate-900" />
      </div>

      {/* 计时 + 写作 */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">正式写作</p>
          <p className={`font-mono text-3xl font-bold tabular-nums ${urgent ? "text-red-500" : "text-primary-600 dark:text-primary-300"}`}>
            {started ? `${mm}:${ss}` : "50:00"}
          </p>
        </div>
        {!started ? (
          <button
            onClick={() => setStarted(true)}
            className="mt-4 w-full rounded-xl bg-primary-600 py-3 text-sm font-medium text-white hover:bg-primary-700"
          >
            ▶ 开始 50 分钟计时
          </button>
        ) : (
          <>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={16}
              autoFocus
              placeholder="开始写作…（每 60 秒自动保存到浏览器，到时自动交卷）"
              className="mt-3 w-full rounded-xl border border-slate-300 p-4 text-sm leading-7 dark:border-slate-600 dark:bg-slate-800"
            />
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
              <span>{content.trim() ? `${content.trim().split(/\s+/).length} 词` : "0 词"}</span>
              <button onClick={() => doSubmit(false)} disabled={submitting} className="rounded-xl bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                {submitting ? "交卷中…" : "交卷并批改"}
              </button>
            </div>
          </>
        )}
        {err ? <p className="mt-2 text-xs text-red-500">{err}</p> : null}
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">
        <Link href="/writing" className="hover:text-slate-600">← 返回题库</Link>
      </p>
    </main>
  );
}

export default function PracticePage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
