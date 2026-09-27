/**
 * 导入向导（新建/加词共用）：
 * 步骤1 选模式+上传（多文件顺序抽取，可粘贴文本）
 * 步骤2 筛选选择（分页/搜索/全选）
 * 步骤3 命名 → 入库（分批500）→ 批量配释义（每批60，进度可续跑）
 */
"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractTextFromFile, parseWordList, tokenizeProse, normWord, type ParsedWord } from "@/lib/wordparse";

type Step = 1 | 2 | 3;

export default function WordImport({ appendListId, appendListName }: { appendListId?: string; appendListName?: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(1);
  const [mode, setMode] = useState<"list" | "prose">("list");
  const [rawText, setRawText] = useState("");
  const [paste, setPaste] = useState("");
  const [busyMsg, setBusyMsg] = useState("");
  const [parsed, setParsed] = useState<ParsedWord[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set()); // norm
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");
  const [withMeaning, setWithMeaning] = useState(false); // 默认展示全部词
  const [listName, setListName] = useState(appendListName ?? "");
  const [importMsg, setImportMsg] = useState("");
  const [fillError, setFillError] = useState("");
  const [busy, setBusy] = useState(false);
  const PER = 100;

  /** 剪贴板粘贴：图片走 OCR，文本进粘贴框 */
  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.files;
    if (items && items.length > 0) {
      e.preventDefault();
      handleFiles(items);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    let all = "";
    try {
      for (let i = 0; i < files.length; i++) {
        setBusyMsg(`抽取 ${files[i].name}（${i + 1}/${files.length}）…`);
        const text = await extractTextFromFile(files[i], (msg) => setBusyMsg(`${files[i].name}：${msg}`));
        all += "\n" + text;
      }
      setRawText(all);
      setBusyMsg("");
      doParse(all);
    } catch (e) {
      setBusyMsg("");
      alert("抽取失败：" + (e instanceof Error ? e.message : String(e)));
    }
  }

  function doParse(text: string) {
    const words = mode === "list" ? parseWordList(text) : tokenizeProse(text);
    if (!words.length) {
      alert("没有识别到英文单词。若是图片，请确认照片清晰；或换用文档/直接粘贴文本。");
      return;
    }
    setParsed(words);
    setPicked(new Set(words.map((w) => normWord(w.word))));
    setPage(0);
    setStep(2);
  }

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return parsed.filter((w) => (!f || w.word.toLowerCase().includes(f)) && (!withMeaning || w.meaning));
  }, [parsed, filter, withMeaning]);

  const pageItems = filtered.slice(page * PER, page * PER + PER);
  const pickedCount = picked.size;

  async function ensureListId(): Promise<string> {
    if (appendListId) return appendListId;
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: listName.trim() }),
    });
    const json = await res.json();
    if (json.ok) return json.list.id;
    if ((json.error || "").includes("duplicate") || (json.error || "").includes("unique")) {
      const r2 = await fetch("/api/lists");
      const j2 = await r2.json();
      const found = (j2.lists ?? []).find((l: { name: string }) => l.name === listName.trim());
      if (found) return found.id;
    }
    throw new Error(json.error || "建表失败");
  }

  async function doImport() {
    if (!listName.trim() && !appendListId) {
      alert("先给本次词表起个名字");
      return;
    }
    setBusy(true);
    try {
      setImportMsg("入库中…");
      const listId = await ensureListId();
      const items = parsed.filter((w) => picked.has(normWord(w.word)));
      const basePos = appendListId ? Date.now() % 1000000000 : 0; // 加词时排在后面
      for (let i = 0; i < items.length; i += 500) {
        setImportMsg(`入库 ${Math.min(i + 500, items.length)}/${items.length}…`);
        const rows = items.slice(i, i + 500).map((w, j) => ({
          list_id: listId,
          word: w.word,
          norm: normWord(w.word),
          meaning: w.meaning.slice(0, 200),
          is_phrase: w.is_phrase,
          pos: basePos + i + j,
        }));
        const res = await fetch("/api/words", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ words: rows }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);
      }

      // 批量补释义（跳过已有释义的）；失败可见、可重试
      const needMeaning = items.filter((w) => !w.meaning).map((w) => w.word);
      let done = 0;
      let failed = 0;
      for (let i = 0; i < needMeaning.length; i += 60) {
        const batch = needMeaning.slice(i, i + 60);
        setImportMsg(`AI 配释义 ${done}/${needMeaning.length}…（可放心等待，进度不会丢）`);
        try {
          const res = await fetch("/api/meanings", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ words: batch }),
          });
          const json = await res.json();
          if (json.ok) {
            await fetch("/api/words", {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ listId, meanings: json.items }),
            });
          } else {
            failed += batch.length;
            setFillError(json.error || "AI 释义请求失败");
          }
        } catch {
          failed += batch.length;
          setFillError("网络异常，部分释义未完成");
        }
        done += batch.length;
      }
      setImportMsg(failed > 0 ? `✅ 单词已全部入库成功！只是 ${failed} 个词的 AI 释义没配上。点下方按钮处理，或直接进词表。` : "全部完成！");
      if (failed > 0) {
        setBusy(false);
        return; // 留在原地，可重试或先进词表
      }
      router.push(`/words/${listId}`);
    } catch (e) {
      alert("导入出错：" + (e instanceof Error ? e.message : String(e)) + "\n已入库的部分不会丢，重试会自动跳过重复词。");
      setBusy(false);
    }
  }

  /** 重试补释义（仅列表中缺失的） */
  async function retryFill() {
    if (!listName.trim() && !appendListId) return;
    setBusy(true);
    setFillError("");
    try {
      const listId = await ensureListId();
      const need = parsed.filter((w) => picked.has(normWord(w.word)) && !w.meaning).map((w) => w.word);
      let done = 0;
      for (let i = 0; i < need.length; i += 60) {
        const batch = need.slice(i, i + 60);
        setImportMsg(`重试 AI 配释义 ${done}/${need.length}…`);
        const res = await fetch("/api/meanings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ words: batch }),
        });
        const json = await res.json();
        if (json.ok) {
          await fetch("/api/words", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ listId, meanings: json.items }),
          });
        } else {
          setFillError(json.error || "仍失败，请检查 GLM_API_KEY");
        }
        done += batch.length;
      }
      if (!fillError) router.push(`/words/${listId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 步骤条 */}
      <ol className="flex gap-2 text-xs text-slate-500">
        {["① 上传/粘贴", "② 挑选单词", "③ 命名导入"].map((s, i) => (
          <li key={s} className={`rounded-full px-3 py-1 ${step === i + 1 ? "bg-primary-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>
            {s}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex gap-2">
            {(["list", "prose"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-xl border px-4 py-2 text-sm ${mode === m ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300" : "border-slate-200 dark:border-slate-700"}`}
              >
                {m === "list" ? "词表模式（一行一词，可带释义）" : "文章模式（整本书/长文 → 去重单词）"}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            {mode === "list"
              ? "适合单词书导出、词单截图整理后的文本。分隔符支持 Tab、——、: 等，释义可省（AI 会补）。"
              : "适合整本书/长文：自动切词、去重（3万词的书约得5-8千唯一词）、统计词频，你从里面挑选要背的。"}
          </p>
          <div
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
            onDragOver={(e) => e.preventDefault()}
            onPaste={handlePaste}
            onClick={() => fileRef.current?.click()}
            tabIndex={0}
            className="cursor-pointer rounded-xl border-2 border-dashed border-slate-300 py-10 text-center text-sm text-slate-400 hover:border-primary-400 dark:border-slate-600"
          >
            {busyMsg || "点击选择 / 拖入文件 / 直接 Ctrl+V 粘贴图片或文本：txt · md · docx · pdf · 图片(png/jpg)"}
            <input ref={fileRef} type="file" multiple hidden accept=".txt,.md,.docx,.pdf,image/*" onChange={(e) => handleFiles(e.target.files)} />
          </div>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={5}
            placeholder="…或直接把单词/文本粘贴到这里"
            className="w-full rounded-xl border border-slate-300 p-3 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
          <button
            onClick={() => doParse(paste || rawText)}
            disabled={!paste && !rawText}
            className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            下一步：识别单词
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">已选 <b className="text-primary-600">{pickedCount}</b> / {parsed.length}</span>
            <input value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }} placeholder="搜索单词…" className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-800" />
            <button onClick={() => setWithMeaning((v) => !v)} className={`rounded-lg px-3 py-1.5 text-xs ${withMeaning ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30" : "border border-slate-200 dark:border-slate-700"}`}>
              {withMeaning ? "只看自带释义：开" : "只看自带释义：关"}
            </button>
            <button onClick={() => setPicked(new Set(filtered.map((w) => normWord(w.word))))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-600">全选本筛选</button>
            <button onClick={() => setPicked(new Set())} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-600">清空</button>
          </div>
          {filtered.length === 0 ? (
            <p className="rounded-xl bg-amber-50 px-4 py-6 text-center text-xs text-amber-600 dark:bg-amber-950/30 dark:text-amber-300">
              没有可显示的词{withMeaning ? "——当前开着「只看自带释义」，这批词都没带释义，请点一下该按钮关闭" : ""}
            </p>
          ) : (
          <div className="max-h-[50vh] divide-y overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-700">
            {pageItems.map((w) => {
              const key = normWord(w.word);
              const on = picked.has(key);
              return (
                <label key={key} className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input type="checkbox" checked={on} onChange={() => {
                    const next = new Set(picked);
                    on ? next.delete(key) : next.add(key);
                    setPicked(next);
                  }} />
                  <span className="w-40 font-medium">{w.word}</span>
                  {w.freq > 1 ? <span className="text-xs text-slate-400">×{w.freq}</span> : null}
                  <span className="truncate text-xs text-slate-400">{w.meaning || "（AI 将补释义）"}</span>
                </label>
              );
            })}
          </div>
          )}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40 dark:border-slate-600">上一页</button>
            <span>{page + 1} / {Math.max(1, Math.ceil(filtered.length / PER))}</span>
            <button onClick={() => setPage((p) => Math.min(Math.ceil(filtered.length / PER) - 1, p + 1))} className="rounded-lg border border-slate-200 px-3 py-1 dark:border-slate-600">下一页</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-600">上一步</button>
            <button onClick={() => setStep(3)} disabled={!pickedCount} className="rounded-xl bg-primary-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50">下一步（{pickedCount} 词）</button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <label className="block text-sm text-slate-500">
            本次词表名字（导入完毕后进入背诵）
            <input value={listName} onChange={(e) => setListName(e.target.value)} placeholder="如：剑雅核心词 / 王莹阅读生词本" className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800" />
          </label>
          <p className="text-xs text-slate-400">将导入 {pickedCount} 个词 · 重名自动去重 · 没有释义的词由 AI 自动补两个意思</p>
          {busy ? (
            <div className="space-y-2 rounded-xl bg-primary-50 p-4 text-sm text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">
              <p>{importMsg}</p>
              {fillError ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300">
                  <span>⚠ {fillError}</span>
                  <button onClick={retryFill} className="rounded-lg bg-red-600 px-3 py-1 text-white">重试补释义</button>
                  <button onClick={() => ensureListId().then((id) => router.push(`/words/${id}`))} className="rounded-lg border border-red-300 px-3 py-1">跳过，先进词表</button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-600">上一步</button>
              <button onClick={doImport} className="rounded-xl bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700">确认导入</button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
