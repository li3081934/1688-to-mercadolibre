"use client";

import { useCallback, useEffect, useState } from "react";

type AuthStatus = {
  authenticated: boolean;
  authUrl?: string;
  mlUserId?: number;
  siteId?: string;
  nickname?: string;
  tokenExpiresAt?: string;
};

type Category = {
  id: string;
  name: string;
  total_items_in_this_category?: number;
  children?: Category[];
};

const SITES = [
  { id: "MLA", name: "Argentina" },
  { id: "MLB", name: "Brazil" },
  { id: "MLM", name: "Mexico" },
  { id: "MLC", name: "Chile" },
  { id: "MCO", name: "Colombia" },
  { id: "MLU", name: "Uruguay" },
  { id: "MLP", name: "Peru" },
];

export default function MercadoLibrePage() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [siteId, setSiteId] = useState("MLA");
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [catLoading, setCatLoading] = useState(false);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [catDetailLoading, setCatDetailLoading] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);

  // 读取 URL 中的消息
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const msg = params.get("message");
    if (status && msg) {
      setMessage({ type: status, text: msg });
      // 清除 URL 参数
      window.history.replaceState({}, "", "/mercadolibre");
    }
  }, []);

  // 检查认证状态
  const checkAuth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mercadolibre/auth");
      const data = await res.json();
      setAuth(data);
    } catch {
      setAuth({ authenticated: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 查询分类
  const fetchCategories = async () => {
    setCatLoading(true);
    setCategories(null);
    setSelectedCat(null);
    try {
      const res = await fetch(`/api/mercadolibre/categories?siteId=${siteId}`);
      const data = await res.json();
      if (data.success) {
        setCategories(data.data);
      } else {
        setMessage({ type: "error", text: data.message });
      }
    } catch {
      setMessage({ type: "error", text: "查询分类失败。" });
    } finally {
      setCatLoading(false);
    }
  };

  // 查询分类详情（子分类）
  const fetchCategoryDetail = async (catId: string) => {
    setCatDetailLoading(true);
    setSelectedCat(null);
    try {
      const res = await fetch(`/api/mercadolibre/categories?siteId=${siteId}&categoryId=${catId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedCat(data.data);
      }
    } catch {
      // ignore
    } finally {
      setCatDetailLoading(false);
    }
  };

  return (
    <main className="grid">
      <section className="grid two">
        <article className="panel stack">
          <div>
            <p className="eyebrow">Mercado Libre</p>
            <h1>美客多集成</h1>
            <p className="muted">连接美客多开发者 API，实现商品自动刊登。</p>
          </div>

          {message ? (
            <div className={`message ${message.type === "error" ? "error" : "success"}`}>
              {message.text}
            </div>
          ) : null}
        </article>

        <article className="panel stack">
          <h2>账号连接</h2>
          {loading ? (
            <p className="muted">检查中...</p>
          ) : auth?.authenticated ? (
            <div className="stack">
              <div className="meta-list">
                <div className="meta-row">
                  <span className="meta-label">用户 ID</span>
                  <span>{auth.mlUserId}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">昵称</span>
                  <span>{auth.nickname}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">站点</span>
                  <span>{auth.siteId}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Token 过期</span>
                  <span>{auth.tokenExpiresAt ? new Date(auth.tokenExpiresAt).toLocaleString("zh-CN") : "-"}</span>
                </div>
              </div>
              <div className="actions">
                <a href={auth.authUrl} className="button-secondary">重新授权</a>
              </div>
            </div>
          ) : (
            <div className="stack">
              <p className="muted">尚未连接美客多账号。</p>
              {auth?.authUrl ? (
                <a href={auth.authUrl} className="button">
                  登录美客多
                </a>
              ) : (
                <p className="muted">请先设置 ML_APP_ID 和 ML_CLIENT_SECRET 环境变量。</p>
              )}
            </div>
          )}
        </article>
      </section>

      {auth?.authenticated ? (
        <section className="panel stack">
          <h2>分类查询</h2>
          <p className="muted">选择站点，查询美客多商品分类树。</p>
          <div className="form-grid single">
            <div className="field">
              <label htmlFor="site">站点</label>
              <select id="site" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                {SITES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="actions">
            <button className="button" onClick={fetchCategories} disabled={catLoading}>
              {catLoading ? "查询中..." : "查询顶级分类"}
            </button>
          </div>

          <div className="grid two" style={{ marginTop: 14 }}>
            {categories ? (
              <div className="stack">
                <h3>顶级分类（共 {categories.length} 个）</h3>
                <div
                  style={{
                    maxHeight: 400,
                    overflowY: "auto",
                    border: "1px solid var(--line)",
                    borderRadius: 12,
                    padding: 8,
                    background: "white",
                  }}
                >
                  {categories.map((cat) => (
                    <div key={cat.id}>
                      <button
                        onClick={() => fetchCategoryDetail(cat.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "6px 8px",
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          borderRadius: 8,
                          color: "var(--ink)",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-strong)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        <strong>{cat.name}</strong>
                        <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                          ({cat.id})
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {catDetailLoading ? <p className="muted">加载分类详情...</p> : null}

            {selectedCat ? (
              <div className="stack">
                <h3>{selectedCat.name}</h3>
                <div className="meta-list">
                  <div className="meta-row">
                    <span className="meta-label">分类 ID</span>
                    <span>{selectedCat.id}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">商品数量</span>
                    <span>{selectedCat.total_items_in_this_category?.toLocaleString()}</span>
                  </div>
                </div>
                {selectedCat.children?.length ? (
                  <>
                    <h4>子分类（{selectedCat.children.length} 个）</h4>
                    <div
                      style={{
                        maxHeight: 300,
                        overflowY: "auto",
                        border: "1px solid var(--line)",
                        borderRadius: 12,
                        padding: 8,
                        background: "white",
                      }}
                    >
                      {selectedCat.children.map((child) => (
                        <div key={child.id}>
                          <button
                            onClick={() => fetchCategoryDetail(child.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "6px 8px",
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              borderRadius: 8,
                              color: "var(--ink)",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-strong)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                          >
                            <strong>{child.name}</strong>
                            <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                              ({child.id})
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}