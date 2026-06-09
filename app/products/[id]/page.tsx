import { notFound } from "next/navigation";

import { getProductById } from "@/lib/db";
import { parseProductBundle } from "@/lib/products";
import { toRelativeStoragePath } from "@/lib/storage";
import ExportForm from "./export-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ status?: string; message?: string }>;
};

export default async function ProductDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const product = getProductById(id);

  if (!product) {
    notFound();
  }

  const bundle = await parseProductBundle(product.extractedDir);
  const paramsState = (await searchParams) || {};

  return (
    <main className="grid">
      <section className="detail-card stack">
        <div>
          <p className="eyebrow">Product Detail</p>
          <h1>{product.title}</h1>
          <p className="muted">分类：{product.categoryName} ({product.categoryCode})</p>
        </div>
        {paramsState.message ? <div className={`message ${paramsState.status === "error" ? "error" : "success"}`}>{paramsState.message}</div> : null}
        <div className="actions">
          <a href="/products" className="button-secondary">返回商品列表</a>
        </div>
      </section>

      <section className="grid two">
        <article className="detail-card">
          <h2>元数据</h2>
          <div className="kv">
            <div>
              <strong>Offer ID</strong>
              <span>{product.offerId}</span>
            </div>
            <div>
              <strong>SKU 数量</strong>
              <span>{bundle.skuCount}</span>
            </div>
            <div>
              <strong>上架状态</strong>
              <span>{product.isListed ? "已上架" : "未上架"}</span>
            </div>
            <div>
              <strong>导出状态</strong>
              <span>{product.status}</span>
            </div>
            <div>
              <strong>主 JSON</strong>
              <span>{toRelativeStoragePath(bundle.mainJsonPath)}</span>
            </div>
            <div>
              <strong>详情 JSON</strong>
              <span>{bundle.detailJsonPath ? toRelativeStoragePath(bundle.detailJsonPath) : "未找到"}</span>
            </div>
            <div>
              <strong>共享图片</strong>
              <span>{bundle.sharedImagePaths.length}</span>
            </div>
            <div>
              <strong>ZIP 文件</strong>
              <span>{toRelativeStoragePath(product.zipPath)}</span>
            </div>
            <div>
              <strong>解压目录</strong>
              <span>{toRelativeStoragePath(product.extractedDir)}</span>
            </div>
          </div>
        </article>

        <article className="detail-card stack">
          <h2>导出上下文</h2>
          <div className="meta-list">
            <div className="meta-row">
              <span className="meta-label">模板路径</span>
              <span>{toRelativeStoragePath(product.categoryTemplatePath)}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">工作表</span>
              <span>{product.categorySheetName}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">填写方式</span>
              <span>AI 大模型填写模板</span>
            </div>
          </div>
        </article>
      </section>

      <section className="detail-card stack">
        <div>
          <h2>Excel 填写</h2>
          <p className="muted">系统会把分类模板、工作表结构、主商品 JSON、已选 SKU JSON 和你的补充提示词一起发送给 AI，让模型生成写入 Excel 的单元格计划。</p>
        </div>
        <ExportForm
          action={`/products/${product.id}/export`}
          skuItems={bundle.skuItems.map((s) => ({ key: s.key, label: s.label, imageUrl: s.imageUrl }))}
          hasSku={bundle.skuItems.length > 0}
        />
      </section>

      <section className="detail-card stack">
        <h2>主 JSON 预览</h2>
        <pre className="code-block">{JSON.stringify({
          source: bundle.mainProduct.source || {},
          product: bundle.mainProduct.product || {},
          attributes: bundle.mainProduct.attributes || [],
          packageInfo: bundle.mainProduct.packageInfo || {}
        }, null, 2)}</pre>
      </section>
    </main>
  );
}