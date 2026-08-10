"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
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
  price: string;
  quantity: string;
  pictureIds: string[];
  attributes: Array<{ id: string; value_name: string; value_id?: string }>;
  warrantyTypeId: string;
  warrantyTime: string;
  listingTypeId: string;
};

type UploadedImage = {
  id: string;
  url: string;
  sourceUrl: string;
};

type SiteSkuConfig = {
  price: string;
  quantity: string;
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
  path_from_root?: Array<{ id: string; name: string }>;
  attributes?: Array<{ id: string; value_id?: string; value_name: string }>;
};

type PublishResult = {
  total: number;
  succeeded: number;
  failed: number;
  publishModel?: string;
  results: Array<{
    skuKey: string;
    skuLabel: string;
    success: boolean;
    mlItemId?: string;
    sitelessUserProductId?: string;
    familyId?: string;
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
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [description, setDescription] = useState("");

  const [showAttributes, setShowAttributes] = useState(false);
  const [translatingDesc, setTranslatingDesc] = useState(false);
  const [translatingFamily, setTranslatingFamily] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<Record<string, UploadedImage[]>>({});
  const [collapsedSkus, setCollapsedSkus] = useState<Set<string>>(new Set());
  const [imagePickerSku, setImagePickerSku] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [availableSites, setAvailableSites] = useState<string[]>([]);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [siteSkuConfigs, setSiteSkuConfigs] = useState<Record<string, Record<string, SiteSkuConfig>>>({});
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

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
        for (const [index, sku] of (bundleData.skuItems || []).entries()) {
          const skuPrice =
            bundleData.skuProducts?.[index]?.sku?.price || "";
          overrides[sku.key] = {
            price: skuPrice
              ? parseFloat(skuPrice.replace(/[^0-9.]/g, "")).toString()
              : "",
            quantity: "100",
            pictureIds: [],
            attributes: [],
            warrantyTypeId: "6150835",
            warrantyTime: "",
            listingTypeId: "gold_special",
          };
        }
        if (overrides.main) {
          overrides.main.quantity = "100";
          overrides.main.attributes = [];
          overrides.main.warrantyTypeId = "6150835";
          overrides.main.warrantyTime = "";
          overrides.main.listingTypeId = "gold_special";
        }
        setSkuOverrides(overrides);
        setFamilyName(prev => prev || baseTitle.slice(0, 60));
        setDescription(prev => prev || bundleData.mainProduct?.product?.description || "");
        setSelectedSkuKeys(new Set(Object.keys(overrides)));
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    if (selectedSites.length === 0 || Object.keys(skuOverrides).length === 0) return;
    setSiteSkuConfigs((prev) => {
      const next: Record<string, Record<string, SiteSkuConfig>> = {};
      for (const site of selectedSites) {
        next[site] = {};
        for (const [skuKey, override] of Object.entries(skuOverrides)) {
          next[site][skuKey] = {
            price: prev[site]?.[skuKey]?.price ?? override.price,
            quantity: prev[site]?.[skuKey]?.quantity ?? override.quantity,
          };
        }
      }
      return next;
    });
  }, [selectedSites, skuOverrides]);

  useEffect(() => {
    fetch("/api/mercadolibre/auth")
      .then((r) => r.json())
      .then((data) => {
        setAuthChecked(true);
        if (data.authenticated) {
          fetch("/api/mercadolibre/marketplaces")
            .then((r) => r.json())
            .then((mkt) => {
              if (mkt.success) {
                const sites = mkt.data.map((m: { siteId: string }) => m.siteId);
                setAvailableSites(sites);
                setSelectedSites(sites.includes("MLM") ? ["MLM"] : sites.slice(0, 1));
              }
            })
            .catch(() => {});
        }
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
        `/api/mercadolibre/categories/search?query=${encodeURIComponent(translated)}`,
      );
      const data = await res.json();
      if (data.success) setCatResults(data.data);
      else toast.error(data.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "搜索分类失败");
    } finally {
      setCatSearchLoading(false);
    }
  }, [catSearch]);

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

  const resolveValueId = (
    attrs: CategoryAttr[],
    attrId: string,
    valueName: string,
  ): string | undefined => {
    if (!valueName) return undefined;
    const def = attrs.find((a) => a.id === attrId);
    if (
      !def ||
      (def.value_type !== "list" && def.value_type !== "boolean") ||
      !def.values
    )
      return undefined;
    return def.values.find((v) => v.name === valueName)?.id;
  };

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
        setUploadedImages((prev) => {
          const current = prev[skuKey] || [];
          if (current.some((image) => image.id === data.data.id)) {
            return prev;
          }
          return {
            ...prev,
            [skuKey]: [...current, { id: data.data.id, url: data.data.url, sourceUrl: imageUrl }],
          };
        });
      } else {
        toast.error(data.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "上传图片失败");
    } finally {
      setUploadingImage(null);
    }
  };

  const updateSiteSkuConfig = (siteId: string, skuKey: string, field: keyof SiteSkuConfig, value: string) => {
    setSiteSkuConfigs((prev) => ({
      ...prev,
      [siteId]: {
        ...prev[siteId],
        [skuKey]: {
          ...prev[siteId]?.[skuKey],
          [field]: value,
        },
      },
    }));
  };

  const openPublishDialog = () => {
    if (!mlCategoryId) {
      toast.error("请先选择美客多分类");
      return;
    }
    if (selectedSkuKeys.size === 0) {
      toast.error("请至少选择一个 SKU");
      return;
    }
    setPublishDialogOpen(true);
  };

  const handlePublish = async () => {
    if (!mlCategoryId) {
      toast.error("请先选择美客多分类");
      return;
    }

    const selectedEntries = Object.entries(skuOverrides).filter(
      ([skuKey]) => selectedSkuKeys.has(skuKey),
    );
    if (selectedSites.length === 0) {
      toast.error("请至少选择一个发布站点");
      return;
    }
    const invalidCell = selectedSites.flatMap((site) =>
      selectedEntries
        .filter(([skuKey]) => {
          const config = siteSkuConfigs[site]?.[skuKey];
          return !config?.price || Number(config.price) <= 0 || !config.quantity || !/^\d+$/.test(config.quantity) || Number(config.quantity) <= 0;
        })
        .map(([skuKey]) => `${site} / ${skuKey}`),
    )[0];
    if (invalidCell) {
      toast.error(`请填写有效的价格和库存：${invalidCell}`);
      return;
    }
    const missingImages = selectedEntries.filter(
      ([, override]) => !override.pictureIds.length,
    );
    if (missingImages.length > 0) {
      toast.error("请先为所有上架的 SKU 上传图片");
      return;
    }

    setPublishing(true);
    setResult(null);
    setPublishMessage(null);

    const skus = selectedEntries
      .map(([skuKey, override]) => ({
        skuKey,
        siteConfigs: Object.fromEntries(selectedSites.map((site) => [site, {
          price: Number(siteSkuConfigs[site][skuKey].price),
          quantity: Number(siteSkuConfigs[site][skuKey].quantity),
        }])),
        pictureIds: override.pictureIds,
        attributes: override.attributes
          .filter((a) => a.value_name.trim())
          .map((a) => ({
            id: a.id,
            value_name: a.value_name,
            value_id: resolveValueId(
              categoryAttrs,
              a.id,
              a.value_name,
            ),
          })),
        warrantyTypeId: override.warrantyTypeId !== "6150835" ? override.warrantyTypeId : undefined,
        warrantyTime: override.warrantyTime || undefined,
        listingTypeId: override.listingTypeId as "gold_special" | "gold_pro" | undefined,
      }));

    try {
      setPublishDialogOpen(false);
      const res = await fetch("/api/mercadolibre/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, mlCategoryId, sites: selectedSites, familyName: familyName || undefined, description: description || undefined, skus }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.data);
        toast.success("刊登完成。");
      } else {
        if (data.data?.results) {
          setResult(data.data);
        } else {
          setPublishMessage(data.message || "刊登失败");
        }
      }
    } catch (e) {
      setPublishMessage(e instanceof Error ? e.message : "请求失败");
    } finally {
      setPublishing(false);
    }
  };

  const translateFamilyName = async () => {
    const text = familyName;
    if (!text) return;
    setTranslatingFamily(true);
    try {
      const res = await fetch("/api/ai-models/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, purpose: "title_polish" }),
      });
      const data = await res.json();
      if (data.translated) {
        setFamilyName(data.translated.slice(0, 60));
      }
    } catch {
      /* ignore */
    } finally {
      setTranslatingFamily(false);
    }
  };

  const translateDescription = async () => {
    const text = description;
    if (!text) return;
    setTranslatingDesc(true);
    try {
      const res = await fetch("/api/ai-models/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.translated) {
        setDescription(data.translated);
      }
    } catch {
      /* ignore */
    } finally {
      setTranslatingDesc(false);
    }
  };

  const addPictureId = (skuKey: string, id: string) => {
    setSkuOverrides((prev) => ({
      ...prev,
      [skuKey]: {
        ...prev[skuKey],
        pictureIds: prev[skuKey].pictureIds.includes(id)
          ? prev[skuKey].pictureIds
          : [...prev[skuKey].pictureIds, id],
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
    setUploadedImages((prev) => ({
      ...prev,
      [skuKey]: (prev[skuKey] || []).filter((_, i) => i !== idx),
    }));
  };

  const reorderPicture = (skuKey: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setSkuOverrides((prev) => {
      const pictureIds = [...(prev[skuKey]?.pictureIds || [])];
      const [movedId] = pictureIds.splice(fromIndex, 1);
      pictureIds.splice(toIndex, 0, movedId);
      return {
        ...prev,
        [skuKey]: { ...prev[skuKey], pictureIds },
      };
    });
    setUploadedImages((prev) => {
      const images = [...(prev[skuKey] || [])];
      const [movedImage] = images.splice(fromIndex, 1);
      images.splice(toIndex, 0, movedImage);
      return { ...prev, [skuKey]: images };
    });
  };

  type ImageEntry = { url: string; label: string };

  const imageEntries = (() => {
    if (!product || !bundle) return [] as ImageEntry[];

    const entries = new Map<string, ImageEntry>();
    for (const url of bundle.localImages || []) {
      entries.set(url, { url, label: product.title || "主图" });
    }
    for (const sku of bundle.skuItems || []) {
      for (const url of bundle.skuLocalImages?.[sku.key] || []) {
        if (!entries.has(url)) {
          entries.set(url, { url, label: sku.label });
        }
      }
    }
    return Array.from(entries.values());
  })();

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
  const skuItems = bundle?.skuItems || [];

  const openImagePicker = (skuKey: string) => setImagePickerSku(skuKey);
  const publishSkuColumns = skuItems.length > 0
    ? skuItems.filter((sku) => selectedSkuKeys.has(sku.key))
    : selectedSkuKeys.has("main")
      ? [{ key: "main", label: product.title, skuId: product.offerId }]
      : [];

  const renderUploadedImages = (skuKey: string, pictureIds: string[]) => {
    const images = uploadedImages[skuKey] || [];
    return (
      <div className="mt-3">
        <label className="mb-1.5 block text-sm font-medium">
          美客多图片 ID（可拖拽排序）
        </label>
        <div className="flex flex-wrap gap-3">
          {pictureIds.map((id, index) => {
            const image = images.find((item) => item.id === id);
            return (
              <div
                key={id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(index));
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const fromIndex = Number(event.dataTransfer.getData("text/plain"));
                  if (Number.isInteger(fromIndex) && fromIndex >= 0 && fromIndex < pictureIds.length) {
                    reorderPicture(skuKey, fromIndex, index);
                  }
                }}
                className="group relative flex w-[100px] cursor-grab flex-col gap-1 active:cursor-grabbing"
                title="拖拽图片调整顺序"
              >
                <div className="h-[100px] w-[100px] overflow-hidden rounded border bg-muted">
                  {image?.sourceUrl || image?.url ? (
                    <img
                      src={image.sourceUrl || image.url}
                      alt={`Mercado Libre 图片 ${id}`}
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        if (image.url && event.currentTarget.src !== image.url) {
                          event.currentTarget.src = image.url;
                        }
                      }}
                    />
                  ) : null}
                </div>
                <span className="truncate text-xs text-muted-foreground" title={id}>
                  {id}
                </span>
                <button
                  type="button"
                  onClick={() => removePictureId(skuKey, index)}
                  className="absolute right-1 top-1 rounded bg-background/90 px-1 text-sm text-destructive opacity-0 shadow transition-opacity group-hover:opacity-100"
                  aria-label={`删除图片 ${id}`}
                >
                  &times;
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <main className="flex flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold">{product?.title || "商品刊登"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Offer ID: {product?.offerId}
        </p>
      </div>

      <>
          <div className="flex gap-4 items-start">
            <div className="flex flex-col gap-4 flex-1 h-[calc(100vh-120px)] overflow-y-auto pr-2">
              <div className="grid-2">
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
                            {cat.path_from_root && cat.path_from_root.length > 1 ? (
                              <span className="text-xs text-muted-foreground">
                                {cat.path_from_root
                                  .slice(0, -1)
                                  .map((parent) => parent.name)
                                  .join(" > ")}
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          <Card>
            <CardHeader>
              <CardTitle>商品系列名称 (Family Name)</CardTitle>
              <CardDescription>
                UP 模式必填，所有 SKU 共享此名称。ML 将根据此名称自动生成本地化标题。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InputGroup>
                <InputGroupInput
                  value={familyName}
                  onChange={(e) =>
                    setFamilyName(e.target.value.slice(0, 60))
                  }
                  maxLength={60}
                  placeholder="例如: Sun Protection Hat"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    variant="outline"
                    onClick={translateFamilyName}
                    disabled={translatingFamily}
                  >
                    {translatingFamily ? "..." : "翻译"}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </CardContent>
            <CardContent>
              <div className="flex flex-col gap-2">
                <Label>商品描述</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  placeholder="输入商品描述（英文），所有 SKU 共用"
                />
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={translateDescription}
                    disabled={translatingDesc}
                  >
                    {translatingDesc ? "翻译中..." : "翻译描述"}
                  </Button>
                </div>
              </div>
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
                  </div>

                  {!collapsedSkus.has("main") ? (
                  <>
                  {skuOverrides.main?.pictureIds?.length > 0
                    ? renderUploadedImages("main", skuOverrides.main.pictureIds)
                    : null}

                  <div className="mt-3 flex flex-wrap items-end gap-4">
                    <Button onClick={() => openImagePicker("main")}>
                      上传图片
                    </Button>
                    <div className="flex flex-col gap-2">
                      <Label>上架类型</Label>
                      <Select
                        value={skuOverrides.main?.listingTypeId || "gold_special"}
                        onValueChange={(v) =>
                          setSkuOverrides((prev) => ({
                            ...prev,
                            main: { ...prev.main, listingTypeId: v },
                          }))
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gold_special">Classic (gold_special)</SelectItem>
                          <SelectItem value="gold_pro">Premium (gold_pro)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>保修类型</Label>
                      <Select
                        value={skuOverrides.main?.warrantyTypeId || "6150835"}
                        onValueChange={(v) =>
                          setSkuOverrides((prev) => ({
                            ...prev,
                            main: { ...prev.main, warrantyTypeId: v },
                          }))
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="6150835">No warranty</SelectItem>
                          <SelectItem value="2230279">Factory warranty</SelectItem>
                          <SelectItem value="2230278">Seller warranty</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {skuOverrides.main?.warrantyTypeId && skuOverrides.main.warrantyTypeId !== "6150835" ? (
                      <div className="flex flex-col gap-2">
                        <Label>保修时长</Label>
                        <Input
                          className="w-32"
                          placeholder="如: 30 days"
                          value={skuOverrides.main?.warrantyTime || ""}
                          onChange={(e) =>
                            setSkuOverrides((prev) => ({
                              ...prev,
                              main: { ...prev.main, warrantyTime: e.target.value },
                            }))
                          }
                        />
                      </div>
                    ) : null}
                    <Button
                      onClick={() => handleAiFill()}
                      disabled={aiFilling}
                    >
                      {aiFilling ? "AI 填写中..." : "AI 自动填写"}
                    </Button>
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
                        </div>

                        {!collapsedSkus.has(sku.key) ? (
                        <>
                        {override.pictureIds.length > 0
                          ? renderUploadedImages(sku.key, override.pictureIds)
                          : null}

                        <div className="mt-3 flex flex-wrap items-end gap-4">
                          <Button onClick={() => openImagePicker(sku.key)}>
                            上传图片
                          </Button>
                          <div className="flex flex-col gap-2">
                            <Label>上架类型</Label>
                            <Select
                              value={override.listingTypeId || "gold_special"}
                              onValueChange={(v) =>
                                setSkuOverrides((prev) => ({
                                  ...prev,
                                  [sku.key]: { ...override, listingTypeId: v },
                                }))
                              }
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="gold_special">Classic (gold_special)</SelectItem>
                                <SelectItem value="gold_pro">Premium (gold_pro)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>保修类型</Label>
                            <Select
                              value={override.warrantyTypeId || "6150835"}
                              onValueChange={(v) =>
                                setSkuOverrides((prev) => ({
                                  ...prev,
                                  [sku.key]: { ...override, warrantyTypeId: v },
                                }))
                              }
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="6150835">No warranty</SelectItem>
                                <SelectItem value="2230279">Factory warranty</SelectItem>
                                <SelectItem value="2230278">Seller warranty</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {override.warrantyTypeId && override.warrantyTypeId !== "6150835" ? (
                            <div className="flex flex-col gap-2">
                              <Label>保修时长</Label>
                              <Input
                                className="w-32"
                                placeholder="如: 30 days"
                                value={override.warrantyTime || ""}
                                onChange={(e) =>
                                  setSkuOverrides((prev) => ({
                                    ...prev,
                                    [sku.key]: { ...override, warrantyTime: e.target.value },
                                  }))
                                }
                              />
                            </div>
                          ) : null}
                          <Button
                            onClick={() => handleAiFill(sku.key)}
                            disabled={aiFilling}
                          >
                            {aiFilling ? "AI 填写中..." : "AI 自动填写"}
                          </Button>
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

              <div className="sticky bottom-0 bg-background pt-3 flex justify-end gap-3">
                <Button
                  onClick={openPublishDialog}
                  disabled={publishing}
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

      <Dialog
        open={!!result || !!publishMessage}
        onOpenChange={(open) => {
          if (!open) {
            setResult(null);
            setPublishMessage(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {publishMessage
                ? "发布失败"
                : result?.failed
                  ? "发布结果"
                  : "发布完成"}
            </DialogTitle>
          </DialogHeader>
          {publishMessage ? (
            <p className="text-sm text-destructive break-all">{publishMessage}</p>
          ) : result ? (
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
              <p className="text-sm font-medium">
                成功 {result.succeeded}/{result.total} 个 SKU
                {result.publishModel ? `，${result.publishModel === "user_product" ? "UP 模式" : "经典模式"}` : ""}
              </p>
              <div className="flex flex-col gap-2">
                {result.results.map((item) => (
                  <div key={item.skuKey} className="border-b py-2 text-sm">
                    <div className="font-medium">{item.skuLabel}</div>
                    {item.success ? (
                      <div className="text-green-600">
                        发布成功：{item.mlItemId || "已完成"}
                        {item.sitelessUserProductId ? `，UP: ${item.sitelessUserProductId}` : ""}
                        {item.familyId ? `，Family: ${item.familyId}` : ""}
                      </div>
                    ) : (
                      <div className="break-all text-destructive">发布失败：{item.error || "未知错误"}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <DialogClose asChild>
            <Button variant="outline">关闭</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>

      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="max-w-[95vw]">
          <DialogHeader>
            <DialogTitle>确认发布配置</DialogTitle>
          </DialogHeader>
          {!authChecked ? (
            <p className="text-sm text-muted-foreground">检查账号状态中...</p>
          ) : authUrl ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">尚未连接美客多账号。</p>
              <a href={authUrl}><Button>登录美客多</Button></a>
            </div>
          ) : (
            <div className="flex max-h-[70vh] flex-col gap-4 overflow-hidden">
              <div className="flex flex-col gap-2">
                <Label>投放站点（可多选）</Label>
                <div className="flex flex-wrap gap-4">
                  {availableSites.length > 0 ? availableSites.map((site) => (
                    <label key={site} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedSites.includes(site)}
                        onChange={() => setSelectedSites((prev) => prev.includes(site) ? prev.filter((item) => item !== site) : [...prev, site])}
                      />
                      {site === "MLB" ? "Brazil (MLB)" : site === "MLM" ? "Mexico (MLM)" : site === "MLC" ? "Chile (MLC)" : site === "MCO" ? "Colombia (MCO)" : site}
                    </label>
                  )) : <span className="text-sm text-muted-foreground">加载中...</span>}
                </div>
              </div>
              <div className="overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 min-w-32 bg-background">站点 / SKU</TableHead>
                      {publishSkuColumns.map((sku) => <TableHead key={sku.key} className="min-w-48">{sku.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSites.map((site) => (
                      <TableRow key={site}>
                        <TableHead className="sticky left-0 z-10 bg-background">{site}</TableHead>
                        {publishSkuColumns.map((sku) => {
                          const config = siteSkuConfigs[site]?.[sku.key] || { price: "", quantity: "" };
                          return (
                            <TableCell key={sku.key} className="align-top">
                              <div className="flex min-w-40 flex-col gap-2">
                                <InputGroup>
                                  <InputGroupInput type="number" step="0.01" min="0.01" placeholder="价格 (USD)" value={config.price} onChange={(event) => updateSiteSkuConfig(site, sku.key, "price", event.target.value)} />
                                  <InputGroupAddon align="inline-end" className="flex items-center rounded-r-md border border-l-0 bg-muted px-2 text-xs text-muted-foreground">
                                    净收入
                                  </InputGroupAddon>
                                </InputGroup>
                                <InputGroup>
                                  <InputGroupInput type="number" min="1" step="1" placeholder="库存" value={config.quantity} onChange={(event) => updateSiteSkuConfig(site, sku.key, "quantity", event.target.value)} />
                                  <InputGroupAddon align="inline-end" className="flex items-center rounded-r-md border border-l-0 bg-muted px-2 text-xs text-muted-foreground">
                                    库存
                                  </InputGroupAddon>
                                </InputGroup>
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-3">
                <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
                <Button onClick={handlePublish} disabled={publishing || selectedSites.length === 0 || publishSkuColumns.length === 0}>
                  {publishing ? "发布中..." : "确认发布"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!imagePickerSku}
        onOpenChange={(open) => {
          if (!open) setImagePickerSku(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>选择图片上传</DialogTitle>
          </DialogHeader>
          {imagePickerSku ? (
            imageEntries.length > 0 ? (
              <div className="grid max-h-[70vh] grid-cols-2 gap-4 overflow-y-auto sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {imageEntries.map((entry) => {
                  const isUploaded = uploadedImages[imagePickerSku]?.some((image) => image.sourceUrl === entry.url) || false;
                  const isUploading = uploadingImage === `${imagePickerSku}:${entry.url}`;
                  return (
                    <div key={entry.url} className="flex flex-col items-center gap-2">
                      <img
                        src={entry.url}
                        alt={entry.label}
                        className="h-[100px] w-[100px] rounded border object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                      <Button
                        disabled={isUploaded || isUploading}
                        onClick={() => handleUploadImage(imagePickerSku, entry.url)}
                      >
                        {isUploading ? "上传中..." : isUploaded ? "已上传" : "上传"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">没有可上传的候选图片。</p>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
