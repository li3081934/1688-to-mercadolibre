import Link from "next/link";

import { listActiveCategories, listProducts } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ status?: string; message?: string }>;
};

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const categories = listActiveCategories();
  const products = listProducts();

  return (
    <main className="grid">
      <section className="grid two">
        <article className="panel stack">
          <div>
            <p className="eyebrow">Module 02</p>
            <h1>商品管理</h1>
            <p className="muted">上传 ZIP 时必须先选分类。系统会自动解压、识别主 JSON、detail 文件夹和主 JSON 里的 SKU 列表，并把商品初始状态设为未上架。</p>
          </div>
          {params.message ? <div className={`message ${params.status === "error" ? "error" : "success"}`}>{params.message}</div> : null}
        </article>

        <article className="panel stack">
          <h2>上传商品 ZIP</h2>
          {!categories.length ? (
            <div className="empty-state">还没有可用分类。先去<Link href="/categories">分类管理</Link>创建分类。</div>
          ) : (
            <form action="/api/products/upload" method="post" encType="multipart/form-data" className="stack">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="categoryId">选择分类</label>
                  <select id="categoryId" name="categoryId" required defaultValue="">
                    <option value="" disabled>请选择分类</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name} ({category.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="zipFile">ZIP 文件</label>
                  <input id="zipFile" name="zipFile" type="file" accept=".zip" required />
                </div>
              </div>
              <div className="actions">
                <button type="submit" className="button">上传并建档</button>
              </div>
            </form>
          )}
        </article>
      </section>

      <section className="table-card">
        <h2>商品列表</h2>
        {!products.length ? (
          <div className="empty-state">还没有商品。上传一个最新采集的商品 ZIP 之后这里会出现记录。</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>商品</th>
                  <th>分类</th>
                  <th>SKU</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.title}</strong>
                      <div className="muted">Offer ID：{product.offerId}</div>
                      <div className="muted">上传时间：{new Date(product.createdAt).toLocaleString("zh-CN")}</div>
                    </td>
                    <td>
                      <div>{product.categoryName}</div>
                      <div className="muted">{product.categoryCode}</div>
                    </td>
                    <td>
                      <div>{product.skuCount} 个 SKU</div>
                    </td>
                    <td>
                      <div className={`status ${product.isListed ? "live" : "idle"}`}>{product.isListed ? "已上架" : "未上架"}</div>
                      <div className={`status ${product.status === "error" ? "warn" : "success"}`}>{product.status === "error" ? "导出异常" : "正常"}</div>
                      {product.lastError ? <div className="muted">最近错误：{product.lastError}</div> : null}
                      <div className="actions" style={{ marginTop: 10 }}>
                        <form action={`/api/products/${product.id}/listed`} method="post">
                          <input type="hidden" name="isListed" value={product.isListed ? "0" : "1"} />
                          <button type="submit" className={product.isListed ? "button-danger" : "button-secondary"}>
                            {product.isListed ? "标记为未上架" : "标记为已上架"}
                          </button>
                        </form>
                        <form action={`/api/products/${product.id}`} method="post">
                          <button type="submit" className="button-danger" name="_method" value="delete">
                            删除商品
                          </button>
                        </form>
                      </div>
                    </td>
                    <td>
                      <div className="actions">
                        <Link href={`/products/${product.id}`} className="button-secondary">详情</Link>
                      </div>
                      {product.lastExportedAt ? <div className="muted">上次导出：{new Date(product.lastExportedAt).toLocaleString("zh-CN")}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}