import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { getDatabasePath } from "@/lib/storage";
import type { AIModel, ProductListItem, ProductRecord } from "@/lib/types";
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

  return database;
}

function getDb() {
  return openDatabase();
}

export function listProducts() {
  return getDb()
    .prepare(
      `SELECT id, title, offerId, zipPath, extractedDir, mainJsonPath,
              skuCount, isListed, status, lastError, lastExportedAt,
              mlItemId, createdAt, updatedAt
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
              mlItemId, createdAt, updatedAt
       FROM products
       WHERE id = ?`
    )
    .get(productId) as ProductListItem | undefined;
}

export function createProduct(product: ProductRecord) {
  getDb()
    .prepare(
      `INSERT INTO products (id, title, offerId, zipPath, extractedDir, mainJsonPath, skuCount, isListed, status, lastError, lastExportedAt, createdAt, updatedAt)
       VALUES (@id, @title, @offerId, @zipPath, @extractedDir, @mainJsonPath, @skuCount, @isListed, @status, @lastError, @lastExportedAt, @createdAt, @updatedAt)`
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
           updatedAt = @updatedAt
       WHERE id = @id`
    )
    .run(next);

  return next;
}

export function deleteProduct(productId: string) {
  getDb()
    .prepare("DELETE FROM products WHERE id = ?")
    .run(productId);
}

export function getMLAccount(): MLAccount | undefined {
  return getDb()
    .prepare("SELECT * FROM ml_accounts ORDER BY id DESC LIMIT 1")
    .get() as MLAccount | undefined;
}

export function saveMLAccount(account: Omit<MLAccount, "id">) {
  getDb()
    .prepare(
      `INSERT INTO ml_accounts (mlUserId, siteId, accessToken, refreshToken, tokenExpiresAt, nickname, createdAt, updatedAt)
       VALUES (@mlUserId, @siteId, @accessToken, @refreshToken, @tokenExpiresAt, @nickname, @createdAt, @updatedAt)`
    )
    .run(account);
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
