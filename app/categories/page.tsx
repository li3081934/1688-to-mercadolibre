import Link from "next/link";

import { listCategories } from "@/lib/db";
import { toRelativeStoragePath } from "@/lib/storage";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ status?: string; message?: string }>;
};

export default async function CategoriesPage({ searchParams }: PageProps) {
  const categories = listCategories();
  const params = (await searchParams) || {};

  return (
    <main className="grid">
      <section className="grid two">
        <article className="panel stack">
          <div>
            <p className="eyebrow">Module 01</p>
            <h1>商品分类管理</h1>
            <p className="muted">每个分类维护自己的模板和 mapper。导出时系统只调用该分类的固定函数接口。</p>
          </div>
          <p className="muted">
            示例 mapper 可参考 <code>docs/category-mapper.example.cjs</code>，上传后系统会校验是否导出 <code>mapProductToWorkbook</code>。
          </p>
          {params.message ? <div className={`message ${params.status === "error" ? "error" : "success"}`}>{params.message}</div> : null}
        </article>

        <article className="panel stack">
          <h2>新增分类</h2>
          <form action="/api/categories" method="post" encType="multipart/form-data" className="stack">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="code">分类编码</label>
                <input id="code" name="code" placeholder="phone-case" required />
              </div>
              <div className="field">
                <label htmlFor="name">分类名称</label>
                <input id="name" name="name" placeholder="手机壳" required />
              </div>
              <div className="field full">
                <label htmlFor="sheetName">模板工作表名</label>
                <input id="sheetName" name="sheetName" placeholder="Screwdrivers" required />
              </div>
              <div className="field">
                <label htmlFor="templateFile">Excel 模板</label>
                <input id="templateFile" name="templateFile" type="file" accept=".xlsx,.xlsm,.xls" required />
              </div>
              <div className="field">
                <label htmlFor="mapperFile">mapper JS</label>
                <input id="mapperFile" name="mapperFile" type="file" accept=".js,.cjs,.mjs" required />
              </div>
            </div>
            <div className="actions">
              <button type="submit" className="button">创建分类</button>
            </div>
          </form>
        </article>
      </section>

      <section className="table-card">
        <h2>已配置分类</h2>
        {!categories.length ? (
          <div className="empty-state">还没有分类。先上传一个模板和 mapper 文件。</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>分类</th>
                  <th>文件</th>
                  <th>状态</th>
                  <th>更新</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <strong>{category.name}</strong>
                      <div className="muted">编码：{category.code}</div>
                      <div className="muted">工作表：{category.sheetName}</div>
                    </td>
                    <td>
                      <div className="muted">模板：{toRelativeStoragePath(category.templatePath)}</div>
                      <div className="muted">Mapper：{toRelativeStoragePath(category.mapperPath)}</div>
                    </td>
                    <td>
                      <span className={`badge ${category.isActive ? "success" : "warn"}`}>{category.isActive ? "启用" : "停用"}</span>
                    </td>
                    <td>
                      <form action={`/api/categories/${category.id}`} method="post" encType="multipart/form-data" className="stack">
                        <div className="inline-form">
                          <div className="field">
                            <label>名称</label>
                            <input name="name" defaultValue={category.name} required />
                          </div>
                          <div className="field">
                            <label>编码</label>
                            <input name="code" defaultValue={category.code} required />
                          </div>
                          <div className="field">
                            <label>工作表</label>
                            <input name="sheetName" defaultValue={category.sheetName} required />
                          </div>
                          <div className="field">
                            <label>状态</label>
                            <select name="isActive" defaultValue={String(category.isActive)}>
                              <option value="1">启用</option>
                              <option value="0">停用</option>
                            </select>
                          </div>
                          <div className="field">
                            <label>替换模板</label>
                            <input name="templateFile" type="file" accept=".xlsx,.xlsm,.xls" />
                          </div>
                          <div className="field">
                            <label>替换 mapper</label>
                            <input name="mapperFile" type="file" accept=".js,.cjs,.mjs" />
                          </div>
                        </div>
                        <div className="actions">
                          <button type="submit" className="button-secondary">保存修改</button>
                          <Link href="/products" className="button-secondary">去上传商品</Link>
                          <button
                            type="submit"
                            formAction={`/api/categories/${category.id}`}
                            formMethod="post"
                            className="button-danger"
                            name="_method"
                            value="delete"
                          >
                            删除分类
                          </button>
                        </div>
                      </form>
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