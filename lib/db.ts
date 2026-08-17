import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { getDatabasePath } from "@/lib/storage";
import type {
  AIModel,
  MLUserProductRecord,
  MLPublishedProductMapping,
  ProductListItem,
  ProductRecord,
} from "@/lib/types";
import type { MLAccount } from "@/lib/mercadolibre/types";

let database: Database.Database | null = null;

function openDatabase() {
  if (database) {
    return database;
  }

  const dbPath = getDatabasePath();
  mkdirSync(path.dirname(dbPath), { recursive: true });

  database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      offerId TEXT NOT NULL,
      zipPath TEXT NOT NULL,
      extractedDir TEXT NOT NULL,
      mainJsonPath TEXT NOT NULL,
      skuCount INTEGER NOT NULL DEFAULT 0,
      isListed INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'ready',
      lastError TEXT,
      lastExportedAt TEXT,
      mlItemId TEXT DEFAULT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      apiKey TEXT NOT NULL,
      modelName TEXT NOT NULL,
      systemPrompt TEXT NOT NULL DEFAULT '',
      protocol TEXT NOT NULL DEFAULT 'openai',
      thinkingEnabled INTEGER NOT NULL DEFAULT 0,
      purpose TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ml_user_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId TEXT NOT NULL,
      skuKey TEXT NOT NULL,
      sitelessUserProductId TEXT,
      familyId TEXT,
      familyName TEXT,
      cbtItemId TEXT,
      siteItems TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (productId) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS ml_published_product_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId TEXT NOT NULL,
      skuKey TEXT NOT NULL,
      sourceSku TEXT NOT NULL,
      sellerSku TEXT NOT NULL UNIQUE,
      sitelessUserProductId TEXT,
      cbtItemId TEXT,
      parentUserProductId TEXT,
      familyId TEXT,
      siteItems TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE (productId, skuKey),
      FOREIGN KEY (productId) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS ml_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mlUserId INTEGER NOT NULL UNIQUE,
      siteId TEXT NOT NULL,
      accessToken TEXT NOT NULL,
      refreshToken TEXT NOT NULL,
      tokenExpiresAt TEXT NOT NULL,
      nickname TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS translation_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sourceLocale TEXT NOT NULL,
      targetLocale TEXT NOT NULL,
      sourceText TEXT NOT NULL,
      translatedText TEXT NOT NULL,
      context TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT 'v1',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(sourceLocale, targetLocale, sourceText, context, version)
    );

    CREATE TABLE IF NOT EXISTS ml_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      siteId TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      parentCategoryId TEXT,
      name TEXT NOT NULL,
      displayName TEXT NOT NULL,
      pathFromRoot TEXT NOT NULL DEFAULT '[]',
      hasChildren INTEGER NOT NULL DEFAULT 0,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      syncedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(siteId, categoryId)
    );
    CREATE INDEX IF NOT EXISTS idx_ml_categories_parent
      ON ml_categories(siteId, parentCategoryId, sortOrder);

  `);

  try {
    database.exec(`ALTER TABLE products ADD COLUMN mlItemId TEXT DEFAULT NULL`);
  } catch {

  }

  try {
    database.exec(`ALTER TABLE ai_models ADD COLUMN protocol TEXT NOT NULL DEFAULT 'openai'`);
  } catch {

  }

  try {
    database.exec(`ALTER TABLE ai_models ADD COLUMN thinkingEnabled INTEGER NOT NULL DEFAULT 0`);
  } catch {

  }

  try {
    database.exec(`ALTER TABLE ml_accounts ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`);
  } catch {

  }

  try {
    database.exec(`ALTER TABLE ml_accounts ADD COLUMN forceUserProduct INTEGER NOT NULL DEFAULT 0`);
  } catch {

  }

  try {
    database.exec(`ALTER TABLE products ADD COLUMN familyName TEXT DEFAULT NULL`);
  } catch {

  }

  try {
    database.exec(`ALTER TABLE products ADD COLUMN userProductId TEXT DEFAULT NULL`);
  } catch {

  }

  try {
    database.exec(`ALTER TABLE products ADD COLUMN familyId TEXT DEFAULT NULL`);
  } catch {

  }

  try {
    database.exec(`ALTER TABLE products ADD COLUMN parentUserProductId TEXT DEFAULT NULL`);
  } catch {

  }

  try {
    database.exec(`ALTER TABLE products ADD COLUMN publishModel TEXT NOT NULL DEFAULT 'classic'`);
  } catch {

  }

  try {
    database.exec(`ALTER TABLE ml_accounts ADD COLUMN isCurrent INTEGER NOT NULL DEFAULT 0`);
  } catch {

  }

  try {
    database.exec(`ALTER TABLE ml_accounts ADD COLUMN isTestUser INTEGER NOT NULL DEFAULT 0`);
  } catch {

  }

  try {
    database.exec(`ALTER TABLE ml_accounts ADD COLUMN password TEXT NOT NULL DEFAULT ''`);
  } catch {

  }

  const currentCount = database.prepare("SELECT COUNT(*) as cnt FROM ml_accounts WHERE isCurrent = 1").get() as { cnt: number } | undefined;
  if (currentCount && currentCount.cnt === 0) {
    const first = database.prepare("SELECT id, mlUserId FROM ml_accounts ORDER BY id ASC LIMIT 1").get() as { id: number; mlUserId: number } | undefined;
    if (first) {
      database.prepare("UPDATE ml_accounts SET isCurrent = 1, updatedAt = ? WHERE id = ?").run(new Date().toISOString(), first.id);
    }
  }

  return database;
}

function getDb() {
  return openDatabase();
}

export type MLCategoryRecord = {
  siteId: string;
  categoryId: string;
  parentCategoryId: string | null;
  name: string;
  displayName: string;
  pathFromRoot: Array<{ id: string; name: string }>;
  hasChildren: boolean;
  sortOrder: number;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
};

type MLCategoryRow = Omit<MLCategoryRecord, "pathFromRoot" | "hasChildren"> & {
  pathFromRoot: string;
  hasChildren: number;
};

function mapMLCategoryRow(row: MLCategoryRow): MLCategoryRecord {
  return {
    ...row,
    pathFromRoot: JSON.parse(row.pathFromRoot) as MLCategoryRecord["pathFromRoot"],
    hasChildren: Boolean(row.hasChildren),
  };
}

export function listMLCategoryRoots(siteId: string) {
  const rows = getDb()
    .prepare(
      `SELECT siteId, categoryId, parentCategoryId, name, displayName,
              pathFromRoot, hasChildren, sortOrder, syncedAt, createdAt, updatedAt
       FROM ml_categories
       WHERE siteId = ? AND parentCategoryId IS NULL
       ORDER BY sortOrder ASC, displayName COLLATE NOCASE ASC`
    )
    .all(siteId) as MLCategoryRow[];
  return rows.map(mapMLCategoryRow);
}

export function listMLCategories(siteId: string) {
  const rows = getDb()
    .prepare(
      `SELECT siteId, categoryId, parentCategoryId, name, displayName,
              pathFromRoot, hasChildren, sortOrder, syncedAt, createdAt, updatedAt
       FROM ml_categories
       WHERE siteId = ?
       ORDER BY pathFromRoot ASC, sortOrder ASC, displayName COLLATE NOCASE ASC`
    )
    .all(siteId) as MLCategoryRow[];
  return rows.map(mapMLCategoryRow);
}

export function listMLCategoryChildren(siteId: string, parentCategoryId: string) {
  const rows = getDb()
    .prepare(
      `SELECT siteId, categoryId, parentCategoryId, name, displayName,
              pathFromRoot, hasChildren, sortOrder, syncedAt, createdAt, updatedAt
       FROM ml_categories
       WHERE siteId = ? AND parentCategoryId = ?
       ORDER BY sortOrder ASC, displayName COLLATE NOCASE ASC`
    )
    .all(siteId, parentCategoryId) as MLCategoryRow[];
  return rows.map(mapMLCategoryRow);
}

export function getMLCategorySyncStatus(siteId: string) {
  return getDb()
    .prepare(
      `SELECT COUNT(*) as total, MAX(syncedAt) as syncedAt
       FROM ml_categories WHERE siteId = ?`
    )
    .get(siteId) as { total: number; syncedAt: string | null };
}

export function upsertMLCategories(categories: MLCategoryRecord[]) {
  if (categories.length === 0) return;
  const db = getDb();
  const statement = db.prepare(
    `INSERT INTO ml_categories (
       siteId, categoryId, parentCategoryId, name, displayName, pathFromRoot,
       hasChildren, sortOrder, syncedAt, createdAt, updatedAt
     ) VALUES (
       @siteId, @categoryId, @parentCategoryId, @name, @displayName, @pathFromRoot,
       @hasChildren, @sortOrder, @syncedAt, @createdAt, @updatedAt
     ) ON CONFLICT(siteId, categoryId) DO UPDATE SET
       parentCategoryId = excluded.parentCategoryId,
       name = excluded.name,
       displayName = excluded.displayName,
       pathFromRoot = excluded.pathFromRoot,
       hasChildren = excluded.hasChildren,
       sortOrder = excluded.sortOrder,
       syncedAt = excluded.syncedAt,
       updatedAt = excluded.updatedAt`
  );
  const insertMany = db.transaction((items: MLCategoryRecord[]) => {
    for (const category of items) {
      statement.run({
        ...category,
        pathFromRoot: JSON.stringify(category.pathFromRoot),
        hasChildren: category.hasChildren ? 1 : 0,
      });
    }
  });
  insertMany(categories);
}

export function pruneMLCategories(siteId: string, seenCategoryIds: string[]) {
  if (seenCategoryIds.length === 0) return 0;
  const placeholders = seenCategoryIds.map(() => "?").join(", ");
  const result = getDb()
    .prepare(
      `DELETE FROM ml_categories
       WHERE siteId = ? AND categoryId NOT IN (${placeholders})`
    )
    .run(siteId, ...seenCategoryIds);
  return result.changes;
}

export type TranslationCacheRecord = {
  sourceLocale: string;
  targetLocale: string;
  sourceText: string;
  translatedText: string;
  context: string;
  version: string;
};

export type TranslationCacheListItem = TranslationCacheRecord & {
  id: number;
  createdAt: string;
  updatedAt: string;
};

export type TranslationCacheFilters = {
  page?: number;
  pageSize?: number;
  keyword?: string;
  sourceLocale?: string;
  targetLocale?: string;
  context?: string;
  version?: string;
};

export function getTranslationCache(
  sourceLocale: string,
  targetLocale: string,
  sourceText: string,
  context: string,
  version: string,
) {
  return getDb()
    .prepare(
      `SELECT sourceLocale, targetLocale, sourceText, translatedText, context, version
       FROM translation_cache
       WHERE sourceLocale = ? AND targetLocale = ? AND sourceText = ? AND context = ? AND version = ?`
    )
    .get(sourceLocale, targetLocale, sourceText, context, version) as TranslationCacheRecord | undefined;
}

export function saveTranslationCache(record: TranslationCacheRecord) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO translation_cache (
         sourceLocale, targetLocale, sourceText, translatedText, context, version, createdAt, updatedAt
       ) VALUES (
         @sourceLocale, @targetLocale, @sourceText, @translatedText, @context, @version, @createdAt, @updatedAt
       )
       ON CONFLICT(sourceLocale, targetLocale, sourceText, context, version) DO UPDATE SET
         translatedText = excluded.translatedText,
         updatedAt = excluded.updatedAt`
    )
    .run({ ...record, createdAt: now, updatedAt: now });
}

