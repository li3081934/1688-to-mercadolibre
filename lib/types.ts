export type TemplateField = {
  column: string;
  key?: string;
  label?: string;
  value?: string | number | null;
};

export type LabelValuePair = {
  label: string;
  value: string;
};

export type StructuredTable = {
  title?: string;
  headers?: string[];
  rows: string[][];
  text?: string;
};

export type DetailBlock =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      url: string;
    };

export type DetailPayload = {
  url?: string;
  html?: string;
  text?: string;
  images?: string[];
  blocks?: DetailBlock[];
  error?: string;
};

export type PackageInfo = {
  unitWeight?: string;
  summary?: LabelValuePair[];
  tables?: StructuredTable[];
};

export type ProductPayload = {
  title?: string;
  offerId?: string;
  companyName?: string;
  price?: string;
  description?: string;
  images?: string[];
  detailUrl?: string;
};

export type SkuPayload = {
  skuId?: string;
  specId?: string;
  specAttrs?: string;
  options?: string[];
  price?: string;
  stock?: string;
  images?: string[];
  packageInfo?: {
    weight?: string;
    weightUnit?: string;
    length?: string;
    width?: string;
    height?: string;
    sizeUnit?: string;
  };
};

export type ExportJsonRecord = {
  generatedAt?: string;
  source?: Record<string, unknown>;
  product?: ProductPayload;
  attributes?: LabelValuePair[];
  packageInfo?: PackageInfo;
  detail?: DetailPayload;
  sku?: SkuPayload;
  skuPackages?: SkuPayload[];
  collectionWarnings?: string[];
  fields?: Record<string, unknown>;
  templateFields?: TemplateField[];
  raw?: Record<string, unknown>;
};

export type CategoryRecord = {
  id: string;
  code: string;
  name: string;
  sheetName: string;
  templatePath: string;
  mapperPath: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductRecord = {
  id: string;
  categoryId: string;
  title: string;
  offerId: string;
  zipPath: string;
  extractedDir: string;
  mainJsonPath: string;
  skuCount: number;
  isListed: number;
  status: string;
  lastError: string | null;
  lastExportedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductListItem = ProductRecord & {
  categoryCode: string;
  categoryName: string;
  categorySheetName: string;
  categoryTemplatePath: string;
  categoryMapperPath: string;
};

export type ParsedSkuItem = {
  key: string;
  skuId: string;
  label: string;
  imageUrl: string | null;
  jsonPath: string | null;
  product: ExportJsonRecord;
};

export type ParsedProductBundle = {
  mainJsonPath: string;
  mainProduct: ExportJsonRecord;
  detailJsonPath: string | null;
  skuJsonPaths: string[];
  skuProducts: ExportJsonRecord[];
  skuItems: ParsedSkuItem[];
  skuCount: number;
  sharedImagesDir: string | null;
  sharedImagePaths: string[];
};