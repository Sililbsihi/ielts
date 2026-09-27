/** 密码门页：输入 ACCESS_CODE 换取票据 cookie */
"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function GateForm() {
  const params = useSearchParams();
  const from = params.get("from") || "/";
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        window.location.href = from;
        return;
      }
      setErr("密码不对，再想想");
    } catch {
      setErr("网络异常，稍后再试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">IELTS 备考站</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">私人学习空间，请输入访问密码</p>
      <input
        type="password"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoFocus
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
        placeholder="访问密码"
      />
      {err ? <p className="text-xs text-red-500">{err}</p> : null}
      <button
        type="submit"
        disabled={busy || !code}
        className="w-full rounded-xl bg-primary-600 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
      >
        {busy ? "验证中…" : "进入"}
      </button>
    </form>
  );
}

export default function GatePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <Suspense>
        <GateForm />
      </Suspense>
    </div>
  );
}
