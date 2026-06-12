"use client";

import { useCallback, useEffect, useState } from "react";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  { id: "MLB", name: "Brazil" },
  { id: "MLM", name: "Mexico" },
  { id: "MLC", name: "Chile" },
  { id: "MCO", name: "Colombia" },
];

export default function MercadoLibrePage() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [siteId, setSiteId] = useState("MLA");
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [catLoading, setCatLoading] = useState(false);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [catDetailLoading, setCatDetailLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: string;
    text: string;
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const msg = params.get("message");
    if (status && msg) {
      setMessage({ type: status, text: msg });
      window.history.replaceState({}, "", "/mercadolibre");
    }
  }, []);

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

  const fetchCategories = async () => {
    setCatLoading(true);
    setCategories(null);
    setSelectedCat(null);
    try {
      const res = await fetch(
        `/api/mercadolibre/categories?siteId=${siteId}`,
      );
      const data = await res.json();
      if (data.success) {
        setCategories(data.data);
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("查询分类失败。");
    } finally {
      setCatLoading(false);
    }
  };

  const fetchCategoryDetail = async (catId: string) => {
    setCatDetailLoading(true);
    setSelectedCat(null);
    try {
      const res = await fetch(
        `/api/mercadolibre/categories?siteId=${siteId}&categoryId=${catId}`,
      );
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
    <main className="flex flex-col gap-4">
      <div className="grid-2">
        <Card>
          <CardHeader>
            <CardDescription>Mercado Libre</CardDescription>
            <CardTitle>美客多集成</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              连接美客多开发者 API，实现商品自动刊登。
            </p>
            {message ? (
              <Alert
                variant={
                  message.type === "error" ? "destructive" : "default"
                }
                className="mt-4"
              >
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>账号连接</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">检查中...</p>
            ) : auth?.authenticated ? (
              <div className="flex flex-col gap-4">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="font-medium text-muted-foreground">
                    用户 ID
                  </dt>
                  <dd>{auth.mlUserId}</dd>
                  <dt className="font-medium text-muted-foreground">
                    昵称
                  </dt>
                  <dd>{auth.nickname}</dd>
                  <dt className="font-medium text-muted-foreground">
                    站点
                  </dt>
                  <dd>{auth.siteId}</dd>
                  <dt className="font-medium text-muted-foreground">
                    Token 过期
                  </dt>
                  <dd>
                    {auth.tokenExpiresAt
                      ? new Date(auth.tokenExpiresAt).toLocaleString(
                          "zh-CN",
                        )
                      : "-"}
                  </dd>
                </dl>
                <div>
                  <a href={auth.authUrl}>
                    <Button variant="outline">重新授权</Button>
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  尚未连接美客多账号。
                </p>
                {auth?.authUrl ? (
                  <a href={auth.authUrl}>
                    <Button>登录美客多</Button>
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    请先设置 ML_APP_ID 和 ML_CLIENT_SECRET 环境变量。
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {auth?.authenticated ? (
        <Card>
          <CardHeader>
            <CardTitle>分类查询</CardTitle>
            <CardDescription>
              选择站点，查询美客多商品分类树。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Label htmlFor="site">站点</Label>
              <Select
                value={siteId}
                onValueChange={(v) => setSiteId(v)}
              >
                <SelectTrigger id="site" className="w-48">
                  <SelectValue placeholder="选择站点" />
                </SelectTrigger>
                <SelectContent>
                  {SITES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4">
              <Button
                onClick={fetchCategories}
                disabled={catLoading}
              >
                {catLoading ? "查询中..." : "查询顶级分类"}
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {categories ? (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">
                    顶级分类（共 {categories.length} 个）
                  </h3>
                  <div className="max-h-96 overflow-y-auto rounded-lg border bg-background p-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => fetchCategoryDetail(cat.id)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        <span>
                          <span className="font-medium">
                            {cat.name}
                          </span>
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({cat.id})
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {catDetailLoading ? (
                <p className="text-sm text-muted-foreground">
                  加载分类详情...
                </p>
              ) : null}

              {selectedCat ? (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium">
                    {selectedCat.name}
                  </h3>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                    <dt className="font-medium text-muted-foreground">
                      分类 ID
                    </dt>
                    <dd>{selectedCat.id}</dd>
                    <dt className="font-medium text-muted-foreground">
                      商品数量
                    </dt>
                    <dd>
                      {selectedCat.total_items_in_this_category?.toLocaleString()}
                    </dd>
                  </dl>
                  {selectedCat.children?.length ? (
                    <>
                      <h4 className="text-sm font-medium">
                        子分类（{selectedCat.children.length} 个）
                      </h4>
                      <div className="max-h-72 overflow-y-auto rounded-lg border bg-background p-2">
                        {selectedCat.children.map((child) => (
                          <button
                            key={child.id}
                            onClick={() =>
                              fetchCategoryDetail(child.id)
                            }
                            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          >
                            <span>
                              <span className="font-medium">
                                {child.name}
                              </span>
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({child.id})
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
