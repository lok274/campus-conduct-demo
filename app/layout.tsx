import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "校園訓育系統｜訓育工作台",
  description: "學生名冊及校本訓育紀錄的前端示範介面。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}