export function listTranslationCache(filters: TranslationCacheFilters = {}) {
  const page = Math.max(Math.floor(filters.page || 1), 1);
  const pageSize = Math.min(Math.max(Math.floor(filters.pageSize || 20), 1), 100);
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  if (filters.keyword) {
    conditions.push("(sourceText LIKE ? OR translatedText LIKE ?)");
    const keyword = `%${filters.keyword}%`;
    values.push(keyword, keyword);
  }
  if (filters.sourceLocale) {
    conditions.push("sourceLocale = ?");
    values.push(filters.sourceLocale);
  }
  if (filters.targetLocale) {
    conditions.push("targetLocale = ?");
    values.push(filters.targetLocale);
  }
  if (filters.context) {
    conditions.push("context = ?");
    values.push(filters.context);
  }
  if (filters.version) {
    conditions.push("version = ?");
    values.push(filters.version);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const database = getDb();
  const totalRow = database
    .prepare(`SELECT COUNT(*) as total FROM translation_cache ${where}`)
    .get(...values) as { total: number };
  const total = totalRow.total;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * pageSize;
  const data = database
    .prepare(
      `SELECT id, sourceLocale, targetLocale, sourceText, translatedText,
              context, version, createdAt, updatedAt
       FROM translation_cache
       ${where}
       ORDER BY updatedAt DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...values, pageSize, offset) as TranslationCacheListItem[];

  return { data, total, page: currentPage, pageSize, totalPages };
}

export function updateTranslationCacheText(id: number, translatedText: string) {
  const updatedAt = new Date().toISOString();
  const result = getDb()
    .prepare(
      `UPDATE translation_cache
       SET translatedText = ?, updatedAt = ?
       WHERE id = ?`,
    )
    .run(translatedText, updatedAt, id);
  if (result.changes === 0) return undefined;
  return getDb()
    .prepare(
      `SELECT id, sourceLocale, targetLocale, sourceText, translatedText,
              context, version, createdAt, updatedAt
       FROM translation_cache
       WHERE id = ?`,
    )
    .get(id) as TranslationCacheListItem;
}

export function listProducts() {
  return getDb()
    .prepare(
      `SELECT id, title, offerId, zipPath, extractedDir, mainJsonPath,
              skuCount, isListed, status, lastError, lastExportedAt,
              mlItemId, familyName, userProductId, familyId,
              parentUserProductId, publishModel, createdAt, updatedAt
       FROM products
       ORDER BY createdAt DESC`
    )
    .all() as ProductListItem[];
}

export function getProductById(productId: string) {
  return getDb()
    .prepare(
      `SELECT id, title, offerId, zipPath, extractedDir, mainJsonPath,
              skuCount, isListed, status, lastError, lastExportedAt,
              mlItemId, familyName, userProductId, familyId,
              parentUserProductId, publishModel, createdAt, updatedAt
       FROM products
       WHERE id = ?`
    )
    .get(productId) as ProductListItem | undefined;
}

export function createProduct(product: ProductRecord) {
  getDb()
    .prepare(
      `INSERT INTO products (id, title, offerId, zipPath, extractedDir, mainJsonPath, skuCount, isListed, status, lastError, lastExportedAt, mlItemId, familyName, userProductId, familyId, parentUserProductId, publishModel, createdAt, updatedAt)
       VALUES (@id, @title, @offerId, @zipPath, @extractedDir, @mainJsonPath, @skuCount, @isListed, @status, @lastError, @lastExportedAt, @mlItemId, @familyName, @userProductId, @familyId, @parentUserProductId, @publishModel, @createdAt, @updatedAt)`
    )
    .run(product);
}

export function updateProduct(productId: string, patch: Partial<Omit<ProductRecord, "id" | "createdAt">>) {
  const current = getDb()
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(productId) as ProductRecord | undefined;

  if (!current) {
    throw new Error("商品不存在。");
  }

  const next: ProductRecord = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  };

  getDb()
    .prepare(
      `UPDATE products
       SET title = @title,
           offerId = @offerId,
           zipPath = @zipPath,
           extractedDir = @extractedDir,
           mainJsonPath = @mainJsonPath,
           skuCount = @skuCount,
           isListed = @isListed,
           status = @status,
           lastError = @lastError,
           lastExportedAt = @lastExportedAt,
           mlItemId = @mlItemId,
           familyName = @familyName,
           userProductId = @userProductId,
           familyId = @familyId,
           parentUserProductId = @parentUserProductId,
           publishModel = @publishModel,
           updatedAt = @updatedAt
       WHERE id = @id`
    )
    .run(next);

  return next;
}

export function deleteProduct(productId: string) {
  const db = getDb();
  db.prepare("DELETE FROM ml_published_product_mappings WHERE productId = ?").run(productId);
  db.prepare("DELETE FROM ml_user_products WHERE productId = ?").run(productId);
  db.prepare("DELETE FROM products WHERE id = ?").run(productId);
}

export function getMLAccount(): MLAccount | undefined {
  return getDb()
    .prepare("SELECT * FROM ml_accounts WHERE isCurrent = 1")
    .get() as MLAccount | undefined;
}

export function getMLAccountByUserId(mlUserId: number): MLAccount | undefined {
  return getDb()
    .prepare("SELECT * FROM ml_accounts WHERE mlUserId = ?")
    .get(mlUserId) as MLAccount | undefined;
}

export function listMLAccounts(): MLAccount[] {
  return getDb()
    .prepare("SELECT * FROM ml_accounts ORDER BY isCurrent DESC, id DESC")
    .all() as MLAccount[];
}

export function saveMLAccount(account: Omit<MLAccount, "id">) {
  getDb()
    .prepare(
      `INSERT INTO ml_accounts (mlUserId, siteId, accessToken, refreshToken, tokenExpiresAt, nickname, tags, forceUserProduct, isCurrent, isTestUser, password, createdAt, updatedAt)
       VALUES (@mlUserId, @siteId, @accessToken, @refreshToken, @tokenExpiresAt, @nickname, @tags, @forceUserProduct, @isCurrent, @isTestUser, @password, @createdAt, @updatedAt)`
    )
    .run(account);
}

export function setCurrentMLAccount(mlUserId: number) {
  getDb().prepare("UPDATE ml_accounts SET isCurrent = 0").run();
  getDb()
    .prepare("UPDATE ml_accounts SET isCurrent = 1, updatedAt = ? WHERE mlUserId = ?")
    .run(new Date().toISOString(), mlUserId);
}

export function deleteMLAccount(mlUserId: number) {
  getDb().prepare("DELETE FROM ml_accounts WHERE mlUserId = ?").run(mlUserId);
}

export function updateMLAccount(mlUserId: number, patch: { accessToken?: string; refreshToken?: string; tokenExpiresAt?: string }) {
  const current = getDb()
    .prepare("SELECT * FROM ml_accounts WHERE mlUserId = ?")
    .get(mlUserId) as MLAccount | undefined;

  if (!current) {
    throw new Error("ML 账号不存在。");
  }

  getDb()
    .prepare(
      `UPDATE ml_accounts
       SET accessToken = @accessToken,
           refreshToken = @refreshToken,
           tokenExpiresAt = @tokenExpiresAt,
           updatedAt = @updatedAt
       WHERE mlUserId = @mlUserId`
    )
    .run({
      ...current,
      ...patch,
      mlUserId,
      updatedAt: new Date().toISOString(),
    });
}

export function getMLUserProductsByProductId(productId: string) {
  return getDb()
    .prepare(
      `SELECT id, productId, skuKey, sitelessUserProductId, familyId,
              familyName, cbtItemId, siteItems, createdAt, updatedAt
       FROM ml_user_products
       WHERE productId = ?
       ORDER BY id ASC`
    )
    .all(productId) as MLUserProductRecord[];
}

export function createMLUserProduct(record: Omit<MLUserProductRecord, "id">) {
  return getDb()
    .prepare(
      `INSERT INTO ml_user_products (productId, skuKey, sitelessUserProductId, familyId, familyName, cbtItemId, siteItems, createdAt, updatedAt)
       VALUES (@productId, @skuKey, @sitelessUserProductId, @familyId, @familyName, @cbtItemId, @siteItems, @createdAt, @updatedAt)`
    )
    .run(record);
}

export function upsertMLPublishedProductMapping(
  record: Omit<MLPublishedProductMapping, "id">
) {
  return getDb()
    .prepare(
      `INSERT INTO ml_published_product_mappings (
         productId, skuKey, sourceSku, sellerSku, sitelessUserProductId,
         cbtItemId, parentUserProductId, familyId, siteItems, createdAt, updatedAt
       ) VALUES (
         @productId, @skuKey, @sourceSku, @sellerSku, @sitelessUserProductId,
         @cbtItemId, @parentUserProductId, @familyId, @siteItems, @createdAt, @updatedAt
       )
       ON CONFLICT(productId, skuKey) DO UPDATE SET
         sourceSku = excluded.sourceSku,
         sellerSku = excluded.sellerSku,
         sitelessUserProductId = excluded.sitelessUserProductId,
         cbtItemId = excluded.cbtItemId,
         parentUserProductId = excluded.parentUserProductId,
         familyId = excluded.familyId,
         siteItems = excluded.siteItems,
         updatedAt = excluded.updatedAt`
    )
    .run(record);
}

export function getMLPublishedProductMappingsByProductId(productId: string) {
  return getDb()
    .prepare(
      `SELECT id, productId, skuKey, sourceSku, sellerSku,
              sitelessUserProductId, cbtItemId, parentUserProductId,
              familyId, siteItems, createdAt, updatedAt
       FROM ml_published_product_mappings
       WHERE productId = ?
       ORDER BY id ASC`
    )
    .all(productId) as MLPublishedProductMapping[];
}

export function getAllMLPublishedProductMappings() {
  return getDb()
    .prepare(
      `SELECT id, productId, skuKey, sourceSku, sellerSku,
              sitelessUserProductId, cbtItemId, parentUserProductId,
              familyId, siteItems, createdAt, updatedAt
       FROM ml_published_product_mappings
       ORDER BY updatedAt DESC, id DESC`
    )
    .all() as MLPublishedProductMapping[];
}

export function getMLPublishedProductMappingBySellerSku(sellerSku: string) {
  return getDb()
    .prepare(
      `SELECT id, productId, skuKey, sourceSku, sellerSku,
              sitelessUserProductId, cbtItemId, parentUserProductId,
              familyId, siteItems, createdAt, updatedAt
       FROM ml_published_product_mappings
       WHERE sellerSku = ?`
    )
    .get(sellerSku) as MLPublishedProductMapping | undefined;
}

export function getMLPublishedProductMappingBySitelessId(sitelessUserProductId: string) {
  return getDb()
    .prepare(
      `SELECT id, productId, skuKey, sourceSku, sellerSku,
              sitelessUserProductId, cbtItemId, parentUserProductId,
              familyId, siteItems, createdAt, updatedAt
       FROM ml_published_product_mappings
       WHERE sitelessUserProductId = ?`
    )
    .get(sitelessUserProductId) as MLPublishedProductMapping | undefined;
}

export function deleteMLPublishedProductMappingsByProductId(productId: string) {
  getDb()
    .prepare("DELETE FROM ml_published_product_mappings WHERE productId = ?")
    .run(productId);
}

export function deleteMLUserProductsByProductId(productId: string) {
  getDb()
    .prepare("DELETE FROM ml_user_products WHERE productId = ?")
    .run(productId);
}

export function getForceUserProduct(): boolean {
  const account = getMLAccount();
  return account ? account.forceUserProduct === 1 : false;
}

export function setForceUserProduct(mlUserId: number, force: boolean) {
  getDb()
    .prepare(
      `UPDATE ml_accounts
       SET forceUserProduct = @force,
           updatedAt = @updatedAt
       WHERE mlUserId = @mlUserId`
    )
    .run({
      mlUserId,
      force: force ? 1 : 0,
      updatedAt: new Date().toISOString(),
    });
}

export function updateMLAccountTags(mlUserId: number, tags: string[]) {
  getDb()
    .prepare(
      `UPDATE ml_accounts
       SET tags = @tags,
           updatedAt = @updatedAt
       WHERE mlUserId = @mlUserId`
    )
    .run({
      mlUserId,
      tags: JSON.stringify(tags),
      updatedAt: new Date().toISOString(),
    });
}

function toDbModel(row: Record<string, unknown>): Record<string, unknown> {
  if ("thinkingEnabled" in row) {
    row.thinkingEnabled = row.thinkingEnabled ? 1 : 0;
  }
  return row;
}

function fromDbModel(row: Record<string, unknown>): Record<string, unknown> {
  if (row && "thinkingEnabled" in row) {
    row.thinkingEnabled = !!row.thinkingEnabled;
  }
  return row;
}

export function listAIModels() {
  return getDb()
    .prepare("SELECT * FROM ai_models ORDER BY createdAt DESC")
    .all()
    .map((row) => fromDbModel(row as Record<string, unknown>)) as AIModel[];
}

export function getAIModelById(id: number) {
  const row = getDb()
    .prepare("SELECT * FROM ai_models WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? fromDbModel(row) as AIModel : undefined;
}

export function createAIModel(model: Omit<AIModel, "id">) {
  getDb()
    .prepare(
      `INSERT INTO ai_models (name, url, apiKey, modelName, systemPrompt, protocol, thinkingEnabled, purpose, createdAt, updatedAt)
       VALUES (@name, @url, @apiKey, @modelName, @systemPrompt, @protocol, @thinkingEnabled, @purpose, @createdAt, @updatedAt)`
    )
    .run(toDbModel({ ...model }));
}

export function updateAIModel(id: number, patch: Partial<Omit<AIModel, "id" | "createdAt">>) {
  const current = getDb()
    .prepare("SELECT * FROM ai_models WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;

  if (!current) {
    throw new Error("AI 模型不存在。");
  }

  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  getDb()
    .prepare(
      `UPDATE ai_models
       SET name = @name,
           url = @url,
           apiKey = @apiKey,
           modelName = @modelName,
           systemPrompt = @systemPrompt,
           protocol = @protocol,
           thinkingEnabled = @thinkingEnabled,
           purpose = @purpose,
           updatedAt = @updatedAt
       WHERE id = @id`
    )
    .run(toDbModel(next));

  return fromDbModel(next) as AIModel;
}

export function deleteAIModel(id: number) {
  getDb()
    .prepare("DELETE FROM ai_models WHERE id = ?")
    .run(id);
}
