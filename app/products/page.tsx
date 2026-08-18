import Link from "next/link";

import { listProducts } from "@/lib/db";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { DeleteProductButton } from "./delete-button";
import { UploadForm } from "./upload-form";
import { RefreshButton } from "./refresh-button";
import { RecommendCategoryButton } from "./recommend-category-button";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = listProducts();

  return (
    <main className="flex flex-col gap-4">
      <div className="grid-2">
        <Card>
          <CardHeader>
            <CardDescription>商品库管理</CardDescription>
            <CardTitle>商品库管理</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">上传 ZIP，系统自动解压并识别商品数据。</p>
          </CardContent>
        </Card>

        <UploadForm />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>商品库列表</CardTitle>
          <RefreshButton />
        </CardHeader>
        <CardContent>
          {!products.length ? (
            <div className="py-8 text-center text-muted-foreground">
              还没有商品。上传一个最新采集的商品 ZIP 之后这里会出现记录。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Link href={`/products/${product.id}`} className="font-medium hover:underline">
                        {product.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        Offer ID：{product.offerId}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        上传时间：
                        {new Date(product.createdAt).toLocaleString("zh-CN")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{product.skuCount} 个 SKU</div>
                      <div className="text-xs text-muted-foreground">
                        分类：{product.mlCategoryId || "未推荐"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant={product.isListed ? "default" : "secondary"}
                        >
                          {product.isListed ? "已上架" : "未上架"}
                        </Badge>
                        <Badge
                          variant={
                            product.status === "error"
                              ? "destructive"
                              : "default"
                          }
                        >
                          {product.status === "error"
                            ? "导出异常"
                            : product.status === "category_recommending"
                              ? "分类推荐中"
                              : "正常"}
                        </Badge>
                      </div>
                      {product.lastError ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          最近错误：{product.lastError}
                        </div>
                      ) : null}

                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <RecommendCategoryButton
                          productId={product.id}
                          recommending={product.status === "category_recommending"}
                        />
                        <form
                          action={`/api/products/${product.id}/listed`}
                          method="post"
                        >
                          <input
                            type="hidden"
                            name="isListed"
                            value={product.isListed ? "0" : "1"}
                          />
                          <Button
                            type="submit"
                            variant={
                              product.isListed ? "destructive" : "outline"
                            }
                            size="sm"
                          >
                            {product.isListed
                              ? "标记为未上架"
                              : "标记为已上架"}
                          </Button>
                        </form>
                        <DeleteProductButton productId={product.id} />
                        {product.mlCategoryId ? (
                          <Link href={`/products/${product.id}/publish`}>
                            <Button size="sm">上架到美客多</Button>
                          </Link>
                        ) : (
                          <Button size="sm" disabled title="请先使用商品标题推荐分类">
                            上架到美客多
                          </Button>
                        )}
                      </div>
                      {product.lastExportedAt ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          上次导出：
                          {new Date(product.lastExportedAt).toLocaleString(
                            "zh-CN",
                          )}
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
