import { notFound } from "next/navigation";

import { getProductById } from "@/lib/db";
import { parseProductBundle } from "@/lib/products";
import { toRelativeStoragePath } from "@/lib/storage";

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
              <span className="meta-label">Mapper 路径</span>
              <span>{toRelativeStoragePath(product.categoryMapperPath)}</span>
            </div>
            <div className="meta-row">
              <span className="meta-label">工作表</span>
              <span>{product.categorySheetName}</span>
            </div>
          </div>
        </article>
      </section>

      <section className="detail-card stack">
        <div>
          <h2>选择导出 SKU</h2>
          <p className="muted">默认全选。取消勾选后，只会导出你选中的 SKU。</p>
        </div>
        <form action={`/products/${product.id}/export`} method="get" className="stack">
          {bundle.skuItems.length ? (
            <div className="stack">
              {bundle.skuItems.map((skuItem) => (
                <label key={skuItem.key} className="meta-row" style={{ alignItems: "flex-start", gap: 12 }}>
                  <input type="checkbox" name="sku" value={skuItem.key} defaultChecked />
                  {skuItem.imageUrl ? (
                    <img
                      src={skuItem.imageUrl}
                      alt={skuItem.label}
                      width={64}
                      height={64}
                      style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10, flexShrink: 0 }}
                    />
                  ) : null}
                  <strong>{skuItem.label}</strong>
                </label>
              ))}
            </div>
          ) : (
            <div className="empty-state">当前商品没有单独 SKU JSON，将按主商品信息导出。</div>
          )}
          <div className="actions">
            <button type="submit" className="button">导出选中 SKU 到 Excel</button>
          </div>
        </form>
      </section>

      <section className="detail-card stack">
        <h2>主 JSON 预览</h2>
        <pre className="code-block">{JSON.stringify(bundle.mainProduct.source || bundle.mainProduct.fields || {}, null, 2)}</pre>
      </section>
    </main>
  );
}