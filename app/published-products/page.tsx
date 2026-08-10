import { ExternalLink, RefreshCw } from "lucide-react";

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
import { getValidToken } from "@/lib/mercadolibre/token";
import { getPublishedProductRows, type PublishedProductFilters, type PublishedProductRow } from "@/lib/mercadolibre/published-products";

export const dynamic = "force-dynamic";

function formatSites(row: PublishedProductRow) {
  return row.sites.map((site) => `${site.siteId}: ${site.itemId}`).join("\n");
}

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function buildQuery(filters: PublishedProductFilters, page: number) {
  const query = new URLSearchParams();
  if (filters.status && filters.status !== "active") query.set("status", filters.status);
  if (filters.siteId && filters.siteId !== "MLM") query.set("site", filters.siteId);
  if (filters.keyword) query.set("keyword", filters.keyword);
  if (page > 1) query.set("page", String(page));
  return query.toString();
}

export default async function PublishedProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  let rows: PublishedProductRow[] = [];
  let error: string | null = null;
  const params = await searchParams;
  const status = getParam(params, "status") || "active";
  const siteId = getParam(params, "site") || "MLM";
  const keyword = getParam(params, "keyword") || "";
  const page = Math.max(Number.parseInt(getParam(params, "page") || "1", 10) || 1, 1);
  const filters: PublishedProductFilters = {
    status: ["active", "paused", "closed", "all"].includes(status)
      ? status as PublishedProductFilters["status"]
      : "active",
    siteId: ["MLM", "MLB", "CBT"].includes(siteId)
      ? siteId as PublishedProductFilters["siteId"]
      : "MLM",
    keyword: keyword.trim() || undefined,
    page,
    pageSize: 20,
  };
  let total = 0;
  let totalPages = 1;
  let currentPage = page;

  try {
    const { token, mlUserId } = await getValidToken();
    const result = await getPublishedProductRows(token, mlUserId, filters);
    rows = result.rows;
    total = result.total;
    totalPages = result.totalPages;
    currentPage = result.page;
  } catch (err) {
    error = err instanceof Error ? err.message : "查询已上架商品失败。";
  }

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
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">状态</span>
            <select name="status" defaultValue={filters.status} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="active">已上架</option>
              <option value="paused">暂停</option>
              <option value="closed">关闭</option>
              <option value="all">全部</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">站点</span>
            <select name="site" defaultValue={filters.siteId} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="MLM">墨西哥 MLM</option>
              <option value="MLB">巴西 MLB</option>
              <option value="CBT">CBT</option>
            </select>
          </label>
          <label className="min-w-52 text-sm">
            <span className="mb-1 block text-muted-foreground">关键词</span>
            <Input name="keyword" defaultValue={filters.keyword || ""} placeholder="标题、SKU 或商品 ID" />
          </label>
          <Button type="submit" variant="outline" size="sm">
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
          ) : !rows.length ? (
            <div className="py-10 text-center text-muted-foreground">
              暂无当前有效的已上架商品。
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                      <TableCell className="min-w-64">
                        <div className="font-medium">{row.title}</div>
                        <div className="text-xs text-muted-foreground">Offer ID：{row.offerId}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.sourceSku}</TableCell>
                      <TableCell className="font-mono text-xs">{row.sellerSku}</TableCell>
                      <TableCell className="min-w-44 text-xs">
                        <div>UP：{row.sitelessUserProductId || "-"}</div>
                        <div className="text-muted-foreground">CBT：{row.cbtItemId || "-"}</div>
                      </TableCell>
                      <TableCell className="min-w-56">
                        <div className="whitespace-pre-line font-mono text-xs">{formatSites(row)}</div>
                      </TableCell>
                      <TableCell className="min-w-32">
                        <div className="flex flex-wrap gap-1">
                            <Badge>{row.status === "active" ? "已上架" : row.status}</Badge>
                          {row.sites.map((site) => (
                            <Badge key={site.itemId} variant="secondary">
                              {site.siteId} · {site.quantity ?? "-"}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.sourceUrl ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={row.sourceUrl} target="_blank" rel="noreferrer">
                              <ExternalLink />
                              打开原始商品
                            </a>
                          </Button>
                        ) : (
                          <Button disabled size="sm" variant="outline">
                            <ExternalLink />
                            原始链接不可用
                          </Button>
                        )}
                      </TableCell>
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
                {currentPage > 1 ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={`?${buildQuery(filters, currentPage - 1)}`}>上一页</a>
                  </Button>
                ) : <Button disabled size="sm" variant="outline">上一页</Button>}
                {pageNumbers.map((pageNumber) => (
                  <Button key={pageNumber} asChild size="sm" variant={pageNumber === currentPage ? "default" : "outline"}>
                    <a href={`?${buildQuery(filters, pageNumber)}`}>{pageNumber}</a>
                  </Button>
                ))}
                {currentPage < totalPages ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={`?${buildQuery(filters, currentPage + 1)}`}>下一页</a>
                  </Button>
                ) : <Button disabled size="sm" variant="outline">下一页</Button>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}