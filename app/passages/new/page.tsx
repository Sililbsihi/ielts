/**
 * 短文导入+纠错+划词编辑器（新建 / ?edit=id 编辑共用）
 * 划词：选中文字 → "隐藏选中" → 该片段挖空（保留首末字母 a……m）
 */
"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { extractTextFromFile, type Progress } from "@/lib/wordparse";

interface Mark {
  start: number;
  end: number;
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit") || "";
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [marks, setMarks] = useState<Mark[]>([]);
  const [mode, setMode] = useState<"edit" | "mark">("edit");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (editId) {
      fetch(`/api/passages?id=${editId}`)
        .then((r) => r.json())
        .then((j) => {
          if (j.ok) {
            setTitle(j.passage.title);
            setBody(j.passage.body);
            setMarks(j.passage.marks ?? []);
          } else setErr(j.error);
        });
    }
  }, [editId]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setErr("");
    let all = "";
    for (let i = 0; i < files.length; i++) {
      try {
        const t = await extractTextFromFile(files[i], (m: string) => setBusy(`${files[i].name}：${m}`));
        all += (all ? "\n\n" : "") + t.trim();
      } catch (e) {
        setErr(`${files[i].name} 识别失败：${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setBusy("");
    if (all) {
      setBody((prev) => (prev ? prev + "\n\n" + all : all));
      setMarks([]); // 文本变了，旧挖空作废
    }
  }

  /** 选中文字 → 字符偏移（相对 bodyRef 容器） */
  function getSelectionRange(): Mark | null {
    const sel = window.getSelection();
    const host = bodyRef.current;
    if (!sel || sel.isCollapsed || !host) return null;
    if (!host.contains(sel.anchorNode) || !host.contains(sel.focusNode)) return null;
    const range = sel.getRangeAt(0);
    const pre = range.cloneRange();
    pre.selectNodeContents(host);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const len = range.toString().length;
    if (!len) return null;
    return { start, end: start + len };
  }

  function addMark() {
    const r = getSelectionRange();
    if (!r) return;
    if (r.end - r.start < 2) {
      setErr("选中的内容太短（至少 2 个字符）");
      return;
    }
    setErr("");
    // 与已有区间合并重叠
    const merged = [...marks, r]
      .sort((a, b) => a.start - b.start)
      .reduce<Mark[]>((acc, m) => {
        const last = acc[acc.length - 1];
        if (last && m.start <= last.end) {
          last.end = Math.max(last.end, m.end);
          return acc;
        }
        acc.push({ ...m });
        return acc;
      }, []);
    setMarks(merged);
    window.getSelection()?.removeAllRanges();
  }

  const sortedMarks = [...marks].sort((a, b) => a.start - b.start);

  /** 把 body 按挖空切段渲染 */
  function renderMarked() {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    sortedMarks.forEach((m, i) => {
      if (m.start > cursor) nodes.push(<span key={`t${i}`}>{body.slice(cursor, m.start)}</span>);
      const w = body.slice(m.start, m.end);
      const show = w.length >= 3 ? `${w.slice(0, 1)}……${w.slice(-1)}` : `${w.slice(0, 1)}……`;
      nodes.push(
        <span key={`m${i}`} className="mx-0.5 rounded bg-amber-100 px-1 font-mono text-primary-700 dark:bg-amber-900/30 dark:text-primary-300" title="点击取消挖空" onClick={() => setMarks(marks.filter((x) => !(x.start === m.start && x.end === m.end)))}>
          {show}
        </span>
      );
      cursor = m.end;
    });
    if (cursor < body.length) nodes.push(<span key="tail">{body.slice(cursor)}</span>);
    return nodes;
  }

  async function save() {
    if (!title.trim()) return setErr("先给本次短文起个标题");
    if (!body.trim()) return setErr("还没有内容");
    setBusy("保存中…");
    const payload = { title: title.trim(), body, marks: sortedMarks };
    const res = editId
      ? await fetch("/api/passages", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: editId, ...payload }) })
      : await fetch("/api/passages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    setBusy("");
    if (json.ok) {
      setSaved(true);
      router.push(editId ? `/passages/${editId}` : `/passages/${json.id}`);
    } else setErr(json.error || "保存失败");
  }

  return (
    <div className="space-y-5">
      {/* 步骤A：导入 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold">A. 导入（可分多次，源文件不会被保存）</h2>
        <input ref={fileRef} type="file" multiple accept=".txt,.md,.pdf,.docx,image/*" onChange={(e) => handleFiles(e.target.files)} className="hidden" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => fileRef.current?.click()} className="rounded-xl border-2 border-dashed border-slate-300 px-5 py-3 text-sm text-slate-500 hover:border-primary-400 hover:text-primary-600 dark:border-slate-600">
            📎 选择文件（PDF / Word / TXT / 图片）
          </button>
          {busy ? <span className="self-center text-xs text-primary-600">{busy}</span> : null}
        </div>
        <textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); setMarks([]); }}
          placeholder="…或直接把短文粘贴/在此输入。识别结果可先在此纠错。"
          rows={8}
          className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-sm leading-relaxed dark:border-slate-600 dark:bg-slate-800"
        />
      </section>

      {/* 步骤B：划词 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">B. 划词挖空（{marks.length} 个）</h2>
          <div className="flex gap-2">
            <button onClick={() => setMode("edit")} className={`rounded-lg px-3 py-1.5 text-xs ${mode === "edit" ? "bg-primary-600 text-white" : "border border-slate-200 dark:border-slate-600"}`}>纠错模式</button>
            <button onClick={() => setMode("mark")} className={`rounded-lg px-3 py-1.5 text-xs ${mode === "mark" ? "bg-primary-600 text-white" : "border border-slate-200 dark:border-slate-600"}`}>划词模式</button>
          </div>
        </div>

        {mode === "edit" ? (
          <p className="mt-2 text-xs text-slate-400">在上面输入框里改文字（改完挖空需重划），改好再切到划词模式。</p>
        ) : (
          <>
            <p className="mt-2 text-xs text-slate-400">用鼠标选中要背的单词/短语 → 点「隐藏选中」。点击下方正文里的高亮块可取消该挖空。</p>
            <button onClick={addMark} className="mt-2 rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-amber-600">隐藏选中</button>
          </>
        )}

        <div
          ref={bodyRef}
          onMouseUp={() => mode === "mark" && addMark()}
          className="mt-4 max-h-96 overflow-auto rounded-xl bg-slate-50 p-4 text-sm leading-7 dark:bg-slate-800"
        >
          {body ? (
            mode === "mark" ? (
              renderMarked()
            ) : (
              body
            )
          ) : (
            <span className="text-slate-400">（识别/粘贴的内容会显示在这里）</span>
          )}
        </div>
      </section>

      {/* 步骤C：保存 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold">C. 确认保存</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="本次短文标题，如：剑桥17 Test2 Passage3" className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800" />
        {err ? <p className="mt-2 text-xs text-red-500">{err}</p> : null}
        <button onClick={save} disabled={!!busy || saved} className="mt-3 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
          {busy || (saved ? "已保存" : "保存并进入背诵")}
        </button>
      </section>
    </div>
  );
}

export default function PassageEditorPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">导入短文 · 纠错 · 划词</h1>
      <p className="mt-1 text-xs text-slate-400">识别内容与挖空会被保存；源文件不保存。</p>
      <div className="mt-6">
        <Suspense>
          <Inner />
        </Suspense>
      </div>
    </main>
  );
}
