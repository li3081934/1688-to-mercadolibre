"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TranslationCacheItem = {
  id: number;
  sourceLocale: string;
  targetLocale: string;
  sourceText: string;
  translatedText: string;
  context: string;
  version: string;
  createdAt: string;
  updatedAt: string;
};

type CacheResponse = {
  data: TranslationCacheItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type Filters = {
  keyword: string;
  sourceLocale: string;
  targetLocale: string;
  context: string;
  version: string;
};

const PAGE_SIZE = 20;
const emptyFilters: Filters = {
  keyword: "",
  sourceLocale: "",
  targetLocale: "",
  context: "",
  version: "",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function TranslationCachePage() {
  const [items, setItems] = useState<TranslationCacheItem[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCache = useCallback(async (nextPage: number, nextFilters: Filters) => {
    setLoading(true);
    setError(null);
    const query = new URLSearchParams({
      page: String(nextPage),
      pageSize: String(PAGE_SIZE),
    });
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value.trim()) query.set(key, value.trim());
    });

    try {
      const response = await fetch(`/api/translation-cache?${query.toString()}`);
      const result = await response.json() as CacheResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || "加载翻译缓存失败。");
      setItems(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setPage(result.page);
      setDrafts(Object.fromEntries(result.data.map((item) => [item.id, item.translatedText])));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "加载翻译缓存失败。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCache(page, appliedFilters);
  }, [appliedFilters, fetchCache, page]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedFilters({ ...filters });
  }

  async function saveItem(item: TranslationCacheItem) {
    const translatedText = drafts[item.id]?.trim() || "";
    if (!translatedText) {
      toast.error("译文不能为空。");
      return;
    }
    setSavingId(item.id);
    try {
      const response = await fetch(`/api/translation-cache/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ translatedText }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "保存失败。");
      toast.success("译文已更新。");
      await fetchCache(page, appliedFilters);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "保存失败。");
    } finally {
      setSavingId(null);
    }
  }

  const pageNumbers = Array.from(
    { length: Math.min(totalPages, 5) },
    (_, index) => Math.max(1, Math.min(page - 2, totalPages - 4)) + index,
  ).filter((pageNumber) => pageNumber <= totalPages);

  return (
    <main className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">AI 翻译结果维护</p>
        <h1 className="text-2xl font-semibold tracking-tight">翻译缓存</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>缓存筛选</CardTitle>
          <CardDescription>
            手动修正后的译文会优先用于分类和属性展示，源文本与原始提交值不会改变。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={applyFilters} className="flex flex-wrap items-end gap-3">
            <label className="min-w-56 flex-1 text-sm">
              <span className="mb-1 block text-muted-foreground">关键词</span>
              <Input
                value={filters.keyword}
                onChange={(event) => setFilters({ ...filters, keyword: event.target.value })}
                placeholder="搜索源文本或译文"
              />
            </label>
            <label className="w-32 text-sm">
              <span className="mb-1 block text-muted-foreground">源语言</span>
              <Input
                value={filters.sourceLocale}
                onChange={(event) => setFilters({ ...filters, sourceLocale: event.target.value })}
                placeholder="en"
              />
            </label>
            <label className="w-32 text-sm">
              <span className="mb-1 block text-muted-foreground">目标语言</span>
              <Input
                value={filters.targetLocale}
                onChange={(event) => setFilters({ ...filters, targetLocale: event.target.value })}
                placeholder="zh-CN"
              />
            </label>
            <label className="w-40 text-sm">
              <span className="mb-1 block text-muted-foreground">上下文</span>
              <Input
                value={filters.context}
                onChange={(event) => setFilters({ ...filters, context: event.target.value })}
                placeholder="category / attribute"
              />
            </label>
            <label className="w-28 text-sm">
              <span className="mb-1 block text-muted-foreground">版本</span>
              <Input
                value={filters.version}
                onChange={(event) => setFilters({ ...filters, version: event.target.value })}
                placeholder="v1"
              />
            </label>
            <Button type="submit" variant="outline">
              <RefreshCw />
              查询
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>翻译结果</CardTitle>
          <CardDescription>共 {total} 条缓存，修改译文后点击对应行的保存按钮。</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : loading ? (
            <div className="py-10 text-center text-muted-foreground">正在加载翻译缓存...</div>
          ) : !items.length ? (
            <div className="py-10 text-center text-muted-foreground">暂无符合条件的翻译缓存。</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-56">源文本</TableHead>
                    <TableHead className="min-w-72">译文</TableHead>
                    <TableHead>语言</TableHead>
                    <TableHead>上下文</TableHead>
                    <TableHead>版本</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const changed = drafts[item.id] !== item.translatedText;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="max-w-80 whitespace-pre-wrap break-words align-top text-sm">
                          {item.sourceText}
                        </TableCell>
                        <TableCell className="min-w-72 align-top">
                          <Input
                            value={drafts[item.id] || ""}
                            onChange={(event) =>
                              setDrafts({ ...drafts, [item.id]: event.target.value })
                            }
                            className="min-h-9 whitespace-pre-wrap"
                            aria-label={`编辑 ${item.sourceText} 的译文`}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="secondary">{item.sourceLocale} → {item.targetLocale}</Badge>
                        </TableCell>
                        <TableCell className="max-w-32 break-words align-top text-xs text-muted-foreground">
                          {item.context || "通用"}
                        </TableCell>
                        <TableCell className="align-top text-xs">{item.version}</TableCell>
                        <TableCell className="whitespace-nowrap align-top text-xs text-muted-foreground">
                          {formatDate(item.updatedAt)}
                        </TableCell>
                        <TableCell className="text-right align-top">
                          <Button
                            size="sm"
                            disabled={!changed || savingId !== null}
                            onClick={() => saveItem(item)}
                          >
                            <Save />
                            {savingId === item.id ? "保存中" : "保存"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm">
              <span className="text-muted-foreground">第 {page} / {totalPages} 页</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(page - 1)}
                >
                  上一页
                </Button>
                {pageNumbers.map((pageNumber) => (
                  <Button
                    key={pageNumber}
                    variant={pageNumber === page ? "default" : "outline"}
                    size="sm"
                    disabled={loading}
                    onClick={() => setPage(pageNumber)}
                  >
                    {pageNumber}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage(page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
