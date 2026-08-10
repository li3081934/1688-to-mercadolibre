import { notFound } from "next/navigation";

import { getProductById } from "@/lib/db";
import { parseProductBundle } from "@/lib/products";
import { toRelativeStoragePath } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import ExportForm from "./export-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ status?: string; message?: string }>;
};

export default async function ProductDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const product = getProductById(id);

  if (!product) {
    notFound();
  }

  const bundle = await parseProductBundle(product.extractedDir);
  const paramsState = (await searchParams) || {};

  return (
    <main className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardDescription>Product Detail</CardDescription>
          <CardTitle>{product.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {paramsState.message ? (
            <Alert
              variant={
                paramsState.status === "error" ? "destructive" : "default"
              }
              className="mb-4"
            >
              <AlertDescription>{paramsState.message}</AlertDescription>
            </Alert>
          ) : null}
          <a href="/products">
            <Button variant="outline">返回商品列表</Button>
          </a>
        </CardContent>
      </Card>

      <div className="grid-2">
        <Card>
          <CardHeader>
            <CardTitle>元数据</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="font-medium text-muted-foreground">Offer ID</dt>
              <dd>{product.offerId}</dd>
              <dt className="font-medium text-muted-foreground">SKU 数量</dt>
              <dd>{bundle.skuCount}</dd>
              <dt className="font-medium text-muted-foreground">上架状态</dt>
              <dd>{product.isListed ? "已上架" : "未上架"}</dd>
              <dt className="font-medium text-muted-foreground">导出状态</dt>
              <dd>{product.status}</dd>
              <dt className="font-medium text-muted-foreground">主 JSON</dt>
              <dd className="break-all">
                {toRelativeStoragePath(bundle.mainJsonPath)}
              </dd>
              <dt className="font-medium text-muted-foreground">详情 JSON</dt>
              <dd className="break-all">
                {bundle.detailJsonPath
                  ? toRelativeStoragePath(bundle.detailJsonPath)
                  : "未找到"}
              </dd>
              <dt className="font-medium text-muted-foreground">共享图片</dt>
              <dd>{bundle.sharedImagePaths.length}</dd>
              <dt className="font-medium text-muted-foreground">ZIP 文件</dt>
              <dd className="break-all">
                {toRelativeStoragePath(product.zipPath)}
              </dd>
              <dt className="font-medium text-muted-foreground">解压目录</dt>
              <dd className="break-all">
                {toRelativeStoragePath(product.extractedDir)}
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>导出说明</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="font-medium text-muted-foreground">填写方式</dt>
              <dd>AI 大模型填写模板</dd>
              <dt className="font-medium text-muted-foreground">操作步骤</dt>
              <dd>
                上传需要导出的 Excel 模板文件，AI 会自动将商品数据填入对应单元格。
              </dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Excel 填写</CardTitle>
          <CardDescription>
            上传 Excel 模板，系统会将商品 JSON 数据和你的补充提示词一起发送给
            AI，让模型生成写入 Excel 的单元格计划。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportForm
            action={`/products/${product.id}/export`}
            skuItems={bundle.skuItems.map((s) => ({
              key: s.key,
              label: s.label,
              imageUrl: s.imageUrl,
            }))}
            hasSku={bundle.skuItems.length > 0}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>主 JSON 预览</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-96 overflow-auto rounded-lg border bg-muted p-4 text-xs">
            {JSON.stringify(
              {
                source: bundle.mainProduct.source || {},
                product: bundle.mainProduct.product || {},
                attributes: bundle.mainProduct.attributes || [],
                packageInfo: bundle.mainProduct.packageInfo || {},
              },
              null,
              2,
            )}
          </pre>
        </CardContent>
      </Card>
    </main>
  );
}
