import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const STORAGE_ROOT = path.join(process.cwd(), "storage");

export function getDatabasePath() {
  return path.join(STORAGE_ROOT, "app.db");
}

export function getCategoryDir(categoryId: string) {
  return path.join(STORAGE_ROOT, "categories", categoryId);
}

export function getProductDir(productId: string) {
  return path.join(STORAGE_ROOT, "products", productId);
}

export async function ensureDirectory(directoryPath: string) {
  await mkdir(directoryPath, { recursive: true });
}

export async function saveFormFile(file: File, filePath: string) {
  const buffer = Buffer.from(await file.arrayBuffer());
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, buffer);
}

export async function replaceFormFile(file: File, finalPath: string, tempSuffix = ".tmp") {
  const tempPath = `${finalPath}${tempSuffix}`;
  await saveFormFile(file, tempPath);
  await rename(tempPath, finalPath);
}

export async function removeDirectory(directoryPath: string) {
  await rm(directoryPath, { recursive: true, force: true });
}

export function toRelativeStoragePath(targetPath: string) {
  return path.relative(process.cwd(), targetPath).replace(/\\/g, "/");
}