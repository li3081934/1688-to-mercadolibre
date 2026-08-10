import { getAllMLPublishedProductMappings, getProductById } from "@/lib/db";
import { parseProductBundle } from "@/lib/products";
import { getCurrentPublishedItems, type MLCurrentPublishedItem } from "./client";

export type PublishedProductRow = {
  id: number;
  productId: string;
  title: string;
  offerId: string;
  sourceSku: string;
  sellerSku: string;
  sitelessUserProductId: string | null;
  cbtItemId: string | null;
  familyId: string | null;
  sourceUrl: string | null;
  status: string;
  mapped: boolean;
  sites: Array<{
    siteId: string;
    itemId: string;
    status: string;
    quantity: number | null;
    price: number | null;
    netProceeds: number | null;
  }>;
  updatedAt: string;
};

export type PublishedProductFilters = {
  status?: "active" | "paused" | "closed" | "all";
  siteId?: "MLM" | "MLB" | "CBT";
  keyword?: string;
  page?: number;
  pageSize?: number;
};

export type PublishedProductPage = {
  rows: PublishedProductRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function parseSiteItems(value: string) {
  try {
    return JSON.parse(value) as Array<{
      site_id?: string;
      item_id?: string;
    }>;
  } catch {
    return [];
  }
}

export async function getPublishedProductRows(
  accessToken: string,
  mlUserId: number,
  filters: PublishedProductFilters = {}
): Promise<PublishedProductPage> {
  const status = filters.status || "active";
  const siteId = filters.siteId || "MLM";
  const keyword = filters.keyword?.trim().toLowerCase();
  const pageSize = Math.min(Math.max(filters.pageSize || 20, 1), 100);
  const requestedPage = Math.max(filters.page || 1, 1);
  const [remoteItems, mappings] = await Promise.all([
    getCurrentPublishedItems(accessToken, mlUserId, { status }),
    Promise.resolve(getAllMLPublishedProductMappings()),
  ]);
  const remoteById = new Map(remoteItems.map((item) => [item.id, item]));
  const rows: PublishedProductRow[] = [];
  const matchedRemoteIds = new Set<string>();
  const productCache = new Map<string, Awaited<ReturnType<typeof getProductById>>>();
  const bundleCache = new Map<string, Awaited<ReturnType<typeof parseProductBundle>>>();

  for (const mapping of mappings) {
    const siteItems = parseSiteItems(mapping.siteItems);
    const rootRemote = mapping.cbtItemId ? remoteById.get(mapping.cbtItemId) : undefined;
    const activeSites = siteItems
      .map((site) => {
        const remote = remoteById.get(site.item_id || "") || rootRemote;
        if (remote) matchedRemoteIds.add(remote.id);
        return remote
          ? { remote, siteId: site.site_id || remote.site_id || "CBT", itemId: site.item_id || remote.id }
          : null;
      })
      .filter((item): item is { remote: MLCurrentPublishedItem; siteId: string; itemId: string } => Boolean(item));
    if (activeSites.length === 0) continue;

    if (!productCache.has(mapping.productId)) {
      productCache.set(mapping.productId, getProductById(mapping.productId));
    }
    const product = productCache.get(mapping.productId);
    if (!product) continue;

    if (!bundleCache.has(mapping.productId)) {
      bundleCache.set(mapping.productId, await parseProductBundle(product.extractedDir));
    }
    const bundle = bundleCache.get(mapping.productId);
    const sourceUrl = typeof bundle?.mainProduct.source?.url === "string"
      ? bundle.mainProduct.source.url
      : null;

    rows.push({
      id: mapping.id,
      productId: mapping.productId,
      title: product.title,
      offerId: product.offerId,
      sourceSku: mapping.sourceSku,
      sellerSku: mapping.sellerSku,
      sitelessUserProductId: mapping.sitelessUserProductId,
      cbtItemId: mapping.cbtItemId,
      familyId: mapping.familyId,
      sourceUrl,
      status: activeSites[0].remote.status || "active",
      mapped: true,
      sites: activeSites.map(({ remote, siteId, itemId }) => ({
        siteId,
        itemId,
        status: remote.status || "active",
        quantity: typeof remote.available_quantity === "number" ? remote.available_quantity : null,
        price: typeof remote.price === "number" ? remote.price : null,
        netProceeds: typeof remote.net_proceeds?.amount === "number" ? remote.net_proceeds.amount : null,
      })),
      updatedAt: mapping.updatedAt,
    });
  }

  for (const item of remoteItems) {
    if (matchedRemoteIds.has(item.id)) continue;

    rows.push({
      id: -rows.length - 1,
      productId: "",
      title: item.title || "未关联本地商品",
      offerId: "-",
      sourceSku: "-",
      sellerSku: "-",
      sitelessUserProductId: item.user_product_id || null,
      cbtItemId: item.id,
      familyId: null,
      sourceUrl: null,
      status: item.status || "active",
      mapped: false,
      sites: [{
        siteId: item.site_id || "CBT",
        itemId: item.id,
        status: item.status || "active",
        quantity: typeof item.available_quantity === "number" ? item.available_quantity : null,
        price: typeof item.price === "number" ? item.price : null,
        netProceeds: typeof item.net_proceeds?.amount === "number" ? item.net_proceeds.amount : null,
      }],
      updatedAt: new Date().toISOString(),
    });
  }

  const filteredRows = rows.filter((row) => {
    if (status !== "all" && row.status !== status) return false;
    if (siteId && !row.sites.some((site) => site.siteId === siteId)) return false;
    if (keyword) {
      const haystack = [
        row.title,
        row.offerId,
        row.sourceSku,
        row.sellerSku,
        row.sitelessUserProductId,
        row.cbtItemId,
        ...row.sites.flatMap((site) => [site.siteId, site.itemId]),
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
  const total = filteredRows.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * pageSize;

  return {
    rows: filteredRows.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
  };
}