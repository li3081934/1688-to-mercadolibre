"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  PublishedProductFilters,
  PublishedProductPage,
  PublishedProductRow,
} from "@/lib/mercadolibre/published-products";

const DEFAULT_FILTERS: Required<Pick<PublishedProductFilters, "status" | "siteId">> = {
  status: "active",
  siteId: "MLM",
};

function getFilters(searchParams: URLSearchParams): PublishedProductFilters {
  const status = searchParams.get("status");
  const siteId = searchParams.get("site");
  const page = Number.parseInt(searchParams.get("page") || "1", 10);

  return {
    status: status === "paused" || status === "closed" || status === "all" ? status : DEFAULT_FILTERS.status,
    siteId: siteId === "MLB" || siteId === "CBT" ? siteId : DEFAULT_FILTERS.siteId,
    keyword: searchParams.get("keyword")?.trim() || undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: 20,
  };
}

function buildQuery(filters: PublishedProductFilters, page = filters.page || 1) {
  const query = new URLSearchParams();
  if (filters.status && filters.status !== DEFAULT_FILTERS.status) query.set("status", filters.status);
  if (filters.siteId && filters.siteId !== DEFAULT_FILTERS.siteId) query.set("site", filters.siteId);
  if (filters.keyword) query.set("keyword", filters.keyword);
  if (page > 1) query.set("page", String(page));
  return query.toString();
}

function formatSites(row: PublishedProductRow) {
  return row.sites.map((site) => `${site.siteId}: ${site.itemId}`).join("\n");
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
      <Loader2 className="animate-spin" />
      正在查询商品...
    </div>
  );
}

export default function PublishedProductsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PublishedProductPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const filters = getFilters(searchParams);

  useEffect(() => {
    const controller = new AbortController();
    const query = buildQuery(filters);
    setLoading(true);
    setError(null);

    fetch(`/api/mercadolibre/published-products${query ? `?${query}` : ""}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json() as {
          success?: boolean;
          data?: PublishedProductPage;
          message?: string;
        };
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.message || "查询已上架商品失败。");
        }
        return payload.data;
      })
      .then((nextData) => {
        setData(nextData);
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setError(requestError instanceof Error ? requestError.message : "查询已上架商品失败。");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [filters.status, filters.siteId, filters.keyword, filters.page, refreshKey]);

  function updateQuery(nextFilters: PublishedProductFilters) {
    const query = buildQuery(nextFilters);
    router.push((query ? `${pathname}?${query}` : pathname) as Route);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    updateQuery({
      ...filters,
      status: formData.get("status") as PublishedProductFilters["status"],
      siteId: formData.get("site") as PublishedProductFilters["siteId"],
      keyword: String(formData.get("keyword") || "").trim() || undefined,
      page: 1,
    });
  }

  const rows = data?.rows || [];
  const currentPage = data?.page || filters.page || 1;
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;
  const pageStart = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pageEnd = Math.min(totalPages, pageStart + 4);
  const pageNumbers = Array.from({ length: pageEnd - pageStart + 1 }, (_, index) => pageStart + index);

  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Mercado Libre 实时商品</p>
          <h1 className="text-2xl font-semibold tracking-tight">已上架商品</h1>
        </div>
        <form key={buildQuery(filters)} onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">状态</span>
            <select name="status" value={filters.status} onChange={(event) => updateQuery({ ...filters, status: event.target.value as PublishedProductFilters["status"], page: 1 })} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="active">已上架</option>
              <option value="paused">暂停</option>
              <option value="closed">关闭</option>
              <option value="all">全部</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">站点</span>
            <select name="site" value={filters.siteId} onChange={(event) => updateQuery({ ...filters, siteId: event.target.value as PublishedProductFilters["siteId"], page: 1 })} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="MLM">墨西哥 MLM</option>
              <option value="MLB">巴西 MLB</option>
              <option value="CBT">CBT</option>
            </select>
          </label>
          <label className="min-w-52 text-sm">
            <span className="mb-1 block text-muted-foreground">关键词</span>
            <Input name="keyword" defaultValue={filters.keyword || ""} placeholder="标题、SKU 或商品 ID" />
          </label>
          <Button type="submit" variant="outline" size="sm" disabled={loading}>
            <RefreshCw />
            刷新
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>上架商品列表</CardTitle>
          <CardDescription>当前筛选结果：{total} 条，默认查询墨西哥站 MLM。</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : loading && !data ? (
            <LoadingState />
          ) : !rows.length ? (
            <div className="py-10 text-center text-muted-foreground">暂无当前有效的已上架商品。</div>
          ) : (
            <div className="relative overflow-x-auto">
              {loading && <div className="absolute inset-0 z-10 flex items-start justify-center bg-background/60 pt-10 text-sm text-muted-foreground"><LoadingState /></div>}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>源商品</TableHead>
                    <TableHead>原始 SKU</TableHead>
                    <TableHead>美客多 SKU</TableHead>
                    <TableHead>UP / CBT</TableHead>
                    <TableHead>站点商品</TableHead>
                    <TableHead>状态与库存</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="min-w-64"><div className="font-medium">{row.title}</div><div className="text-xs text-muted-foreground">Offer ID：{row.offerId}</div></TableCell>
                      <TableCell className="font-mono text-xs">{row.sourceSku}</TableCell>
                      <TableCell className="font-mono text-xs">{row.sellerSku}</TableCell>
                      <TableCell className="min-w-44 text-xs"><div>UP：{row.sitelessUserProductId || "-"}</div><div className="text-muted-foreground">CBT：{row.cbtItemId || "-"}</div></TableCell>
                      <TableCell className="min-w-56"><div className="whitespace-pre-line font-mono text-xs">{formatSites(row)}</div></TableCell>
                      <TableCell className="min-w-32"><div className="flex flex-wrap gap-1"><Badge>{row.status === "active" ? "已上架" : row.status}</Badge>{row.sites.map((site) => <Badge key={site.itemId} variant="secondary">{site.siteId} · {site.quantity ?? "-"}</Badge>)}</div></TableCell>
                      <TableCell className="text-right">{row.sourceUrl ? <Button asChild size="sm" variant="outline"><a href={row.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink />打开原始商品</a></Button> : <Button disabled size="sm" variant="outline"><ExternalLink />原始链接不可用</Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-muted-foreground">第 {currentPage} / {totalPages} 页</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={currentPage <= 1 || loading} onClick={() => updateQuery({ ...filters, page: currentPage - 1 })}>上一页</Button>
                {pageNumbers.map((pageNumber) => <Button key={pageNumber} size="sm" variant={pageNumber === currentPage ? "default" : "outline"} disabled={loading} onClick={() => updateQuery({ ...filters, page: pageNumber })}>{pageNumber}</Button>)}
                <Button size="sm" variant="outline" disabled={currentPage >= totalPages || loading} onClick={() => updateQuery({ ...filters, page: currentPage + 1 })}>下一页</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}