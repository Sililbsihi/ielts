/**
 * 抄写背诵引擎：
 * - 屏幕显示单词（居中大字）+ 释义（下方小字）
 * - ≤5 字母抄 2 遍；≥5 字母与所有短语抄 3 遍
 * - 一遍内有错 → 清空重抄这一遍
 * - 结束出小结；可"只练错词"再来一轮
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
}

function requiredReps(w: { word: string; is_phrase: boolean }): number {
  return w.is_phrase || w.word.trim().length >= 5 ? 3 : 2;
}

export default function RecitePage() {
  const { id } = useParams<{ id: string }>();
  const [words, setWords] = useState<W[] | null>(null);
  const [err, setErr] = useState("");
  const [idx, setIdx] = useState(0);
  const [rep, setRep] = useState(0);
  const [input, setInput] = useState("");
  const [wrong, setWrong] = useState(false);
  const [errIds, setErrIds] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);
  const [onlyWrong, setOnlyWrong] = useState(false);
  // 音标缓存：word -> 美式 IPA（不含斜杠）；localStorage 持久
  const [ph, setPh] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/words?listId=${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setWords(j.words);
        else setErr(j.error || "加载失败");
      })
      .catch(() => setErr("网络异常"));
  }, [id]);

  const list = useMemo(() => (words ?? []).filter((w) => (!onlyWrong || errIds.has(w.id))), [words, onlyWrong, errIds]);
  const cur = list?.[idx];
  const need = cur ? requiredReps(cur) : 0;

  useEffect(() => {
    if (!cur?.word) return;
    const key = cur.word.trim().toLowerCase();
    if (ph[key]) return;
    try {
      const cached = window.localStorage.getItem(`ph:${key}`);
      if (cached) { setPh((m) => (m[key] ? m : { ...m, [key]: cached })); return; }
      if (window.localStorage.getItem(`phmiss:${key}`)) return;
    } catch { /* localStorage 不可用则直接查 */ }
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
        try { window.localStorage.setItem(`phmiss:${key}`, "1"); } catch {}
      }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.word]);


  async function flushErrors() {
    if (!errIds.size) return;
    for (const wid of errIds) {
      fetch("/api/words", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: wid, err_delta: 1 }),
      }).catch(() => {});
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cur) return;
    const ok = input.trim().toLowerCase() === cur.word.trim().toLowerCase();
    if (!ok) {
      setWrong(true);
      setInput("");
      setErrIds((s) => new Set(s).add(cur.id));
      return;
    }
    setWrong(false);
    setInput("");
    const nextRep = rep + 1;
    if (nextRep >= need) {
      const nextIdx = idx + 1;
      if (nextIdx >= list.length) {
        setFinished(true);
        flushErrors();
      } else {
        setIdx(nextIdx);
        setRep(0);
      }
    } else {
      setRep(nextRep);
    }
  }

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

  if (finished) {
    const wrongArr = [...errIds];
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-5xl">🎉</p>
        <h1 className="mt-4 text-xl font-bold">本轮完成！共 {list.length} 词</h1>
        {wrongArr.length ? (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">本轮有 {wrongArr.length} 个词出过错，建议加练一轮</p>
        ) : (
          <p className="mt-2 text-sm text-slate-400">零失误，漂亮！</p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          {wrongArr.length ? (
            <button
              onClick={() => {
                setOnlyWrong(true);
                setIdx(0);
                setRep(0);
                setFinished(false);
              }}
              className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-600"
            >
              只练错词（{wrongArr.length}）
            </button>
          ) : null}
          <button
            onClick={() => {
              setOnlyWrong(false);
              setIdx(0);
              setRep(0);
              setErrIds(new Set());
              setFinished(false);
            }}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm dark:border-slate-600"
          >
            整表再来
          </button>
          <Link href={`/words/${id}`} className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white">返回词表</Link>
        </div>
      </main>
    );
  }

  if (!cur) return null;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col px-4 py-10">
      {/* 进度 */}
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <Link href={`/words/${id}`} className="hover:text-primary-600">← 退出</Link>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-full bg-primary-500 transition-all" style={{ width: `${(idx / list.length) * 100}%` }} />
        </div>
        <span>{idx + 1} / {list.length}</span>
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
