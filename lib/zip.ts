import { readdir } from "node:fs/promises";
import path from "node:path";

import AdmZip from "adm-zip";

import { ensureDirectory } from "@/lib/storage";

export async function extractZipArchive(zipPath: string, outputDir: string) {
  await ensureDirectory(outputDir);
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(outputDir, true);
}

export async function walkFiles(directoryPath: string): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(fullPath);
      }

      return [fullPath];
    })
  );

  return files.flat();
}