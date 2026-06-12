"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SkuOverride = {
  title: string;
  price: string;
  quantity: string;
  pictureIds: string[];
  attributes: Array<{ id: string; value_name: string }>;
};

type CategoryAttr = {
  id: string;
  name: string;
  value_type: string;
  tags?: Record<string, unknown>;
  values?: Array<{ id: string; name: string }> | null;
  hint?: string;
};

type ProductData = {
  id: string;
  title: string;
  offerId: string;
  skuCount: number;
  isListed: number;
  mlItemId: string | null;
  status: string;
  lastError: string | null;
};

type SkuItem = {
  key: string;
  skuId: string;
  label: string;
  imageUrl: string | null;
};

type ProductBundle = {
  mainProduct: {
    product: {
      title?: string;
      price?: string;
      description?: string;
      images?: string[];
      companyName?: string;
    } | null;
    source: Record<string, unknown> | null;
    attributes: Array<{ label: string; value: string }> | null;
    packageInfo: {
      tables?: Array<{
        title?: string;
        headers?: string[];
        rows: string[][];
      }>;
    } | null;
    detail: { text?: string } | null;
  };
  skuItems: SkuItem[];
  skuProducts: Array<Record<string, unknown>>;
  skuPackageInfo: Record<string, Record<string, string> | null>;
  localImages: string[];
  skuLocalImages: Record<string, string[]>;
};

type PredictedCategory = {
  domain_id: string;
  domain_name: string;
  category_id: string;
  category_name: string;
  attributes?: Array<{ id: string; value_id?: string; value_name: string }>;
};

type PublishResult = {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    skuKey: string;
    skuLabel: string;
    success: boolean;
    mlItemId?: string;
    error?: string;
  }>;
};

