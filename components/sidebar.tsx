"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Globe,
  ExternalLink,
  Brain,
  Languages,
  LogOut,
  ListTree,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS: Array<{
  href: Route;
  label: string;
  icon: React.ReactNode;
}> = [
  { href: "/", label: "概览", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/products", label: "商品库管理", icon: <Package className="h-4 w-4" /> },
  {
    href: "/published-products",
    label: "已上架商品",
    icon: <ExternalLink className="h-4 w-4" />,
  },
  {
    href: "/mercadolibre",
    label: "美客多集成",
    icon: <Globe className="h-4 w-4" />,
  },
  { href: "/ai-models", label: "AI 模型", icon: <Brain className="h-4 w-4" /> },
  {
    href: "/translation-cache",
    label: "翻译缓存",
    icon: <Languages className="h-4 w-4" />,
  },
  {
    href: "/categories",
    label: "分类管理",
    icon: <ListTree className="h-4 w-4" />,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-card">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        <Package className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">1688 Export Manager</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <form action="/api/logout" method="post">
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 text-muted-foreground"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </Button>
        </form>
      </div>
    </aside>
  );
}
