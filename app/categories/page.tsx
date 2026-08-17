"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { CategoryTree, type CategoryTreeNode } from "@/components/category-tree";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type CategoryRecord = {
  categoryId: string;
  name: string;
  displayName: string;
  hasChildren: boolean;
  parentCategoryId: string | null;
};

type CategoryStatus = {
  total: number;
  syncedAt: string | null;
};

function buildTree(records: CategoryRecord[]) {
  const nodes = new Map<string, CategoryTreeNode>();
  for (const record of records) {
    nodes.set(record.categoryId, { ...record, children: [] });
  }
  const roots: CategoryTreeNode[] = [];
  for (const record of records) {
    const node = nodes.get(record.categoryId)!;
    if (record.parentCategoryId && nodes.has(record.parentCategoryId)) {
      nodes.get(record.parentCategoryId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export default function CategoriesPage() {
  const [nodes, setNodes] = useState<CategoryTreeNode[]>([]);
  const [status, setStatus] = useState<CategoryStatus>({ total: 0, syncedAt: null });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/mercadolibre/categories/local?all=1");
      const result = await response.json();
      if (!result.success) throw new Error(result.message || "读取分类失败。");
      setNodes(buildTree(result.data as CategoryRecord[]));
      setStatus(result.status as CategoryStatus);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取分类失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const syncCategories = async () => {
    setSyncing(true);
    setSyncStatus("正在从 Mercado Libre 获取 CBT 分类树...");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5 * 60 * 1000);
    try {
      const response = await fetch("/api/mercadolibre/categories/sync", {
        method: "POST",
        signal: controller.signal,
      });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`同步接口返回了非 JSON 响应（HTTP ${response.status}）。`);
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `同步失败（HTTP ${response.status}）。`);
      if (!result.success) throw new Error(result.message || "同步分类失败。");
      toast.success(`CBT 分类同步完成，共 ${result.data.total} 个分类。`);
      setSyncStatus(`同步完成，共 ${result.data.total} 个分类。`);
      await loadCategories();
    } catch (error) {
      const message = error instanceof DOMException && error.name === "AbortError"
        ? "同步超过 5 分钟仍未完成，请查看服务端日志。"
        : error instanceof Error ? error.message : "同步分类失败。";
      setSyncStatus(message);
      toast.error(message);
    } finally {
      window.clearTimeout(timeout);
      setSyncing(false);
    }
  };

  return (
    <main className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">分类管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理 Mercado Libre CBT 分类树。</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>CBT 分类树</CardTitle>
            <CardDescription>
              {status.total > 0 ? `共 ${status.total} 个分类` : "尚未同步分类"}
              {status.syncedAt ? `，上次同步于 ${new Date(status.syncedAt).toLocaleString("zh-CN")}` : ""}
            </CardDescription>
            {syncStatus ? <p className="mt-2 text-xs text-muted-foreground">{syncStatus}</p> : null}
          </div>
          <Button onClick={syncCategories} disabled={syncing} className="shrink-0">
            <RefreshCw className={syncing ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            {syncing ? "同步中..." : "同步分类"}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">加载分类中...</p> : null}
          {!loading && nodes.length === 0 ? (
            <Alert>
              <AlertDescription>暂无本地分类，请点击“同步分类”获取 CBT 分类树。</AlertDescription>
            </Alert>
          ) : null}
          {!loading && nodes.length > 0 ? <CategoryTree nodes={nodes} /> : null}
        </CardContent>
      </Card>
    </main>
  );
}