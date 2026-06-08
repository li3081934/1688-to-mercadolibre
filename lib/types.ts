export type TemplateField = {
  column: string;
  key?: string;
  label?: string;
  value?: string | number | null;
};

export type ExportJsonRecord = {
  generatedAt?: string;
  source?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  templateFields: TemplateField[];
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
  jsonPath: string;
  product: ExportJsonRecord;
};

export type ParsedProductBundle = {
  mainJsonPath: string;
  mainProduct: ExportJsonRecord;
  skuJsonPaths: string[];
  skuProducts: ExportJsonRecord[];
  skuItems: ParsedSkuItem[];
  skuCount: number;
  sharedImagesDir: string | null;
  sharedImagePaths: string[];
};