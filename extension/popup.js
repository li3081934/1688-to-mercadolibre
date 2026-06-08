const statusText = document.getElementById("statusText");
const titleText = document.getElementById("titleText");
const filledCountText = document.getElementById("filledCountText");
const imageCountText = document.getElementById("imageCountText");
const collectButton = document.getElementById("collectButton");

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function buildArchiveBaseName(url) {
  const parsedUrl = new URL(url);
  const slug = parsedUrl.pathname.split("/").filter(Boolean).pop() || "1688-product";
  const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
  return `${slug}-${timestamp}`;
}

function sanitizePathSegment(value, fallback = "item") {
  const normalized = String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (normalized || fallback).slice(0, 80);
}

function guessFileExtension(url, contentType) {
  const normalizedType = String(contentType || "").toLowerCase();
  const typeMap = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4"
  };

  if (typeMap[normalizedType]) {
    return typeMap[normalizedType];
  }

  try {
    const pathname = new URL(url).pathname;
    const matched = pathname.match(/(\.[a-z0-9]{2,5})$/i);
    if (matched) {
      return matched[1].toLowerCase();
    }
  } catch {
    return ".jpg";
  }

  return ".jpg";
}

function buildMediaFileName(url, index, contentType) {
  const fallbackBaseName = `image-${String(index + 1).padStart(2, "0")}`;

  try {
    const pathname = new URL(url).pathname;
    const rawFileName = pathname.split("/").filter(Boolean).pop() || fallbackBaseName;
    const extension = guessFileExtension(url, contentType);
    const baseName = rawFileName.replace(/\.[a-z0-9]{2,5}$/i, "");
    return `${String(index + 1).padStart(2, "0")}-${sanitizePathSegment(baseName, fallbackBaseName)}${extension}`;
  } catch {
    return `${fallbackBaseName}${guessFileExtension(url, contentType)}`;
  }
}

function getSkuPackages(data) {
  return Array.isArray(data?.skuPackages) ? data.skuPackages : [];
}

function getImageSignature(imageUrls) {
  return imageUrls.map((url) => String(url || "").trim()).filter(Boolean).join("|");
}

function getSharedImageUrls(skuPackages) {
  if (!skuPackages.length) {
    return [];
  }

  const firstImages = Array.isArray(skuPackages[0].images) ? skuPackages[0].images : [];
  const expectedSignature = getImageSignature(firstImages);
  const allShared = skuPackages.every((skuPackage) => getImageSignature(Array.isArray(skuPackage.images) ? skuPackage.images : []) === expectedSignature);
  return allShared ? firstImages : [];
}

function countFilledFields(fields) {
  return Object.entries(fields).filter(([key, value]) => key !== "__labels" && String(value || "").trim()).length;
}

async function requestCollection(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "COLLECT_1688_PRODUCT" });
}

async function fetchAsset(url) {
  const response = await fetch(url, {
    credentials: "omit"
  });

  if (!response.ok) {
    throw new Error(`下载图片失败：${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  return {
    blob,
    contentType: response.headers.get("content-type") || blob.type
  };
}

async function addImagesToZip(folder, imageUrls, assetCache) {
  if (!imageUrls.length) {
    return 0;
  }

  const imagesFolder = folder.folder("images");
  let addedCount = 0;

  for (let index = 0; index < imageUrls.length; index += 1) {
    const imageUrl = imageUrls[index];
    if (!imageUrl) {
      continue;
    }

    if (!assetCache.has(imageUrl)) {
      assetCache.set(imageUrl, fetchAsset(imageUrl));
    }

    const asset = await assetCache.get(imageUrl);
    imagesFolder.file(buildMediaFileName(imageUrl, index, asset.contentType), asset.blob);
    addedCount += 1;
  }

  return addedCount;
}

async function downloadZipPackage(data, filenameBase) {
  const ZipLibrary = globalThis.JSZip;
  if (!ZipLibrary) {
    throw new Error("ZIP 组件未加载，请重新加载扩展后再试。");
  }

  const zip = new ZipLibrary();
  const rootFolder = zip.folder(sanitizePathSegment(filenameBase, "1688-product"));
  const assetCache = new Map();
  const skuPackages = getSkuPackages(data);
  const sharedImageUrls = getSharedImageUrls(skuPackages);
  const sharedImagesFolder = sharedImageUrls.length ? rootFolder.folder("shared-images") : null;

  rootFolder.file(`${sanitizePathSegment(filenameBase, "1688-product")}.json`, JSON.stringify(data, null, 2));

  if (sharedImagesFolder) {
    await addImagesToZip(sharedImagesFolder, sharedImageUrls, assetCache);
  }

  if (skuPackages.length) {
    const skuRootFolder = rootFolder.folder("skus");

    for (const skuPackage of skuPackages) {
      const folderName = sanitizePathSegment(skuPackage.folderName || skuPackage.skuId, skuPackage.skuId || "sku");
      const skuFolder = skuRootFolder.folder(folderName);
      const jsonFileName = sanitizePathSegment((skuPackage.jsonFileName || `${folderName}.json`).replace(/\.json$/i, ""), folderName);
      skuFolder.file(`${jsonFileName}.json`, JSON.stringify(skuPackage.exportData || skuPackage, null, 2));

      if (!sharedImageUrls.length) {
        await addImagesToZip(skuFolder, Array.isArray(skuPackage.images) ? skuPackage.images : [], assetCache);
      }
    }
  } else {
    await addImagesToZip(rootFolder, Array.isArray(data?.raw?.images) ? data.raw.images : [], assetCache);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);

  try {
    await chrome.downloads.download({
      url,
      filename: `${filenameBase}.zip`,
      saveAs: true
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function collectCurrentPage() {
  collectButton.disabled = true;
  statusText.textContent = "正在采集页面信息...";

  try {
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url || !tab.url.startsWith("https://detail.1688.com/offer/")) {
      throw new Error("请先打开 1688 商品详情页。\n支持的地址格式： https://detail.1688.com/offer/*");
    }

    const response = await requestCollection(tab.id);
    if (!response?.ok || !response.data) {
      throw new Error("内容脚本没有返回采集结果。请刷新页面后重试。");
    }

    const data = response.data;
    const filenameBase = buildArchiveBaseName(tab.url);
    await downloadZipPackage(data, filenameBase);

    statusText.textContent = data.source?.skuPackageCount
      ? `采集完成，ZIP 已触发下载（${data.source.skuPackageCount} 个 SKU JSON）。`
      : "采集完成，ZIP 已触发下载。";
    titleText.textContent = data.source.title || "-";
    filledCountText.textContent = String(countFilledFields(data.fields));
    imageCountText.textContent = String(data.raw.images.length);
  } catch (error) {
    statusText.textContent = error instanceof Error ? error.message : "采集失败。";
  } finally {
    collectButton.disabled = false;
  }
}

collectButton.addEventListener("click", collectCurrentPage);