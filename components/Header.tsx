/** 站点顶栏：三板块导航 */
import Link from "next/link";

export default function Header() {
  const item = "rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white";
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary-600 text-white">雅</span>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-50">IELTS 备考站</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/words" className={item}>① 单词抄写</Link>
          <Link href="/passages" className={item}>② 短文填空</Link>
          <Link href="/writing" className={item}>③ 写作演练</Link>
        </nav>
      </div>
    </header>
  );
}
