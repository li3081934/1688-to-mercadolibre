import Link from "next/link";

export default function HomePage() {
  return (
    <main className="grid">
      <section className="panel">
        <p className="eyebrow">Local Workflow</p>
        <h1 className="headline">把第二步从一次性脚本改成分类驱动的管理系统</h1>
        <p className="muted">
          每个分类单独维护名称、Excel 模板和 mapper JS。商品上传 ZIP 时选择分类，系统自动解压建档，导出时再按分类规则生成 Excel。
        </p>
        <div className="actions">
          <Link href="/categories" className="button">
            进入分类管理
          </Link>
          <Link href="/products" className="button-secondary">
            进入商品管理
          </Link>
        </div>
      </section>

      <section className="grid-2">
        <article className="panel">
          <h2>模块一：商品分类管理</h2>
          <p className="muted">配置分类名称、模板工作表、Excel 模板文件和 mapper JS 文件。</p>
        </article>
        <article className="panel">
          <h2>模块二：商品管理</h2>
          <p className="muted">上传导出的 ZIP，选择分类，默认标记为未上架，并提供单商品导出 Excel 按钮。</p>
        </article>
      </section>
    </main>
  );
}