import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Toaster } from "sonner";

import "@/app/globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "1688 Export Manager",
  description:
    "Manage product categories, uploaded ZIP packages, and Excel exports.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const isAuth = cookieStore.has("auth_token");

  return (
    <html lang="zh-CN">
      <body className="overflow-hidden">
        <Toaster richColors closeButton position="top-right" />
        {isAuth ? (
          <div className="flex h-screen">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
