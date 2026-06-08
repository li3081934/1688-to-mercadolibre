import { mkdirSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { getDatabasePath } from "@/lib/storage";
import type { CategoryRecord, ProductListItem, ProductRecord } from "@/lib/types";

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
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      sheetName TEXT NOT NULL,
      templatePath TEXT NOT NULL,
      mapperPath TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      categoryId TEXT NOT NULL,
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
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );
  `);

  return database;
}

function getDb() {
  return openDatabase();
}

export function listCategories() {
  return getDb()
    .prepare("SELECT * FROM categories ORDER BY createdAt DESC")
    .all() as CategoryRecord[];
}

export function listActiveCategories() {
  return getDb()
    .prepare("SELECT * FROM categories WHERE isActive = 1 ORDER BY name ASC")
    .all() as CategoryRecord[];
}

export function getCategoryById(categoryId: string) {
  return getDb()
    .prepare("SELECT * FROM categories WHERE id = ?")
    .get(categoryId) as CategoryRecord | undefined;
}

export function createCategory(category: CategoryRecord) {
  getDb()
    .prepare(
      `INSERT INTO categories (id, code, name, sheetName, templatePath, mapperPath, isActive, createdAt, updatedAt)
       VALUES (@id, @code, @name, @sheetName, @templatePath, @mapperPath, @isActive, @createdAt, @updatedAt)`
    )
    .run(category);
}

export function updateCategory(categoryId: string, patch: Partial<Omit<CategoryRecord, "id" | "createdAt">>) {
  const current = getCategoryById(categoryId);
  if (!current) {
    throw new Error("分类不存在。");
  }

  const next: CategoryRecord = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  };

  getDb()
    .prepare(
      `UPDATE categories
       SET code = @code,
           name = @name,
           sheetName = @sheetName,
           templatePath = @templatePath,
           mapperPath = @mapperPath,
           isActive = @isActive,
           updatedAt = @updatedAt
       WHERE id = @id`
    )
    .run(next);

  return next;
}

export function countProductsByCategory(categoryId: string) {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS total FROM products WHERE categoryId = ?")
    .get(categoryId) as { total: number } | undefined;

  return row?.total ?? 0;
}

export function deleteCategory(categoryId: string) {
  getDb()
    .prepare("DELETE FROM categories WHERE id = ?")
    .run(categoryId);
}

export function listProducts() {
  return getDb()
    .prepare(
      `SELECT products.*, categories.code AS categoryCode, categories.name AS categoryName,
              categories.sheetName AS categorySheetName, categories.templatePath AS categoryTemplatePath,
              categories.mapperPath AS categoryMapperPath
       FROM products
       INNER JOIN categories ON categories.id = products.categoryId
       ORDER BY products.createdAt DESC`
    )
    .all() as ProductListItem[];
}

export function getProductById(productId: string) {
  return getDb()
    .prepare(
      `SELECT products.*, categories.code AS categoryCode, categories.name AS categoryName,
              categories.sheetName AS categorySheetName, categories.templatePath AS categoryTemplatePath,
              categories.mapperPath AS categoryMapperPath
       FROM products
       INNER JOIN categories ON categories.id = products.categoryId
       WHERE products.id = ?`
    )
    .get(productId) as ProductListItem | undefined;
}

export function createProduct(product: ProductRecord) {
  getDb()
    .prepare(
      `INSERT INTO products (id, categoryId, title, offerId, zipPath, extractedDir, mainJsonPath, skuCount, isListed, status, lastError, lastExportedAt, createdAt, updatedAt)
       VALUES (@id, @categoryId, @title, @offerId, @zipPath, @extractedDir, @mainJsonPath, @skuCount, @isListed, @status, @lastError, @lastExportedAt, @createdAt, @updatedAt)`
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
       SET categoryId = @categoryId,
           title = @title,
           offerId = @offerId,
           zipPath = @zipPath,
           extractedDir = @extractedDir,
           mainJsonPath = @mainJsonPath,
           skuCount = @skuCount,
           isListed = @isListed,
           status = @status,
           lastError = @lastError,
           lastExportedAt = @lastExportedAt,
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