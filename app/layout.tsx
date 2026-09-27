import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "IELTS 备考站 · 背单词/短文填空/写作演练",
  description: "私人雅思备考工具：单词抄写记忆、短文挖空背诵、写作计时演练与 AI 批改。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <Header />
        {children}
      </body>
    </html>
  );
}
