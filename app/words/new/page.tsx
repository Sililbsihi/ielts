/** 导入向导入口（新建词表） */
"use client";
import WordImport from "@/components/WordImport";

export default function NewWordsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">新建词表 / 导入单词</h1>
      <p className="mt-1 text-xs text-slate-400">导入的源文件不会被保存，只保留识别出的单词与释义。</p>
      <div className="mt-6">
        <WordImport />
      </div>
    </main>
  );
}
