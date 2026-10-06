/**
 * 抄写背诵引擎 v2：
 * - 进来先见"选词面板"：统计（共/已背/未背/难词），默认只背未背，可全选、可手选
 * - 列表里每词显示 已背✓ / 未背 / 难词⭐，一目了然
 * - 背完一词立即持久化"已背"（数据库，未建列则存浏览器）
 * - 背诵中可一键标记/取消难词 ⭐
 * - ≤5 字母抄 2 遍；≥5 字母与短语抄 3 遍；一遍有错清空重抄
 * - 单词下方显示美式音标（服务端代理查询 + 本地缓存）
 */
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface W {
  id: string;
  word: string;
  meaning: string;
  is_phrase: boolean;
  err_count: number;
  starred?: boolean | null;
  recited?: boolean | null;
}

function requiredReps(w: { word: string; is_phrase: boolean }): number {
  return w.is_phrase || w.word.trim().length >= 5 ? 3 : 2;
}

type Mode = "unrecited" | "all" | "starred" | "custom";

export default function RecitePage() {
  const { id } = useParams<{ id: string }>();
  const [words, setWords] = useState<W[] | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<Mode>("unrecited");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [queue, setQueue] = useState<W[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [rep, setRep] = useState(0);
  const [input, setInput] = useState("");
  const [wrong, setWrong] = useState(false);
  const [errIds, setErrIds] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);
  const [ph, setPh] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/words?listId=${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) { setWords(j.words); setDegraded(!!j.degraded); }
        else setErr(j.error || "加载失败");
      })
      .catch(() => setErr("网络异常"));
  }, [id]);

  // —— 本地兜底存储（数据库缺列时用） ——
  function localGet(key: "rec" | "star"): Record<string, boolean> {
    try { return JSON.parse(window.localStorage.getItem(`${key}:${id}`) || "{}"); } catch { return {}; }
  }
  function localSet(key: "rec" | "star", map: Record<string, boolean>) {
    try { window.localStorage.setItem(`${key}:${id}`, JSON.stringify(map)); } catch {}
  }
  function isRecited(w: W): boolean { return !!(w.recited || localGet("rec")[w.id]); }
  function isStarred(w: W): boolean { return !!(w.starred || localGet("star")[w.id]); }

  async function markRecited(w: W) {
    setWords((ws) => (ws ?? []).map((x) => (x.id === w.id ? { ...x, recited: true } : x)));
    const r = await fetch("/api/words", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: w.id, recited: true }) }).catch(() => null);
    if (degraded || !r || !r.ok) { const m = localGet("rec"); m[w.id] = true; localSet("rec", m); }
  }
  async function toggleStar(w: W) {
    const next = !isStarred(w);
    setWords((ws) => (ws ?? []).map((x) => (x.id === w.id ? { ...x, starred: next } : x)));
    const r = await fetch("/api/words", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: w.id, starred: next }) }).catch(() => null);
    if (degraded || !r || !r.ok) { const m = localGet("star"); m[w.id] = next; localSet("star", m); }
  }

  const stats = useMemo(() => {
    const ws = words ?? [];
    return {
      total: ws.length,
      recited: ws.filter(isRecited).length,
      starred: ws.filter(isStarred).length,
      unrecited: ws.filter((w) => !isRecited(w)).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words]);

  function start() {
    let q: W[];
    if (mode === "custom") q = (words ?? []).filter((w) => picked.has(w.id));
    else if (mode === "all") q = words ?? [];
    else if (mode === "starred") q = (words ?? []).filter(isStarred);
    else q = (words ?? []).filter((w) => !isRecited(w));
    if (!q.length) return;
    setQueue(q); setIdx(0); setRep(0); setInput(""); setWrong(false);
    setErrIds(new Set()); setFinished(false);
  }

  const cur = queue?.[idx];
  const need = cur ? requiredReps(cur) : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cur) return;
    const ok = input.trim().toLowerCase() === cur.word.trim().toLowerCase();
    if (!ok) { setWrong(true); setInput(""); setErrIds((s) => new Set(s).add(cur.id)); return; }
    setWrong(false); setInput("");
    const nextRep = rep + 1;
    if (nextRep >= need) {
      void markRecited(cur);
      const nextIdx = idx + 1;
      if (nextIdx >= queue!.length) setFinished(true);
      else { setIdx(nextIdx); setRep(0); }
    } else setRep(nextRep);
  }

  // —— 音标：当前词自动查询（服务端代理 + 本地缓存） ——
  useEffect(() => {
    if (!cur?.word) return;
    const key = cur.word.trim().toLowerCase();
    if (ph[key]) return;
    try {
      const cached = window.localStorage.getItem(`ph:${key}`);
      if (cached) { setPh((m) => (m[key] ? m : { ...m, [key]: cached })); return; }
      if (window.localStorage.getItem(`phmiss2:${key}`)) return;
    } catch { /* ignore */ }
    let dead = false;
    void (async () => {
      try {
        const r = await fetch(`/api/phonetic?w=${encodeURIComponent(key)}`);
        if (!r.ok) throw new Error("miss");
        const j = await r.json();
        const clean: string = j?.phonetic || "";
        if (!clean) throw new Error("empty");
        if (dead) return;
        try { window.localStorage.setItem(`ph:${key}`, clean); } catch {}
        setPh((m) => ({ ...m, [key]: clean }));
      } catch {
        try { window.localStorage.setItem(`phmiss2:${key}`, "1"); } catch {}
      }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.word]);

  if (err) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-red-500">{err}</main>;
  }
  if (!words) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-slate-400">加载中…</main>;
  }
  if (!words.length) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-sm text-slate-400">这个词表还没有单词</p>
        <Link href={`/words/${id}?add=1`} className="mt-3 inline-block rounded-xl bg-primary-600 px-5 py-2 text-sm text-white">去加词</Link>
      </main>
    );
  }

  // ============ 选词面板 ============
  if (!queue) {
    const MODES: Array<{ k: Mode; label: string; hint: string }> = [
      { k: "unrecited", label: "未背过", hint: `默认推荐 · ${stats.unrecited} 词` },
      { k: "all", label: "全部", hint: `${stats.total} 词` },
      { k: "starred", label: "难词 ⭐", hint: `${stats.starred} 词` },
      { k: "custom", label: "手选", hint: `已勾 ${picked.size} 词` },
    ];
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <Link href={`/words/${id}`} className="hover:text-primary-600">← 词表</Link>
          {degraded ? <span className="text-amber-500">（数据库未加列，进度存本设备浏览器）</span> : null}
        </div>
        <h1 className="mt-3 text-xl font-bold">选择要背的单词</h1>
        <p className="mt-1 text-xs text-slate-400">共 {stats.total} 词 · 已背 {stats.recited} · 未背 {stats.unrecited} · 难词 {stats.starred}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MODES.map((m) => (
            <button
              key={m.k}
              onClick={() => setMode(m.k)}
              className={`rounded-2xl border-2 px-3 py-2.5 text-left transition-colors ${mode === m.k ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" : "border-slate-200 dark:border-slate-700"}`}
            >
              <span className="block text-sm font-medium">{m.label}</span>
              <span className="block text-[11px] text-slate-400">{m.hint}</span>
            </button>
          ))}
        </div>

        {mode === "custom" ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">点行勾选/取消</span>
              <span className="flex gap-2">
                <button onClick={() => setPicked(new Set(words.map((w) => w.id)))} className="text-primary-600">全选</button>
                <button onClick={() => setPicked(new Set())} className="text-slate-400">清空</button>
                <button onClick={() => setPicked(new Set(words.filter((w) => !isRecited(w)).map((w) => w.id)))} className="text-amber-600">勾未背</button>
                <button onClick={() => setPicked(new Set(words.filter(isStarred).map((w) => w.id)))} className="text-red-400">勾难词</button>
              </span>
            </div>
            <div className="mt-2 max-h-[50vh] divide-y overflow-y-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
              {words.map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    const next = new Set(picked);
                    picked.has(w.id) ? next.delete(w.id) : next.add(w.id);
                    setPicked(next);
                  }}
                  className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm ${picked.has(w.id) ? "bg-primary-50 dark:bg-primary-900/20" : ""} ${isStarred(w) ? "border-l-4 border-amber-400" : ""}`}
                >
                  <span className={`w-4 text-center ${picked.has(w.id) ? "text-primary-600" : "text-slate-300"}`}>{picked.has(w.id) ? "✓" : ""}</span>
                  <span className="w-36 shrink-0 truncate font-medium">{w.word}</span>
                  <span className="flex-1 truncate text-xs text-slate-400">{w.meaning}</span>
                  {isRecited(w) ? <span className="shrink-0 text-[11px] text-green-600">✓已背</span> : <span className="shrink-0 text-[11px] text-slate-300">未背</span>}
                  {isStarred(w) ? <span className="shrink-0 text-[11px]">⭐</span> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            {mode === "custom" ? `将背 ${picked.size} 词` : mode === "unrecited" ? `将背未背的 ${stats.unrecited} 词` : mode === "starred" ? `将背难词 ${stats.starred} 词` : `将背全部 ${stats.total} 词`}
          </p>
          <button onClick={start} className="rounded-xl bg-primary-600 px-8 py-3 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-40" disabled={mode === "custom" ? !picked.size : mode === "starred" ? !stats.starred : mode === "unrecited" ? !stats.unrecited : false}>
            开始背诵 →
          </button>
        </div>
      </main>
    );
  }

  // ============ 完成小结 ============
  if (finished) {
    const wrongArr = [...errIds];
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-5xl">🎉</p>
        <h1 className="mt-4 text-xl font-bold">本轮完成！共 {queue.length} 词</h1>
        {wrongArr.length ? (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">本轮有 {wrongArr.length} 个词出过错，建议加练一轮</p>
        ) : (
          <p className="mt-2 text-sm text-slate-400">零失误，漂亮！</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          {wrongArr.length ? (
            <button
              onClick={() => { setQueue(queue.filter((w) => wrongArr.includes(w.id))); setIdx(0); setRep(0); setFinished(false); setErrIds(new Set()); }}
              className="rounded-xl border border-amber-400 px-5 py-2.5 text-sm text-amber-600 dark:border-amber-500"
            >
              只练错词（{wrongArr.length}）
            </button>
          ) : null}
          <button onClick={() => { setQueue(null); setPicked(new Set()); }} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm dark:border-slate-600">重新选词</button>
          <Link href={`/words/${id}`} className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white">返回词表</Link>
        </div>
      </main>
    );
  }

  if (!cur) return null;

  // ============ 背诵中 ============
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col px-4 py-10">
      {/* 进度 */}
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <Link href={`/words/${id}`} className="hover:text-primary-600">← 退出（已背的会记住）</Link>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-full bg-primary-500 transition-all" style={{ width: `${(idx / queue.length) * 100}%` }} />
        </div>
        <span>{idx + 1} / {queue.length}</span>
      </div>

      {/* 单词区 */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p className="text-5xl font-bold tracking-wide text-slate-900 dark:text-white sm:text-6xl">{cur.word}</p>
        {ph[cur.word.trim().toLowerCase()] ? (
          <p className="mt-3 text-base font-medium tracking-[0.03em] text-primary-600/90 dark:text-primary-400/90">
            /{ph[cur.word.trim().toLowerCase()]}/
          </p>
        ) : null}
        {cur.meaning ? <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">{cur.meaning}</p> : null}
        {cur.is_phrase ? <span className="mt-3 rounded-full bg-slate-100 px-3 py-0.5 text-xs text-slate-400 dark:bg-slate-800">短语</span> : null}
        <button
          onClick={() => void toggleStar(cur)}
          className={`mt-5 rounded-full px-4 py-1.5 text-xs transition-colors ${isStarred(cur) ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" : "bg-slate-100 text-slate-400 hover:text-amber-600 dark:bg-slate-800"}`}
        >
          {isStarred(cur) ? "⭐ 已标为难词（点击取消）" : "☆ 标记为难记单词"}
        </button>
      </div>

      {/* 输入区 */}
      <form onSubmit={submit} className="space-y-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={`第 ${rep + 1}/${need} 遍 · 抄写后回车`}
          className={`w-full rounded-2xl border-2 px-5 py-4 text-center text-xl outline-none transition-colors dark:bg-slate-900 ${
            wrong ? "animate-pulse border-red-400" : "border-slate-200 focus:border-primary-500 dark:border-slate-700"
          }`}
        />
        <div className="flex items-center justify-between text-xs">
          <span className={wrong ? "text-red-500" : "text-transparent"}>{wrong ? "这一遍有错，重新抄写本遍" : "占位"}</span>
          <span className="text-slate-400">回车提交 · 共 {need} 遍</span>
        </div>
      </form>
    </main>
  );
}
