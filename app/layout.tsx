import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "人生罗盘 Pathfinder",
  description: "从命理入口到人生红点十二问，再生成三版奥德赛计划的 AI 人生设计 demo。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
