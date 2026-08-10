export type MLSite = {
  id: string;
  name: string;
  country: string;
  currency: string;
  default_currency_id: string;
};

export type MLAccount = {
  id: number;
  mlUserId: number;
  siteId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  nickname: string;
  tags: string;
  forceUserProduct: number;
  isCurrent: number;
  isTestUser: number;
  password: string;
  createdAt: string;
  updatedAt: string;
};

export type MLTestUserResponse = {
  id: number;
  nickname: string;
  password: string;
  site_status: string;
};

export type MLCategory = {
  id: string;
  name: string;
  picture: string | null;
  total_items_in_this_category: number;
  children: MLCategory[];
  path_from_root?: Array<{ id: string; name: string }>;
};

export type MLOAuthResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  user_id: number;
  site_id?: string;
  nickname?: string;
};

export type MLUserResponse = {
  id: number;
  site_id: string;
  nickname: string;
  email?: string;
  tags?: string[];
  user_type?: string;
};

export type MLRefreshResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  user_id: number;
  site_id?: string;
};

export type MLPictureItem =
  | { source: string }
  | { id: string };

export type MLUPAttribute =
  | { id: string; value_name: string; value_id?: string }
  | { id: string; values: Array<{ id?: string; name: string }> };

export type MLCreateUPItemRequest = {
  sites_to_sell: Array<{
    site_id: string;
    logistic_type: "remote";
    listing_type_id?: "gold_special" | "gold_pro";
    price?: number;
    net_proceeds?: number;
  }>;
  family_name: string;
  category_id: string;
  available_quantity: number;
  condition?: "new" | "used" | "not_specified";
  pictures: Array<{ id: string }>;
  attributes: MLUPAttribute[];
  sale_terms: Array<{
    id: string;
    value_id?: string;
    value_name?: string;
  }>;
  description?: {
    plain_text: string;
  };
  global_net_proceeds?: number;
};

export type MLCreateUPItemResponse = MLCreateItemResponse & {
  parent_user_product_id?: string;
  siteless_user_product_id?: string;
  siteless_family_id?: string;
};

export type MLUPMappingItem = {
  item_id: string;
  owner_id: number;
  site_id: string;
  user_product_id: string;
  siteless_user_product_id: string;
  site_items: Array<{
    item_id: string;
    site_id: string;
    logistic_type: string;
  }>;
};

/**
 * Global Selling (CBT) 创建商品请求体
 * 参考: https://global-selling.mercadolibre.com/devsite/global-listing
 */
export type MLCreateItemRequest = {
  sites_to_sell: Array<{
    site_id: string;
    logistic_type: "remote";
    title?: string;
    listing_type_id?: "gold_special" | "gold_pro";
    price?: number;
  }>;
  currency_id: "USD";
  catalog_listing?: boolean;
  category_id: string;
  title: string;
  price: number;
  available_quantity: number;
  condition?: "new" | "used" | "not_specified";
  pictures: MLPictureItem[];
  attributes: Array<{
    id: string;
    value_id?: string;
    value_name: string;
  }>;
  sale_terms: Array<{
    id: string;
    value_id?: string;
    value_name: string;
  }>;
  description?: {
    plain_text: string;
  };
};

/**
 * Global Selling (CBT) 创建商品响应
 * 注意: site_items 可能包含 error 而非 item_id
 */
export type MLCreateItemResponse = {
  item_id?: string;
  site_id?: string;
  site_items: Array<{
    site_id: string;
    item_id?: string;
    user_product_id?: string;
    logistic_type?: string;
    error?: {
      message: string;
      error: string;
      status: number;
      cause: Array<unknown>;
    };
  }>;
};

export type MLPictureResponse = {
  id: string;
  url: string;
  secure_url: string;
  size: string;
  max_size: string;
};

export type MLPredictedCategory = {
  domain_id: string;
  domain_name: string;
  category_id: string;
  category_name: string;
  attributes?: Array<{ id: string; value_id?: string; value_name: string }>;
};

export type MLMarketplaceUserResponse = {
  user_id: number;
  site_id: string;
  marketplaces: Array<{
    user_id: number;
    site_id: string;
    logistic_type: string;
  }>;
};

export type MLCategoryAttribute = {
  id: string;
  name: string;
  tags: Record<string, unknown>;
  value_type: string;
  values: Array<{
    id: string;
    name: string;
  }> | null;
  hint?: string;
};