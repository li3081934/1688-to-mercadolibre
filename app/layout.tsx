import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "1688 Export Manager",
  description: "Manage product categories, uploaded ZIP packages, and Excel exports."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="shell">
          <header className="topbar">
            <div className="brand">
              <small className="brand-mark">1688 To Mercado Libre</small>
              <strong className="brand-title">商品导出管理系统</strong>
            </div>
            <nav className="nav">
              <Link href="/" className="nav-link">
                概览
              </Link>
              <Link href="/categories" className="nav-link">
                商品分类管理
              </Link>
              <Link href="/products" className="nav-link">
                商品管理
              </Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}