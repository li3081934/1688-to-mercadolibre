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

type AccountInfo = {
  mlUserId: number;
  nickname: string;
  siteId: string;
  isCurrent: boolean;
  isTestUser: boolean;
  hasToken: boolean;
  password?: string;
};

type AuthStatus = {
  authenticated: boolean;
  authUrl?: string;
  authUrlLogin?: string;
  authUrlTest?: string;
  mlUserId?: number;
  siteId?: string;
  nickname?: string;
  tokenExpiresAt?: string;
  tags?: string[];
  forceUserProduct?: boolean;
  isUserProductSeller?: boolean;
  isTestUser?: boolean;
  accounts: AccountInfo[];
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
  const [fetchingTags, setFetchingTags] = useState(false);
  const [forceUP, setForceUP] = useState(false);
  const [togglingForceUP, setTogglingForceUP] = useState(false);
  const [tagsResult, setTagsResult] = useState<{
    parentTags: string[];
    allTags: string[];
    isUserProductSeller: boolean;
    userType?: string;
  } | null>(null);
  const [creatingTestUser, setCreatingTestUser] = useState(false);
  const [testSiteId, setTestSiteId] = useState("MLA");
  const [createdTestUser, setCreatedTestUser] = useState<{
    mlUserId: number;
    nickname: string;
    password: string;
    siteId: string;
  } | null>(null);
  const [switchingAccount, setSwitchingAccount] = useState<number | null>(null);
  const [unbindingAccount, setUnbindingAccount] = useState<number | null>(null);

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
      setForceUP(data.forceUserProduct ?? false);
    } catch {
      setAuth({ authenticated: false, accounts: [] } as AuthStatus);
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

  const handleFetchTags = async () => {
    setFetchingTags(true);
    setTagsResult(null);
    try {
      const res = await fetch("/api/mercadolibre/fetch-tags");
      const data = await res.json();
      if (data.success) {
        setTagsResult(data.data);
        toast.success("用户标签获取成功");
      } else {
        toast.error(data.message || "获取失败");
      }
    } catch {
      toast.error("获取用户标签失败");
    } finally {
      setFetchingTags(false);
    }
  };

  const handleSwitchAccount = async (mlUserId: number) => {
    setSwitchingAccount(mlUserId);
    try {
      const res = await fetch("/api/mercadolibre/switch-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mlUserId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("已切换账号");
        setCreatedTestUser(null);
        checkAuth();
      } else {
        toast.error(data.message || "切换失败");
      }
    } catch {
      toast.error("切换账号失败");
    } finally {
      setSwitchingAccount(null);
    }
  };

  const handleUnbindAccount = async (mlUserId: number) => {
    if (!window.confirm("确定要解绑该账号吗？解绑后可重新绑定新账号。")) return;
    setUnbindingAccount(mlUserId);
    try {
      const res = await fetch("/api/mercadolibre/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mlUserId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("账号已解绑");
        setCreatedTestUser(null);
        checkAuth();
      } else {
        toast.error(data.message || "解绑失败");
      }
    } catch {
      toast.error("解绑账号失败");
    } finally {
      setUnbindingAccount(null);
    }
  };

  const handleCreateTestUser = async () => {
    setCreatingTestUser(true);
    setCreatedTestUser(null);
    try {
      const res = await fetch("/api/mercadolibre/create-test-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: testSiteId }),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedTestUser(data.data);
        toast.success("测试账号创建成功");
        checkAuth();
      } else {
        toast.error(data.message || "创建失败");
      }
    } catch {
      toast.error("创建测试账号失败");
    } finally {
      setCreatingTestUser(false);
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
            ) : auth?.mlUserId ? (
              <div className="flex flex-col gap-4">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="font-medium text-muted-foreground">
                    用户 ID
                  </dt>
                  <dd>
                    {auth.mlUserId}
                    {auth.isTestUser ? (
                      <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        测试号
                      </span>
                    ) : null}
                  </dd>
                  <dt className="font-medium text-muted-foreground">
                    昵称
                  </dt>
                  <dd>{auth.nickname}</dd>
                  <dt className="font-medium text-muted-foreground">
                    站点
                  </dt>
                  <dd>{auth.siteId}</dd>
                  {auth.authenticated ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <dt className="font-medium text-muted-foreground">
                        状态
                      </dt>
                      <dd>
                        <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                          未授权
                        </span>
                      </dd>
                    </>
                  )}
                </dl>

                {auth.authenticated ? (
                  <>
                    <div>
                      <a href={auth.authUrl}>
                        <Button variant="outline">重新授权</Button>
                      </a>
                      <Button
                        onClick={handleFetchTags}
                        disabled={fetchingTags}
                        variant="secondary"
                        className="ml-2"
                      >
                        {fetchingTags ? "获取中..." : "检查用户标签"}
                      </Button>
                      <span className="ml-2 inline-flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">强制 UP 模式</span>
                        <button
                          onClick={async () => {
                            setTogglingForceUP(true);
                            try {
                              const res = await fetch("/api/mercadolibre/toggle-force-up", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ force: !forceUP }),
                              });
                              const data = await res.json();
                              if (data.success) {
                                setForceUP(data.forceUserProduct);
                              }
                            } catch {
                              // ignore
                            } finally {
                              setTogglingForceUP(false);
                            }
                          }}
                          disabled={togglingForceUP}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            forceUP ? "bg-yellow-500" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`inline-block size-3.5 rounded-full bg-white transition-transform ${
                              forceUP ? "translate-x-4" : "translate-x-1"
                            }`}
                          />
                        </button>
                        <span className="ml-1 text-xs text-muted-foreground">
                          {forceUP ? "开" : "关"}
                        </span>
                      </span>
                    </div>

                    {tagsResult ? (
                      <div className="rounded-lg border p-3 space-y-3">
                        <div>
                          <h4 className="text-sm font-medium mb-2">
                            用户标签
                            {tagsResult.isUserProductSeller ? (
                              <span className="ml-2 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                                user_product_seller
                              </span>
                            ) : null}
                          </h4>

                          <p className="text-xs text-muted-foreground mb-1">
                            CBT 父账号标签:
                          </p>
                          {tagsResult.parentTags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {tagsResult.parentTags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">无</p>
                          )}

                          <p className="text-xs text-muted-foreground mt-2 mb-1">
                            含子站点合并标签:
                          </p>
                          {tagsResult.allTags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {tagsResult.allTags.map((tag) => {
                                const isChildOnly = !tagsResult.parentTags.includes(tag);
                                return (
                                  <span
                                    key={tag}
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                      isChildOnly
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-secondary text-secondary-foreground"
                                    }`}
                                    title={isChildOnly ? "仅子站点有" : undefined}
                                  >
                                    {tag}
                                    {isChildOnly ? " *" : null}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">无</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="flex gap-2">
                    <a href={auth.authUrlTest || auth.authUrlLogin || auth.authUrl}>
                      <Button>授权此账号</Button>
                    </a>
                  </div>
                )}

                {auth.accounts.length > 0 ? (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-2">所有账号</h4>
                    <div className="flex flex-col gap-2">
                      {auth.accounts.map((acc) => (
                        <div
                          key={acc.mlUserId}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                            acc.isCurrent ? "bg-muted" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate font-medium">
                              {acc.nickname}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              ({acc.siteId})
                            </span>
                            {acc.isTestUser ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 shrink-0">
                                测试
                              </span>
                            ) : null}
                            {!acc.hasToken ? (
                              <span className="inline-flex items-center rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-800 shrink-0">
                                未授权
                              </span>
                            ) : null}
                            {acc.isCurrent ? (
                              <span className="inline-flex items-center rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800 shrink-0">
                                当前
                              </span>
                            ) : null}
                            {acc.password ? (
                              <code className="text-xs text-muted-foreground shrink-0 font-mono">
                                密码: {acc.password}
                              </code>
                            ) : null}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {!acc.isCurrent ? (
                              <>
                                {!acc.hasToken ? (
                                  <a href={acc.isTestUser ? (auth.authUrlTest || auth.authUrlLogin || auth.authUrl) : (auth.authUrlLogin || auth.authUrl)}>
                                    <Button variant="outline" size="sm">
                                      授权
                                    </Button>
                                  </a>
                                ) : null}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSwitchAccount(acc.mlUserId)}
                                  disabled={switchingAccount === acc.mlUserId}
                                >
                                  {switchingAccount === acc.mlUserId ? "切换中..." : "切换"}
                                </Button>
                              </>
                            ) : null}
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleUnbindAccount(acc.mlUserId)}
                              disabled={unbindingAccount === acc.mlUserId}
                            >
                              {unbindingAccount === acc.mlUserId ? "解绑中..." : "解绑"}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-2">创建测试账号</h4>
                  <div className="flex items-end gap-2">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="test-site">站点</Label>
                      <Select
                        value={testSiteId}
                        onValueChange={(v) => setTestSiteId(v)}
                      >
                        <SelectTrigger id="test-site" className="w-36">
                          <SelectValue placeholder="选择站点" />
                        </SelectTrigger>
                        <SelectContent>
                          {SITES.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleCreateTestUser}
                      disabled={creatingTestUser}
                    >
                      {creatingTestUser ? "创建中..." : "创建测试账号"}
                    </Button>
                  </div>
                  {createdTestUser ? (
                    <Alert className="mt-3">
                      <AlertDescription>
                        <div className="text-sm space-y-1">
                          <p>
                            <span className="font-medium">昵称:</span>{" "}
                            {createdTestUser.nickname}
                          </p>
                          <p>
                            <span className="font-medium">密码:</span>{" "}
                            {createdTestUser.password}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            请保存好密码，授权时需要使用此密码登录美客多。
                          </p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : null}
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
