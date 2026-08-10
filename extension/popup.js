const statusText = document.getElementById("statusText");
const titleText = document.getElementById("titleText");
const filledCountText = document.getElementById("filledCountText");
const imageCountText = document.getElementById("imageCountText");
const collectButton = document.getElementById("collectButton");
const uploadButton = document.getElementById("uploadButton");
const serverUrlInput = document.getElementById("serverUrl");
const saveUrlButton = document.getElementById("saveUrlButton");
const skuPromptLimitInput = document.getElementById("skuPromptLimit");
const skuPicker = document.getElementById("skuPicker");
const skuPickerSummary = document.getElementById("skuPickerSummary");
const skuList = document.getElementById("skuList");
const selectedSkuCount = document.getElementById("selectedSkuCount");
const selectAllSkusButton = document.getElementById("selectAllSkusButton");
const confirmSkuButton = document.getElementById("confirmSkuButton");
const cancelSkuButton = document.getElementById("cancelSkuButton");
const skuPickerClose = document.getElementById("skuPickerClose");

let pendingSkuSelection = null;

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseJsonSafely(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function decodeHtmlEntities(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(value || "");
  return textarea.value;
}

function normalizeCollectedImageUrl(url) {
  return String(url || "")
    .trim()
    .replace(/^\\?['\"]+|\\?['\"]+$/g, "")
    .replace(/^\/\//, "https://");
}

async function loadServerUrl() {
  try {
    const result = await chrome.storage.sync.get(["serverUrl"]);
    if (result.serverUrl) {
      serverUrlInput.value = result.serverUrl;
    }
  } catch {
    // storage not available
  }
}

async function loadSkuPromptLimit() {
  try {
    const result = await chrome.storage.sync.get(["skuPromptLimit"]);
    const limit = Number.parseInt(result.skuPromptLimit, 10);
    if (Number.isInteger(limit) && limit > 0) {
      skuPromptLimitInput.value = String(limit);
    }
  } catch {
    // storage not available
  }
}

async function getSkuPromptLimit() {
  const value = Number.parseInt(skuPromptLimitInput.value, 10);
  const limit = Number.isInteger(value) && value > 0 ? value : 10;
  skuPromptLimitInput.value = String(limit);

  try {
    await chrome.storage.sync.set({ skuPromptLimit: limit });
  } catch {
    // storage not available
  }

  return limit;
}

async function saveServerUrl() {
  const url = serverUrlInput.value.trim().replace(/\/+$/, "");
  try {
    await chrome.storage.sync.set({ serverUrl: url });
    statusText.textContent = url ? "服务地址已保存。" : "已清空服务地址。";
    setTimeout(() => {
      if (statusText.textContent === (url ? "服务地址已保存。" : "已清空服务地址。")) {
        statusText.textContent = "等待操作";
      }
    }, 2000);
  } catch {
    statusText.textContent = "保存服务地址失败。";
  }
}

function ensureWarnings(data) {
  if (!Array.isArray(data.collectionWarnings)) {
    data.collectionWarnings = [];
  }

  return data.collectionWarnings;
}

function addWarning(data, message) {
  const warnings = ensureWarnings(data);
  if (!warnings.includes(message)) {
    warnings.push(message);
  }
}

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

function getDetailPayload(data) {
  if (data?.detail && typeof data.detail === "object") {
    return data.detail;
  }

  if (data?.raw?.detail && typeof data.raw.detail === "object") {
    return data.raw.detail;
  }

  return null;
}

function getAllImageUrls(data) {
  const productImages = Array.isArray(data?.product?.images) ? data.product.images : [];
  const skuImages = Array.isArray(data?.skuPackages)
    ? data.skuPackages.flatMap((item) => Array.isArray(item?.images) ? item.images : [])
    : [];
  const detailImages = Array.isArray(getDetailPayload(data)?.images) ? getDetailPayload(data).images : [];
  return Array.from(new Set([...productImages, ...skuImages, ...detailImages].map((item) => normalizeCollectedImageUrl(item)).filter(Boolean)));
}

async function fetchTextAsset(url) {
  const response = await fetch(url, {
    credentials: "omit"
  });

  if (!response.ok) {
    throw new Error(`下载详情失败：${response.status} ${response.statusText}`);
  }

  return response.text();
}

function extractImageUrlFromElement(element) {
  const candidates = [
    element.getAttribute("data-src"),
    element.getAttribute("data-lazyload-src"),
    element.getAttribute("data-lazy-src"),
    element.getAttribute("src")
  ];

  return candidates.map((value) => normalizeCollectedImageUrl(value)).find(Boolean) || "";
}

function extractDetailHtml(rawText) {
  const normalized = String(rawText || "").trim();
  if (!normalized) {
    return "";
  }

  const matched = normalized.match(/var\s+offer_details\s*=\s*(\{[\s\S]*\})\s*;?$/);
  if (!matched) {
    return normalized;
  }

  const parsed = parseJsonSafely(matched[1]);
  if (!parsed || typeof parsed.content !== "string") {
    return normalized;
  }

  return decodeHtmlEntities(parsed.content)
    .replace(/\\&quot;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/\\\//g, "/");
}

function extractImageUrlsFromText(text) {
  return Array.from(
    new Set(Array.from(String(text || "").matchAll(/https?:\/\/[^\s"'\\<>]+/g)).map((match) => normalizeCollectedImageUrl(match[0])))
  );
}

function collectDetailBlocks(root) {
  const blocks = [];

  function pushText(text) {
    const normalized = normalizeWhitespace(text);
    if (!normalized) {
      return;
    }

    const previous = blocks.at(-1);
    if (previous?.type === "text") {
      previous.text = `${previous.text}\n${normalized}`;
      return;
    }

    blocks.push({ type: "text", text: normalized });
  }

  function walk(node) {
    if (!node) {
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      pushText(node.textContent || "");
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const element = node;
    const tagName = element.tagName.toLowerCase();
    if (["script", "style", "noscript", "meta", "link"].includes(tagName)) {
      return;
    }

    if (tagName === "img") {
      const url = extractImageUrlFromElement(element);
      if (url) {
        blocks.push({ type: "image", url });
      }
      return;
    }

    for (const child of element.childNodes) {
      walk(child);
    }
  }

  walk(root);
  return blocks;
}

function parseDetailHtml(html, url) {
  const detailHtml = extractDetailHtml(html);
  const parser = new DOMParser();
  const doc = parser.parseFromString(detailHtml, "text/html");

  doc.querySelectorAll("script, style, noscript").forEach((element) => element.remove());

  const body = doc.body || doc.documentElement;
  const images = Array.from(body.querySelectorAll("img"))
    .map((element) => extractImageUrlFromElement(element))
    .concat(extractImageUrlsFromText(detailHtml))
    .filter(Boolean);
  const blocks = collectDetailBlocks(body);
  const text = blocks
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return {
    url,
    html: body.innerHTML || detailHtml,
    text,
    images: Array.from(new Set(images.map((item) => normalizeCollectedImageUrl(item)).filter(Boolean))),
    blocks: blocks.map((block) => block.type === "image" ? { ...block, url: normalizeCollectedImageUrl(block.url) } : block)
  };
}

async function enrichDetailPayload(data) {
  const detailUrl = String(data?.detail?.url || data?.product?.detailUrl || data?.source?.detailUrl || "").trim();
  if (!detailUrl) {
    return data;
  }

  try {
    const html = await fetchTextAsset(detailUrl);
    const detail = parseDetailHtml(html, detailUrl);
    data.detail = detail;
  } catch (error) {
    data.detail = {
      ...(data.detail || {}),
      url: detailUrl,
      error: error instanceof Error ? error.message : "详情抓取失败。"
    };
    addWarning(data, `详情抓取失败：${detailUrl}`);
  }

  return data;
}

function getSkuPackages(data) {
  return Array.isArray(data?.skuPackages) ? data.skuPackages : [];
}

function getSkuLabel(skuPackage) {
  return skuPackage.specAttrs || skuPackage.options?.join(" / ") || skuPackage.skuId || "未命名 SKU";
}

function updateSelectedSkuCount() {
  if (!pendingSkuSelection) {
    return;
  }

  const checkedCount = skuList.querySelectorAll("input[type='checkbox']:checked").length;
  selectedSkuCount.textContent = `已选择 ${checkedCount} / ${pendingSkuSelection.skuPackages.length}`;
  confirmSkuButton.disabled = checkedCount === 0;
  selectAllSkusButton.textContent = checkedCount === pendingSkuSelection.skuPackages.length ? "取消全选" : "全选";
}

function closeSkuPicker() {
  skuPicker.hidden = true;
  pendingSkuSelection?.resolve(null);
  pendingSkuSelection = null;
}

function openSkuPicker(skuPackages, limit) {
  return new Promise((resolve) => {
    pendingSkuSelection = { resolve, skuPackages };

    skuPickerSummary.textContent = `当前共有 ${skuPackages.length} 个 SKU，已超过提示上限 ${limit} 个，请选择要采集的 SKU。`;
    skuList.replaceChildren();

    skuPackages.forEach((skuPackage, index) => {
      const label = document.createElement("label");
      label.className = "sku-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = skuPackage.skuId || String(index);
      checkbox.checked = true;
      checkbox.addEventListener("change", updateSelectedSkuCount);

      const text = document.createElement("span");
      text.className = "sku-option-text";
      text.textContent = getSkuLabel(skuPackage);

      const id = document.createElement("span");
      id.className = "sku-option-id";
      id.textContent = `SKU ID: ${skuPackage.skuId || "-"}`;
      text.appendChild(id);

      label.append(checkbox, text);
      skuList.appendChild(label);
    });

    skuPicker.hidden = false;
    updateSelectedSkuCount();
  });
}

function getSelectedSkuIds() {
  return new Set(Array.from(skuList.querySelectorAll("input[type='checkbox']:checked")).map((input) => input.value));
}

function filterSelectedSkus(data, selectedSkuIds) {
  if (!selectedSkuIds) {
    return data;
  }

  const selectedPackages = getSkuPackages(data).filter((skuPackage, index) => selectedSkuIds.has(skuPackage.skuId || String(index)));
  return {
    ...data,
    source: {
      ...data.source,
      skuPackageCount: selectedPackages.length
    },
    skuPackages: selectedPackages
  };
}

async function chooseSkusIfNeeded(data) {
  const skuPackages = getSkuPackages(data);
  const limit = await getSkuPromptLimit();
  if (skuPackages.length <= limit) {
    return data;
  }

  const selectedSkuIds = await openSkuPicker(skuPackages, limit);
  if (!selectedSkuIds) {
    throw new Error("已取消采集。");
  }

  return filterSelectedSkus(data, selectedSkuIds);
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


async function requestCollection(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "COLLECT_1688_PRODUCT" });
}

async function fetchAsset(url) {
  const normalizedUrl = normalizeCollectedImageUrl(url);
  const response = await fetch(normalizedUrl, {
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

async function addImagesToZip(folder, imageUrls, assetCache, data, bucketLabel, folderName = "images") {
  if (!imageUrls.length) {
    return 0;
  }

  const imagesFolder = folder.folder(folderName);
  let addedCount = 0;

  for (let index = 0; index < imageUrls.length; index += 1) {
    const imageUrl = normalizeCollectedImageUrl(imageUrls[index]);
    if (!imageUrl) {
      continue;
    }

    if (!assetCache.has(imageUrl)) {
      assetCache.set(imageUrl, fetchAsset(imageUrl));
    }

    try {
      const asset = await assetCache.get(imageUrl);
      imagesFolder.file(buildMediaFileName(imageUrl, index, asset.contentType), asset.blob);
      addedCount += 1;
    } catch (error) {
      assetCache.delete(imageUrl);
      addWarning(
        data,
        `${bucketLabel || "图片"}下载失败：${imageUrl}${error instanceof Error && error.message ? ` (${error.message})` : ""}`
      );
    }
  }

  return addedCount;
}

async function addDetailToZip(rootFolder, data, assetCache) {
  const detail = getDetailPayload(data);
  if (!detail) {
    return 0;
  }

  const detailFolder = rootFolder.folder("detail");
  detailFolder.file("detail.json", JSON.stringify(detail, null, 2));

  if (detail.html) {
    detailFolder.file("detail.html", String(detail.html));
  }

  return addImagesToZip(detailFolder, Array.isArray(detail.images) ? detail.images : [], assetCache, data, "详情图片");
}

async function buildZipBlob(data, filenameBase) {
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
  const productImages = Array.isArray(data?.product?.images) ? data.product.images : [];

  await addImagesToZip(rootFolder, productImages, assetCache, data, "主图", "main-images");

  if (sharedImagesFolder) {
    await addImagesToZip(sharedImagesFolder, sharedImageUrls, assetCache, data, "共享图片");
  }

  await addDetailToZip(rootFolder, data, assetCache);

  if (skuPackages.length) {
    const skuRootFolder = rootFolder.folder("skus");

    for (const skuPackage of skuPackages) {
      const folderName = sanitizePathSegment(skuPackage.folderName || skuPackage.skuId, skuPackage.skuId || "sku");
      const skuFolder = skuRootFolder.folder(folderName);

      if (!sharedImageUrls.length) {
        await addImagesToZip(skuFolder, Array.isArray(skuPackage.images) ? skuPackage.images : [], assetCache, data, `SKU ${skuPackage.skuId || folderName} 图片`);
      }
    }
  }

  const mainJsonData = { ...data };
  delete mainJsonData.detail;
  rootFolder.file(`${sanitizePathSegment(filenameBase, "1688-product")}.json`, JSON.stringify(mainJsonData, null, 2));

  if (Array.isArray(data.collectionWarnings) && data.collectionWarnings.length) {
    rootFolder.file("collection-warnings.txt", data.collectionWarnings.join("\n"));
  }

  return zip.generateAsync({ type: "blob" });
}

async function downloadZipPackage(data, filenameBase) {
  const blob = await buildZipBlob(data, filenameBase);
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

async function uploadZipToServer(data, filenameBase) {
  const serverUrl = serverUrlInput.value.trim().replace(/\/+$/, "");
  if (!serverUrl) {
    throw new Error("请先配置系统服务地址。");
  }

  statusText.textContent = "正在构建 ZIP 包...";
  const blob = await buildZipBlob(data, filenameBase);

  statusText.textContent = "正在上传到系统...";
  const formData = new FormData();
  formData.append("zipFile", new File([blob], `${filenameBase}.zip`, { type: "application/zip" }));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(`${serverUrl}/api/products/upload`, {
      method: "POST",
      body: formData,
      signal: controller.signal
    });

    const result = await response.json();
    if (result.success) {
      return result.message || "商品 ZIP 已上传并建档。";
    }
    throw new Error(result.message || "上传失败。");
  } finally {
    clearTimeout(timeoutId);
  }
}

async function collectData() {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url || !tab.url.startsWith("https://detail.1688.com/offer/")) {
    throw new Error("请先打开 1688 商品详情页。\n支持的地址格式： https://detail.1688.com/offer/*");
  }

  const response = await requestCollection(tab.id);
  if (!response?.ok || !response.data) {
    throw new Error("内容脚本没有返回采集结果。请刷新页面后重试。");
  }

  const data = await enrichDetailPayload(response.data);
  const filenameBase = buildArchiveBaseName(tab.url);

  return { data, filenameBase };
}

function displayResult(data) {
  const successMessage = data.source?.skuPackageCount
    ? `（${data.source.skuPackageCount} 个 SKU）`
    : "";
  const warningSuffix = Array.isArray(data.collectionWarnings) && data.collectionWarnings.length
    ? `，但有 ${data.collectionWarnings.length} 个资源下载失败。`
    : "。";
  statusText.textContent = `采集完成${successMessage}${warningSuffix}`;
  titleText.textContent = data.source.title || "-";
  filledCountText.textContent = String(getSkuPackages(data).length);
  imageCountText.textContent = String(getAllImageUrls(data).length);
}

function setButtonsDisabled(disabled) {
  collectButton.disabled = disabled;
  uploadButton.disabled = disabled;
}

async function collectAndDownload() {
  setButtonsDisabled(true);
  statusText.textContent = "正在采集页面信息...";

  try {
    const collected = await collectData();
    const data = await chooseSkusIfNeeded(collected.data);
    await downloadZipPackage(data, collected.filenameBase);
    displayResult(data);
    statusText.textContent = "采集完成，ZIP 已触发下载。" + (
      Array.isArray(data.collectionWarnings) && data.collectionWarnings.length
        ? ` 但有 ${data.collectionWarnings.length} 个资源下载失败。`
        : ""
    );
  } catch (error) {
    statusText.textContent = error instanceof Error ? error.message : "采集失败。";
  } finally {
    setButtonsDisabled(false);
  }
}

async function collectAndUpload() {
  setButtonsDisabled(true);

  try {
    await saveServerUrl();
    statusText.textContent = "正在采集页面信息...";
    const collected = await collectData();
    const data = await chooseSkusIfNeeded(collected.data);
    const message = await uploadZipToServer(data, collected.filenameBase);
    displayResult(data);
    statusText.textContent = message;
  } catch (error) {
    statusText.textContent = error instanceof Error ? error.message : "操作失败。";
  } finally {
    setButtonsDisabled(false);
  }
}

collectButton.addEventListener("click", collectAndDownload);
uploadButton.addEventListener("click", collectAndUpload);
saveUrlButton.addEventListener("click", saveServerUrl);
selectAllSkusButton.addEventListener("click", () => {
  const checkboxes = skuList.querySelectorAll("input[type='checkbox']");
  const shouldSelect = Array.from(checkboxes).some((checkbox) => !checkbox.checked);
  checkboxes.forEach((checkbox) => {
    checkbox.checked = shouldSelect;
  });
  updateSelectedSkuCount();
});
confirmSkuButton.addEventListener("click", () => {
  if (!pendingSkuSelection) {
    return;
  }

  const selectedSkuIds = getSelectedSkuIds();
  const resolve = pendingSkuSelection.resolve;
  skuPicker.hidden = true;
  pendingSkuSelection = null;
  resolve(selectedSkuIds);
});
cancelSkuButton.addEventListener("click", closeSkuPicker);
skuPickerClose.addEventListener("click", closeSkuPicker);

loadServerUrl();
loadSkuPromptLimit();