function CollapsiblePanel({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-lg font-semibold"
      >
        {title}
        <span
          className={`text-sm transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {open ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}

export default function PublishPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<ProductData | null>(null);
  const [bundle, setBundle] = useState<ProductBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [mlCategoryId, setMlCategoryId] = useState("");
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [siteId, setSiteId] = useState("MLM");
  const [catSearch, setCatSearch] = useState("");
  const [catResults, setCatResults] = useState<PredictedCategory[]>([]);
  const [catSearchLoading, setCatSearchLoading] = useState(false);
  const [categoryAttrs, setCategoryAttrs] = useState<CategoryAttr[]>([]);
  const [loadingAttrs, setLoadingAttrs] = useState(false);
  const [skuOverrides, setSkuOverrides] = useState<
    Record<string, SkuOverride>
  >({});
  const [selectedSkuKeys, setSelectedSkuKeys] = useState<Set<string>>(
    new Set(),
  );
  const [result, setResult] = useState<PublishResult | null>(null);

  const [showAttributes, setShowAttributes] = useState(false);
  const [translating, setTranslating] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [collapsedSkus, setCollapsedSkus] = useState<Set<string>>(new Set());
  const [imageViewer, setImageViewer] = useState<{
    images: { url: string; label: string }[];
    index: number;
    sourceIndex: number;
  } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/products/${productId}`).then((r) => r.json()),
      fetch(`/api/products/${productId}/bundle`).then((r) => r.json()),
    ])
      .then(([prodData, bundleData]) => {
        if (prodData.error) {
          toast.error(prodData.error);
          return;
        }
        setProduct(prodData);
        setBundle(bundleData);

        const overrides: Record<string, SkuOverride> = {};
        const baseTitle =
          bundleData.mainProduct?.product?.title || prodData.title || "";
        for (const sku of bundleData.skuItems || []) {
          const skuPrice =
            bundleData.skuProducts?.[0]?.sku?.price || "";
          overrides[sku.key] = {
            title: `${baseTitle} - ${sku.label}`.slice(0, 60),
            price: skuPrice
              ? parseFloat(skuPrice.replace(/[^0-9.]/g, "")).toString()
              : "",
            quantity: "100",
            pictureIds: [],
            attributes: [],
          };
        }
        if (overrides.main) {
          overrides.main.title = baseTitle.slice(0, 60);
          overrides.main.quantity = "100";
          overrides.main.attributes = [];
        }
        setSkuOverrides(overrides);
        setSelectedSkuKeys(new Set(Object.keys(overrides)));
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    fetch("/api/mercadolibre/auth")
      .then((r) => r.json())
      .then((data) => {
        setAuthChecked(true);
        if (data.authenticated) { /* siteId 由用户手动选择，默认墨西哥 */ }
        else if (data.authUrl) setAuthUrl(data.authUrl);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  const handleSearch = useCallback(async () => {
    const query = catSearch.trim();
    if (!query) return;
    setCatSearchLoading(true);
    try {
      const translateRes = await fetch("/api/ai-models/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: query }),
      });
      const translateData = await translateRes.json();
      const translated = translateData.translated || query;
      const res = await fetch(
        `/api/mercadolibre/categories/search?siteId=${siteId}&query=${encodeURIComponent(translated)}`,
      );
      const data = await res.json();
      if (data.success) setCatResults(data.data);
      else toast.error(data.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "搜索分类失败");
    } finally {
      setCatSearchLoading(false);
    }
  }, [catSearch, siteId]);

  const fetchAttributes = useCallback(async () => {
    if (!mlCategoryId) return;
    setLoadingAttrs(true);
    try {
      const res = await fetch(
        `/api/mercadolibre/categories/${mlCategoryId}/attributes`,
      );
      const data = await res.json();
      if (data.success) {
        const attrs = data.data as CategoryAttr[];
        setCategoryAttrs(attrs);

        const requiredIds = new Set(
          attrs
            .filter(
              (a) =>
                a.tags?.catalog_required || a.tags?.required,
            )
            .map((a) => a.id),
        );

        setSkuOverrides((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(next)) {
            next[key] = {
              ...next[key],
              attributes: attrs
                .filter(
                  (a) =>
                    a.id !== "ITEM_CONDITION" &&
                    a.id !== "SELLER_SKU",
                )
                .map((a) => ({
                  id: a.id,
                  value_name: "",
                })),
            };
          }
          return next;
        });
      } else {
        toast.error(data.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "获取属性失败");
    } finally {
      setLoadingAttrs(false);
    }
  }, [mlCategoryId]);

  const [aiFilling, setAiFilling] = useState(false);

  const handleAiFill = useCallback(
    async (skuKey?: string) => {
      if (!categoryAttrs.length || !bundle) return;
      setAiFilling(true);
      try {
        const res = await fetch("/api/ai-models/fill-attributes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attributes: categoryAttrs,
            product: {
              attributes: bundle.mainProduct?.attributes || [],
              packageInfo: (skuKey && bundle.skuPackageInfo?.[skuKey]) || bundle.mainProduct?.packageInfo || null,
            },
            categoryName: selectedCategoryName || "",
          }),
        });
        const data = await res.json();
        if (data.success) {
          const filled = data.data as Record<string, string>;
          setSkuOverrides((prev) => {
            const keys = skuKey
              ? [skuKey]
              : Object.keys(prev);
            const next = { ...prev };
            for (const key of keys) {
              next[key] = {
                ...next[key],
                attributes: categoryAttrs
                  .filter(
                    (a) =>
                      a.id !== "ITEM_CONDITION" &&
                      a.id !== "SELLER_SKU",
                  )
                  .map((a) => ({
                    id: a.id,
                    value_name: filled[a.id] || "",
                  })),
              };
            }
            return next;
          });
        } else {
          toast.error(data.error || "AI 填写失败");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "AI 填写失败");
      } finally {
        setAiFilling(false);
      }
    },
    [categoryAttrs, bundle, product, selectedCategoryName],
  );

  const handleUploadImage = async (
    skuKey: string,
    imageUrl: string,
  ) => {
    setUploadingImage(`${skuKey}:${imageUrl}`);
    try {
      const res = await fetch("/api/mercadolibre/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagePath: imageUrl.replace("/api/storage/", ""),
        }),
      });
      const data = await res.json();
      if (data.success) {
        addPictureId(skuKey, data.data.id);
      } else {
        toast.error(data.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "上传图片失败");
    } finally {
      setUploadingImage(null);
    }
  };

  const handlePublish = async () => {
    if (!mlCategoryId) {
      toast.error("请先选择美客多分类");
      return;
    }
    setPublishing(true);
    setResult(null);

    const skus = Object.entries(skuOverrides)
      .filter(([skuKey]) => selectedSkuKeys.has(skuKey))
      .map(([skuKey, override]) => ({
        skuKey,
        title: override.title || undefined,
        price: override.price
          ? parseFloat(override.price)
          : undefined,
        quantity: override.quantity
          ? parseInt(override.quantity)
          : undefined,
        pictureIds:
          override.pictureIds.length > 0
            ? override.pictureIds
            : undefined,
        attributes: override.attributes.filter(
          (a) => a.value_name.trim(),
        ),
      }));

    try {
      const res = await fetch("/api/mercadolibre/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, mlCategoryId, skus }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        toast.success("刊登完成。");
      }
      else toast.error(data.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "请求失败");
    } finally {
      setPublishing(false);
    }
  };

  const translateTitle = async (skuKey: string) => {
    const text = skuOverrides[skuKey]?.title;
    if (!text) return;
    setTranslating(skuKey);
    try {
      const res = await fetch("/api/ai-models/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.translated) {
        setSkuOverrides((prev) => ({
          ...prev,
          [skuKey]: { ...prev[skuKey], title: data.translated },
        }));
      }
    } catch {
      /* ignore */
    } finally {
      setTranslating(null);
    }
  };

  const addPictureId = (skuKey: string, id: string) => {
    setSkuOverrides((prev) => ({
      ...prev,
      [skuKey]: {
        ...prev[skuKey],
        pictureIds: [...prev[skuKey].pictureIds, id],
      },
    }));
  };

  const removePictureId = (skuKey: string, idx: number) => {
    setSkuOverrides((prev) => ({
      ...prev,
      [skuKey]: {
        ...prev[skuKey],
        pictureIds: prev[skuKey].pictureIds.filter(
          (_, i) => i !== idx,
        ),
      },
    }));
  };

  type ImageEntry = { url: string; label: string };
  const [imageEntries, setImageEntries] = useState<ImageEntry[]>([]);

  useEffect(() => {
    if (!product || !bundle) return;
    const entries: ImageEntry[] = [];
    const local = bundle.localImages || [];
    const items = bundle.skuItems || [];
    for (const url of local) {
      entries.push({ url, label: product.title || "主图" });
    }
    for (const sku of items) {
      for (const url of bundle.skuLocalImages?.[sku.key] || []) {
        entries.push({ url, label: sku.label });
      }
    }
    setImageEntries(entries);
  }, [product, bundle]);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">
        加载商品数据...
      </p>
    );
  }

  if (!product) {
    return null;
  }

  const mainProduct = bundle?.mainProduct;
  const attributes = mainProduct?.attributes || [];
  const localImages = bundle?.localImages || [];
  const skuItems = bundle?.skuItems || [];

  const swapImageAt = (fromIndex: number, toUrl: string) => {
    if (!bundle) return;
    const newBundle = { ...bundle };

    let offset = localImages.length;
    if (fromIndex < offset) {
      const arr = [...(newBundle.localImages || [])];
      arr[fromIndex] = toUrl;
      newBundle.localImages = arr;
    } else {
      let cursor = offset;
      for (const sku of skuItems) {
        const skuImgs = newBundle.skuLocalImages?.[sku.key];
        if (!skuImgs) { cursor += 0; continue; }
        const next = cursor + skuImgs.length;
        if (fromIndex < next) {
          const arr = [...skuImgs];
          arr[fromIndex - cursor] = toUrl;
          newBundle.skuLocalImages = { ...newBundle.skuLocalImages, [sku.key]: arr };
          break;
        }
        cursor = next;
      }
    }

    setBundle(newBundle);
    setImageEntries((prev) => {
      const next = [...prev];
      next[fromIndex] = { ...next[fromIndex], url: toUrl };
      return next;
    });
  };

  return (
    <main className="flex flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold">{product?.title || "商品刊登"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Offer ID: {product?.offerId}
        </p>
        {result ? (
          <div className="mt-4 flex flex-col gap-4">
            <p className="text-sm font-medium">
              刊登完成 — 成功 {result.succeeded}/{result.total} 个 SKU
            </p>
            <div className="flex flex-col gap-2">
              {result.results.map((r) => (
                <div
                  key={r.skuKey}
                  className="flex items-center justify-between border-b py-2 text-sm"
                >
                  <span>{r.skuLabel}</span>
                  {r.success ? (
                    <span className="font-medium text-green-600">
                      ✓ {r.mlItemId}
                    </span>
                  ) : (
                    <span className="font-medium text-destructive">
                      ✗ {r.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() => router.push("/products")}
              >
                返回商品列表
              </Button>
              <Button
                onClick={() => {
                  setResult(null);
                  setMlCategoryId("");
                }}
              >
                继续刊登
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {!result ? (
        <>
          <div className="flex gap-4 items-start">
            <div className="flex flex-col gap-4 flex-1 h-[calc(100vh-120px)] overflow-y-auto pr-2">
              <div className="grid-2">
            <Card>
              <CardHeader>
                <CardTitle>美客多账号</CardTitle>
              </CardHeader>
              <CardContent>
                {!authChecked ? (
                  <p className="text-sm text-muted-foreground">
                    检查中...
                  </p>
                ) : authUrl ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      尚未连接美客多账号。
                    </p>
                    <a href={authUrl}>
                      <Button>登录美客多</Button>
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <dl className="text-sm">
                      <div className="flex justify-between border-b py-2">
                        <dt className="font-medium">状态</dt>
                        <dd className="font-medium text-green-600">
                          已连接
                        </dd>
                      </div>
                    </dl>
                    <div className="flex flex-col gap-2">
                      <Label>目标站点</Label>
                      <Select
                        value={siteId}
                        onValueChange={(v) => {
                          setSiteId(v);
                          setMlCategoryId("");
                          setSelectedCategoryName("");
                          setCatResults([]);
                        }}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MLB">
                            Brazil (MLB)
                          </SelectItem>
                          <SelectItem value="MLM">
                            Mexico (MLM)
                          </SelectItem>
                          <SelectItem value="MLC">
                            Chile (MLC)
                          </SelectItem>
                          <SelectItem value="MCO">
                            Colombia (MCO)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>美客多分类</CardTitle>
                <CardDescription>
                  输入中文关键词，自动翻译成英文后搜索分类。
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mlCategoryId ? (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-lg border bg-card px-4 py-3 text-sm text-card-foreground">
                      已选择: {selectedCategoryName}
                      <button
                        onClick={() => {
                          setMlCategoryId("");
                          setSelectedCategoryName("");
                          setCategoryAttrs([]);
                        }}
                        className="ml-3 underline underline-offset-2"
                      >
                        重新选择
                      </button>
                    </div>
                    <div>
                      <Button
                        onClick={fetchAttributes}
                        disabled={loadingAttrs}
                      >
                        {loadingAttrs
                          ? "获取中..."
                          : "获取分类属性"}
                      </Button>
                    </div>
                    {categoryAttrs.length > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        已加载 {categoryAttrs.length} 个属性
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="输入分类关键词（中文）..."
                        value={catSearch}
                        onChange={(e) =>
                          setCatSearch(e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSearch();
                        }}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleSearch}
                        disabled={
                          catSearchLoading || !catSearch.trim()
                        }
                      >
                        查询
                      </Button>
                    </div>
                    {catSearchLoading ? (
                      <p className="text-sm text-muted-foreground">
                        翻译并搜索中...
                      </p>
                    ) : catResults.length > 0 ? (
                      <div className="max-h-80 overflow-y-auto rounded-lg border bg-background">
                        {catResults.map((cat, i) => (
                          <button
                            key={cat.category_id + i}
                            onClick={() => {
                              setMlCategoryId(cat.category_id);
                              setSelectedCategoryName(
                                `${cat.category_name} (${cat.domain_name})`,
                              );
                              setCatResults([]);
                              setCatSearch("");
                            }}
                            className="flex w-full flex-col border-b px-3 py-2.5 text-left text-sm last:border-0 hover:bg-accent hover:text-accent-foreground"
                          >
                            <span>
                              <span className="font-medium">
                                {cat.category_name}
                              </span>
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({cat.category_id})
                              </span>
                            </span>
                            <span className="text-xs text-primary">
                              {cat.domain_name}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                SKU 变体 — User Products 模式
              </CardTitle>
              <CardDescription>
                每个 SKU 将作为独立商品发布，通过标题分组关联。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {skuItems.length > 0 ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={
                      selectedSkuKeys.size === skuItems.length
                    }
                    onChange={(e) =>
                      setSelectedSkuKeys(
                        new Set(
                          e.target.checked
                            ? skuItems.map((s) => s.key)
                            : [],
                        ),
                      )
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  全选/取消全选
                </label>
              ) : null}

              {skuItems.length === 0 ? (
                <div className="rounded-lg border p-4">
                    <div className="flex items-start gap-3">
                    <button
                      onClick={() =>
                        setCollapsedSkus((prev) => {
                          const next = new Set(prev);
                          next.has("main")
                            ? next.delete("main")
                            : next.add("main");
                          return next;
                        })
                      }
                      className="mt-0.5 p-0 text-muted-foreground hover:text-foreground"
                    >
                      {collapsedSkus.has("main") ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                    <input
                      type="checkbox"
                      checked={selectedSkuKeys.has("main")}
                      onChange={(e) =>
                        setSelectedSkuKeys((prev) => {
                          const next = new Set(prev);
                          e.target.checked
                            ? next.add("main")
                            : next.delete("main");
                          return next;
                        })
                      }
                      className="mt-1 h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        {product?.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Offer ID: {product?.offerId}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleAiFill()}
                      disabled={aiFilling}
                      size="sm"
                    >
                      {aiFilling
                        ? "AI 填写中..."
                        : "AI 自动填写"}
                    </Button>
                  </div>

                  {!collapsedSkus.has("main") ? (
                  <>
                  {skuOverrides.main?.pictureIds?.length > 0 ? (
                    <div className="mt-3">
                      <label className="mb-1.5 block text-sm font-medium">
                        美客多图片 ID
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {skuOverrides.main.pictureIds.map(
                          (id, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="gap-1"
                            >
                              {id}
                              <button
                                onClick={() =>
                                  removePictureId("main", i)
                                }
                                className="text-destructive"
                              >
                                &times;
                              </button>
                            </Badge>
                          ),
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 flex gap-3 items-end">
                    <div className="flex-[2] flex flex-col gap-2">
                      <Label>标题</Label>
                      <InputGroup>
                        <InputGroupInput
                          value={
                            skuOverrides.main?.title || ""
                          }
                          onChange={(e) =>
                            setSkuOverrides((prev) => ({
                              ...prev,
                              main: {
                                ...prev.main,
                                title: e.target.value,
                                price:
                                  prev.main?.price || "",
                                quantity:
                                  prev.main?.quantity ||
                                  "100",
                                pictureIds:
                                  prev.main?.pictureIds ||
                                  [],
                              },
                            }))
                          }
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            variant="outline"
                            onClick={() =>
                              translateTitle("main")
                            }
                            disabled={
                              translating === "main"
                            }
                          >
                            {translating === "main"
                              ? "..."
                              : "翻译"}
                          </InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>
                    </div>
                    {localImages.length > 0 ? (
                      <div className="flex items-end gap-1 pb-1">
                        {localImages.map((url, j) => (
                          <div
                            key={j}
                            className="flex flex-col items-center gap-0.5"
                          >
                            <img
                              src={url}
                              alt={`产品图 ${j}`}
                              className="size-10 rounded border object-cover cursor-pointer"
                              onClick={() => {
                                const idx = imageEntries.findIndex((e) => e.url === url);
                                if (idx >= 0) setImageViewer({ images: imageEntries, index: idx, sourceIndex: idx });
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display =
                                  "none";
                              }}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-5 text-[10px] px-1.5"
                              onClick={() =>
                                handleUploadImage("main", url)
                              }
                              disabled={
                                uploadingImage ===
                                `main:${url}`
                              }
                            >
                              {uploadingImage === `main:${url}`
                                ? "..."
                                : "上传"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="w-28 flex flex-col gap-2">
                      <Label>价格 (USD)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={
                          skuOverrides.main?.price || ""
                        }
                        onChange={(e) =>
                          setSkuOverrides((prev) => ({
                            ...prev,
                            main: {
                              ...prev.main,
                              price: e.target.value,
                              title:
                                prev.main?.title || "",
                              quantity:
                                prev.main?.quantity ||
                                "100",
                              pictureIds:
                                prev.main?.pictureIds ||
                                [],
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="w-24 flex flex-col gap-2">
                      <Label>库存</Label>
                      <Input
                        type="number"
                        min="1"
                        value={
                          skuOverrides.main?.quantity ||
                          "100"
                        }
                        onChange={(e) =>
                          setSkuOverrides((prev) => ({
                            ...prev,
                            main: {
                              ...prev.main,
                              quantity: e.target.value,
                              title:
                                prev.main?.title || "",
                              price:
                                prev.main?.price || "",
                              pictureIds:
                                prev.main?.pictureIds ||
                                [],
                            },
                          }))
                        }
                      />
                    </div>
                  </div>

                  {categoryAttrs.length > 0 ? (
                    <div className="mt-3 border-t pt-3">
                      <label className="mb-2 block text-sm font-medium">
                        分类属性
                      </label>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                        {categoryAttrs
                          .filter(
                            (a) =>
                              a.id !== "ITEM_CONDITION" &&
                              a.id !== "SELLER_SKU",
                          )
                          .map((attr) => {
                            const attrVal =
                              skuOverrides.main?.attributes?.find(
                                (a) => a.id === attr.id,
                              );
                            const val =
                              attrVal?.value_name || "";
                            const isRequired =
                              attr.tags?.catalog_required ||
                              attr.tags?.required;
                            const mainOverride =
                              skuOverrides.main || {
                                title: "",
                                price: "",
                                quantity: "100",
                                pictureIds: [],
                                attributes: [],
                              };
                            return (
                              <div
                                key={attr.id}
                                className="flex flex-col gap-2"
                              >
                                <Label>
                                  {attr.name}{" "}
                                  {isRequired ? (
                                    <span className="text-destructive">
                                      *
                                    </span>
                                  ) : null}
                                </Label>
                                <Input
                                  list={
                                    attr.values
                                      ? `attr-list-${attr.id}`
                                      : undefined
                                  }
                                  placeholder={
                                    attr.hint ||
                                    `输入${attr.name}`
                                  }
                                  value={val}
                                  onChange={(e) => {
                                    const newAttrs =
                                      mainOverride.attributes.map(
                                        (a) =>
                                          a.id === attr.id
                                            ? {
                                                ...a,
                                                value_name:
                                                  e.target
                                                    .value,
                                              }
                                            : a,
                                      );
                                    if (
                                      !mainOverride.attributes.find(
                                        (a) =>
                                          a.id === attr.id,
                                      )
                                    ) {
                                      newAttrs.push({
                                        id: attr.id,
                                        value_name:
                                          e.target.value,
                                      });
                                    }
                                    setSkuOverrides(
                                      (prev) => ({
                                        ...prev,
                                        main: {
                                          ...mainOverride,
                                          attributes:
                                            newAttrs,
                                        },
                                      }),
                                    );
                                  }}
                                />
                                <p className="text-xs text-muted-foreground">
                                  {attr.id}
                                  {attr.value_type ===
                                  "number_unit"
                                    ? " (如: 30 cm)"
                                    : ""}
                                </p>
                                {attr.values?.length ? (
                                  <datalist
                                    id={`attr-list-${attr.id}`}
                                  >
                                    {attr.values.map(
                                      (v) => (
                                        <option
                                          key={v.id}
                                          value={v.name}
                                        />
                                      ),
                                    )}
                                  </datalist>
                                ) : null}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ) : null}
                  </>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {skuItems.map((sku) => {
                    const override =
                      skuOverrides[sku.key] || {
                        title: "",
                        price: "",
                        quantity: "100",
                        pictureIds: [],
                      };
                    return (
                      <div
                        key={sku.key}
                        className="rounded-lg border p-4"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() =>
                              setCollapsedSkus((prev) => {
                                const next = new Set(prev);
                                next.has(sku.key)
                                  ? next.delete(sku.key)
                                  : next.add(sku.key);
                                return next;
                              })
                            }
                            className="mt-0.5 p-0 text-muted-foreground hover:text-foreground"
                          >
                            {collapsedSkus.has(sku.key) ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </button>
                          <input
                            type="checkbox"
                            checked={selectedSkuKeys.has(
                              sku.key,
                            )}
                            onChange={(e) =>
                              setSelectedSkuKeys(
                                (prev) => {
                                  const next = new Set(
                                    prev,
                                  );
                                  e.target.checked
                                    ? next.add(sku.key)
                                    : next.delete(
                                        sku.key,
                                      );
                                  return next;
                                },
                              )
                            }
                            className="mt-1 h-4 w-4 rounded border-gray-300"
                          />
                          <div className="flex-1">
                            <div className="font-medium">
                              {sku.label}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              SKU ID: {sku.skuId}
                            </div>
                          </div>
                          <Button
                            onClick={() =>
                              handleAiFill(sku.key)
                            }
                            disabled={aiFilling}
                            size="sm"
                          >
                            {aiFilling
                              ? "AI 填写中..."
                              : "AI 自动填写"}
                          </Button>
                        </div>

                        {!collapsedSkus.has(sku.key) ? (
                        <>
                        {override.pictureIds.length > 0 ? (
                          <div className="mb-3">
                            <label className="mb-1.5 block text-sm font-medium">
                              美客多图片 ID
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {override.pictureIds.map(
                                (id, i) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="gap-1"
                                  >
                                    {id}
                                    <button
                                      onClick={() =>
                                        removePictureId(
                                          sku.key,
                                          i,
                                        )
                                      }
                                      className="text-destructive"
                                    >
                                      &times;
                                    </button>
                                  </Badge>
                                ),
                              )}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-3 flex gap-3 items-end">
                          <div className="flex-[2] flex flex-col gap-2">
                            <Label>标题</Label>
                            <InputGroup>
                              <InputGroupInput
                                value={override.title}
                                onChange={(e) =>
                                  setSkuOverrides(
                                    (prev) => ({
                                      ...prev,
                                      [sku.key]: {
                                        ...override,
                                        title:
                                          e.target
                                            .value,
                                      },
                                    }),
                                  )
                                }
                                maxLength={60}
                              />
                              <InputGroupAddon align="inline-end">
                                <InputGroupButton
                                  variant="outline"
                                  onClick={() =>
                                    translateTitle(
                                      sku.key,
                                    )
                                  }
                                  disabled={
                                    translating === sku.key
                                  }
                                >
                                  {translating === sku.key
                                    ? "..."
                                    : "翻译"}
                                </InputGroupButton>
                              </InputGroupAddon>
                            </InputGroup>
                          </div>
                          {(bundle?.skuLocalImages?.[
                            sku.key
                          ] || []).length > 0 ? (
                            <div className="flex items-end gap-1 pb-1">
                              {(
                                bundle?.skuLocalImages?.[
                                  sku.key
                                ] || []
                              ).map((url, j) => (
                                <div
                                  key={j}
                                  className="flex flex-col items-center gap-0.5"
                                >
                                  <img
                                    src={url}
                                    alt={`${sku.label} ${j}`}
                                    className="size-10 rounded border object-cover cursor-pointer"
                                    onClick={() => {
                                      const idx = imageEntries.findIndex((e) => e.url === url);
                                      if (idx >= 0) setImageViewer({ images: imageEntries, index: idx, sourceIndex: idx });
                                    }}
                                    onError={(e) => {
                                      e.currentTarget.style.display =
                                        "none";
                                    }}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-5 text-[10px] px-1.5"
                                    onClick={() =>
                                      handleUploadImage(
                                        sku.key,
                                        url,
                                      )
                                    }
                                    disabled={
                                      uploadingImage ===
                                      `${sku.key}:${url}`
                                    }
                                  >
                                    {uploadingImage ===
                                    `${sku.key}:${url}`
                                      ? "..."
                                      : "上传"}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          <div className="w-28 flex flex-col gap-2">
                            <Label>价格 (USD)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={override.price}
                              onChange={(e) =>
                                setSkuOverrides(
                                  (prev) => ({
                                    ...prev,
                                    [sku.key]: {
                                      ...override,
                                      price:
                                        e.target.value,
                                    },
                                  }),
                                )
                              }
                            />
                          </div>
                          <div className="w-24 flex flex-col gap-2">
                            <Label>库存</Label>
                            <Input
                              type="number"
                              min="1"
                              value={override.quantity}
                              onChange={(e) =>
                                setSkuOverrides(
                                  (prev) => ({
                                    ...prev,
                                    [sku.key]: {
                                      ...override,
                                      quantity:
                                        e.target.value,
                                    },
                                  }),
                                )
                              }
                            />
                          </div>
                        </div>

                        {categoryAttrs.length > 0 ? (
                          <div className="mt-3 border-t pt-3">
                            <label className="mb-2 block text-sm font-medium">
                              分类属性
                            </label>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                              {categoryAttrs
                                .filter(
                                  (a) =>
                                    a.id !==
                                      "ITEM_CONDITION" &&
                                    a.id !== "SELLER_SKU",
                                )
                                .map((attr) => {
                                  const attrVal =
                                    override.attributes.find(
                                      (a) =>
                                        a.id === attr.id,
                                    );
                                  const val =
                                    attrVal?.value_name ||
                                    "";
                                  const isRequired =
                                    attr.tags
                                      ?.catalog_required ||
                                    attr.tags?.required;
                                  return (
                                    <div
                                      key={attr.id}
                                      className="flex flex-col gap-2"
                                    >
                                      <Label>
                                        {attr.name}{" "}
                                        {isRequired ? (
                                          <span className="text-destructive">
                                            *
                                          </span>
                                        ) : null}
                                      </Label>
                                      <Input
                                        list={
                                          attr.values
                                            ? `attr-list-${sku.key}-${attr.id}`
                                            : undefined
                                        }
                                        placeholder={
                                          attr.hint ||
                                          `输入${attr.name}`
                                        }
                                        value={val}
                                        onChange={(
                                          e,
                                        ) => {
                                          const newAttrs =
                                            override.attributes.map(
                                              (a) =>
                                                a.id ===
                                                attr.id
                                                  ? {
                                                      ...a,
                                                      value_name:
                                                        e
                                                          .target
                                                          .value,
                                                    }
                                                  : a,
                                            );
                                          if (
                                            !override.attributes.find(
                                              (a) =>
                                                a.id ===
                                                attr.id,
                                            )
                                          ) {
                                            newAttrs.push(
                                              {
                                                id: attr.id,
                                                value_name:
                                                  e.target
                                                    .value,
                                              },
                                            );
                                          }
                                          setSkuOverrides(
                                            (prev) => ({
                                              ...prev,
                                              [sku.key]:
                                                {
                                                  ...override,
                                                  attributes:
                                                    newAttrs,
                                                },
                                            }),
                                          );
                                        }}
                                      />
                                      <p className="text-xs text-muted-foreground">
                                        {attr.id}
                                        {attr.value_type ===
                                        "number_unit"
                                          ? " (如: 30 cm)"
                                          : ""}
                                      </p>
                                      {attr.values
                                        ?.length ? (
                                        <datalist
                                          id={`attr-list-${sku.key}-${attr.id}`}
                                        >
                                          {attr.values.map(
                                            (v) => (
                                              <option
                                                key={
                                                  v.id
                                                }
                                                value={
                                                  v.name
                                                }
                                              />
                                            ),
                                          )}
                                        </datalist>
                                      ) : null}
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        ) : null}
                        </>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handlePublish}
                  disabled={publishing || !mlCategoryId}
                >
                  {publishing
                    ? "刊登中..."
                    : `发布 ${selectedSkuKeys.size} 个商品到美客多`}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.back()}
                >
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className={`w-96 shrink-0 overflow-y-auto h-[calc(100vh-120px)] ${showAttributes ? "" : "hidden"}`}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>商品属性</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAttributes(false)}
            >
              隐藏
            </Button>
          </CardHeader>
          <CardContent>
            {attributes.length > 0 ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {attributes.map((attr, i) => (
                  <span key={i}>
                    <dt className="font-medium text-muted-foreground">
                      {attr.label}
                    </dt>
                    <dd>{attr.value}</dd>
                  </span>
                ))}
              </dl>
            ) : null}
            {mainProduct?.packageInfo?.tables?.map(
              (table, i) => (
                <div key={i} className="mt-3">
                  <h4 className="mb-2 text-sm font-medium">
                    {table.title || `包装信息 ${i + 1}`}
                  </h4>
                  <div className="overflow-x-auto rounded-lg border text-sm">
                    <Table>
                      {table.headers?.length ? (
                        <TableHeader>
                          <TableRow>
                            {table.headers.map((h, j) => (
                              <TableHead key={j}>
                                {h}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                      ) : null}
                      <TableBody>
                        {table.rows.map((row, j) => (
                          <TableRow key={j}>
                            {row.map((cell, k) => (
                              <TableCell key={k}>
                                {cell}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ),
            )}
          </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <Button
          variant="default"
          size="lg"
          className="h-12 w-12 rounded-full p-0 shadow-lg"
          onClick={() => setShowAttributes((v) => !v)}
          title={showAttributes ? "隐藏商品属性" : "查看商品属性"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </Button>
      </div>
    </>
  ) : null}

      <Dialog
        open={!!imageViewer}
        onOpenChange={(open) => { if (!open) setImageViewer(null); }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {imageViewer ? imageViewer.images[imageViewer.index]?.label : ""}
            </DialogTitle>
          </DialogHeader>
          {imageViewer ? (
            <div className="flex items-center justify-center gap-4">
              <button
                disabled={imageViewer.index <= 0}
                onClick={() =>
                  setImageViewer((prev) =>
                    prev ? { ...prev, index: prev.index - 1 } : null,
                  )
                }
                className="flex size-10 items-center justify-center rounded-full border bg-background disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex flex-1 items-center justify-center">
                <img
                  src={imageViewer.images[imageViewer.index].url}
                  alt=""
                  className="max-h-[70vh] max-w-full rounded object-contain"
                />
              </div>
              <button
                disabled={imageViewer.index >= imageViewer.images.length - 1}
                onClick={() =>
                  setImageViewer((prev) =>
                    prev ? { ...prev, index: prev.index + 1 } : null,
                  )
                }
                className="flex size-10 items-center justify-center rounded-full border bg-background disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          ) : null}
          <p className="text-center text-xs text-muted-foreground">
            {imageViewer
              ? `${imageViewer.index + 1} / ${imageViewer.images.length}`
              : ""}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            {imageViewer && imageViewer.sourceIndex !== imageViewer.index ? (
              <DialogClose asChild>
                <Button
                  onClick={() => {
                    const curIdx = imageViewer!.index;
                    const srcIdx = imageViewer!.sourceIndex;
                    const curUrl = imageViewer!.images[curIdx].url;
                    swapImageAt(srcIdx, curUrl);
                  }}
                >
                  确认换图
                </Button>
              </DialogClose>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
