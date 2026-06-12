/**
 * Global Selling (CBT) 目标市场站点
 * 所有价格固定为 USD
 */
export const SITE_CURRENCIES: Record<string, string> = {
  MLB: "USD",
  MLM: "USD",
  MLC: "USD",
  MCO: "USD",
};

/**
 * Global Selling 支持的目标市场
 */
export const SITES: Array<{ id: string; name: string }> = [
  { id: "MLB", name: "Brazil" },
  { id: "MLM", name: "Mexico" },
  { id: "MLC", name: "Chile" },
  { id: "MCO", name: "Colombia" },
];