/** 首页：三板块入口 + 快速统计 */
import Link from "next/link";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

async function stats() {
  try {
    const db = getDb();
    const [lists, passages, prompts, essays] = await Promise.all([
      db.from("wl_lists").select("id", { count: "exact", head: true }),
      db.from("ps_passages").select("id", { count: "exact", head: true }),
      db.from("wr_prompts").select("id", { count: "exact", head: true }),
      db.from("wr_essays").select("id", { count: "exact", head: true }),
    ]);
    return {
      lists: lists.count ?? 0,
      passages: passages.count ?? 0,
      prompts: prompts.count ?? 0,
      essays: essays.count ?? 0,
    };
  } catch {
    return null;
  }
}

const CARDS = [
  { href: "/words", no: "①", title: "单词抄写", desc: "导入电子书/文档/图片 → 自动识别+配释义 → 抄写记忆（≤5字母×2遍，≥5字母与短语×3遍，错1遍重来）" },
  { href: "/passages", no: "②", title: "短文填空", desc: "导入短文 → 纠错 → 划词隐藏（保留首末字母）→ 填空背诵（错2次可逐字母提示）" },
  { href: "/writing", no: "③", title: "写作演练", desc: "导入历年题目 → 每日选题 → 脑暴 + 50分钟限时写作 → AI 批改纠错 + 四标准打分" },
];

export default async function Home() {
  const s = await stats();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">一切为了学习、背诵和记忆。</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">导入的内容只提取文字入库，源文件不会被保存。</p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-primary-400 hover:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-500"
          >
            <p className="text-3xl">{c.no}</p>
            <h2 className="mt-3 text-lg font-bold text-slate-900 group-hover:text-primary-700 dark:text-white dark:group-hover:text-primary-300">{c.title}</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{c.desc}</p>
          </Link>
        ))}
      </div>

      {s ? (
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["词表", s.lists],
            ["短文", s.passages],
            ["写作题目", s.prompts],
            ["已写作文", s.essays],
          ].map(([label, n]) => (
            <div key={label as string} className="rounded-xl border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{n as number}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label as string}</p>
            </div>
          ))}
        </div>
      ) : null}
    </main>
  );
}
