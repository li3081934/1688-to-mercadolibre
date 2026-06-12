"use client";

import { useCallback, useEffect, useState } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type AuthStatus = {
  authenticated: boolean;
  authUrl?: string;
  siteId?: string;
  nickname?: string;
};

type Category = {
  id: string;
  name: string;
  total_items_in_this_category?: number;
  children?: Category[];
};

type ListingResult = {
  mlItemId: string;
  siteItems: Array<{ site_id: string; item_id: string }>;
  title: string;
  price: number;
};

type Props = {
  productId: string;
  defaultTitle: string;
  defaultPrice: string;
  sharedImageCount: number;
};

export default function MLListPanel({
  productId,
  defaultTitle,
  defaultPrice,
  sharedImageCount,
}: Props) {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [catBreadcrumb, setCatBreadcrumb] = useState<Category[]>([]);
  const [currentLevelCats, setCurrentLevelCats] = useState<Category[] | null>(
    null,
  );
  const [catLoading, setCatLoading] = useState(false);

  const [selectedCategory, setSelectedCategory] =
    useState<Category | null>(null);

  const [editTitle, setEditTitle] = useState(defaultTitle);
  const [editPrice, setEditPrice] = useState(defaultPrice);

  const [listing, setListing] = useState(false);
  const [result, setResult] = useState<ListingResult | null>(null);

  const checkAuth = useCallback(async () => {
    setAuthLoading(true);
    try {
      const res = await fetch("/api/mercadolibre/auth");
      const data = await res.json();
      setAuth(data);
    } catch {
      setAuth({ authenticated: false });
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const fetchTopCategories = async () => {
    if (!auth?.siteId) return;
    setCatLoading(true);
    setSelectedCategory(null);
    setCatBreadcrumb([]);
    try {
      const res = await fetch(
        `/api/mercadolibre/categories?siteId=${auth.siteId}`,
      );
      const data = await res.json();
      if (data.success) {
        setCurrentLevelCats(data.data);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("查询分类失败。");
    } finally {
      setCatLoading(false);
    }
  };

  const drillIntoCategory = async (cat: Category) => {
    if (cat.children && cat.children.length > 0) {
      setCatBreadcrumb((prev) => [...prev, cat]);
      setCurrentLevelCats(cat.children!);
    } else {
      setSelectedCategory(cat);
    }
  };

  const loadCategoryDetail = async (catId: string, catName: string) => {
    if (!auth?.siteId) return;
    setCatLoading(true);
    try {
      const res = await fetch(
        `/api/mercadolibre/categories?siteId=${auth.siteId}&categoryId=${catId}`,
      );
      const data = await res.json();
      if (data.success) {
        const cat = data.data as Category;
        if (cat.children && cat.children.length > 0) {
          setCatBreadcrumb((prev) => [...prev, { id: catId, name: catName }]);
          setCurrentLevelCats(cat.children!);
        } else {
          setSelectedCategory(cat);
        }
      }
    } catch {
      toast.error("加载分类详情失败。");
    } finally {
      setCatLoading(false);
    }
  };

  const goBack = () => {
    if (catBreadcrumb.length === 0) {
      setCurrentLevelCats(null);
      return;
    }
    const newBreadcrumb = catBreadcrumb.slice(0, -1);
    setCatBreadcrumb(newBreadcrumb);

    if (newBreadcrumb.length === 0) {
      fetchTopCategories();
    }
  };

  const handleList = async () => {
    if (!selectedCategory) return;
    setListing(true);
    setResult(null);

    try {
      const res = await fetch("/api/mercadolibre/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          mlCategoryId: selectedCategory.id,
          title: editTitle !== defaultTitle ? editTitle : undefined,
          price:
            editPrice !== defaultPrice ? Number(editPrice) : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        toast.success("商品已成功刊登到美客多！");
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("刊登请求失败。");
    } finally {
      setListing(false);
    }
  };

  const renderAuthSection = () => {
    if (authLoading)
      return (
        <p className="text-sm text-muted-foreground">检查认证状态...</p>
      );
    if (!auth?.authenticated) {
      return (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            尚未连接美客多账号。
          </p>
          {auth?.authUrl ? (
            <a
              href={auth.authUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline">登录美客多</Button>
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">
              请先在环境变量中设置 ML_APP_ID 和 ML_CLIENT_SECRET。
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            完成授权后在{" "}
            <a
              href="/mercadolibre"
              className="underline underline-offset-2"
            >
              美客多集成页面
            </a>{" "}
            查看认证状态。
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="font-medium text-muted-foreground">站点</dt>
          <dd>{auth.siteId}</dd>
          <dt className="font-medium text-muted-foreground">账号</dt>
          <dd>{auth.nickname || auth.siteId}</dd>
        </dl>

        <div className="flex flex-col gap-2">
          <Label>ML 分类</Label>
          {selectedCategory ? (
            <div className="flex flex-col gap-2">
              <Badge variant="default">
                {selectedCategory.name} ({selectedCategory.id})
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCategory(null)}
              >
                重新选择
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {!currentLevelCats && !catLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchTopCategories}
                  disabled={catLoading}
                >
                  加载分类列表
                </Button>
              )}

              {catLoading && (
                <p className="text-sm text-muted-foreground">
                  加载分类中...
                </p>
              )}

              {currentLevelCats && !catLoading ? (
                <div className="flex flex-col gap-2">
                  {catBreadcrumb.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goBack}
                      >
                        ← 返回
                      </Button>
                      {catBreadcrumb.map((bc, i) => (
                        <span
                          key={bc.id}
                          className="text-xs text-muted-foreground"
                        >
                          {bc.name}
                          {i < catBreadcrumb.length - 1 ? " / " : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="max-h-64 overflow-y-auto rounded-lg border bg-background p-1.5">
                    {currentLevelCats.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => drillIntoCategory(cat)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        <span>
                          <span className="font-medium">{cat.name}</span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({cat.id})
                          </span>
                        </span>
                        {cat.children && cat.children.length > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            ▶ {cat.children.length} 子分类
                          </span>
                        ) : (
                          <span className="text-xs text-primary">选择</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="ml-title">刊登标题</Label>
          <Input
            id="ml-title"
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground">
            {editTitle.length}/60 字符 — ML 标题限 60 字符
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="ml-price">价格</Label>
          <Input
            id="ml-price"
            type="number"
            step="0.01"
            min="0"
            value={editPrice}
            onChange={(e) => setEditPrice(e.target.value)}
          />
        </div>

        <div className="text-sm text-muted-foreground">
          图片数量：{sharedImageCount} 张（将上传最多 10 张）
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handleList}
            disabled={!selectedCategory || listing}
          >
            {listing ? "刊登中..." : "提交刊登到美客多"}
          </Button>
          {selectedCategory && (
            <span className="text-xs text-muted-foreground">
              目标分类：{selectedCategory.name}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Mercado Libre Listing
        </p>
        <h2 className="text-xl font-semibold">刊登到美客多</h2>
        <p className="text-sm text-muted-foreground">
          将商品直接刊登到 Mercado Libre 指定分类下。
        </p>
      </div>

      {result ? (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="font-medium text-muted-foreground">
              ML Item ID
            </dt>
            <dd>{result.mlItemId}</dd>
            <dt className="font-medium text-muted-foreground">标题</dt>
            <dd>{result.title}</dd>
            <dt className="font-medium text-muted-foreground">
              价格 (USD)
            </dt>
            <dd>${result.price}</dd>
            <dt className="font-medium text-muted-foreground">刊登站点</dt>
            <dd>
              {result.siteItems.map((s) => s.site_id).join(", ")}
            </dd>
            {result.siteItems.map((si) => (
              <span key={si.site_id}>
                <dt className="font-medium text-muted-foreground">
                  {si.site_id} 链接
                </dt>
                <dd>
                  <a
                    href={`https://www.mercadolibre.com.ar/items/${si.item_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    {si.item_id}
                  </a>
                </dd>
              </span>
            ))}
          </dl>
          <div>
            <Button
              variant="outline"
              onClick={() => {
                setResult(null);
                setSelectedCategory(null);
                setCurrentLevelCats(null);
              }}
            >
              刊登下一个商品
            </Button>
          </div>
        </div>
      ) : (
        renderAuthSection()
      )}
    </div>
  );
}
