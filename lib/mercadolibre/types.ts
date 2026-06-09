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
  createdAt: string;
  updatedAt: string;
};

export type MLCategory = {
  id: string;
  name: string;
  picture: string | null;
  total_items_in_this_category: number;
  children: MLCategory[];
};

export type MLOAuthResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  user_id: number;
  site_id: string;
  nickname?: string;
};

export type MLRefreshResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  user_id: number;
};