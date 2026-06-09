const STRUCTURED_DATA_EVENT = "COLLECT_1688_STRUCTURED_DATA";

let structuredDataPromise = null;
let structuredDataCache = null;

function textFromSelectors(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = element?.textContent?.trim();
    if (text) {
      return text;
    }
  }

  return "";
}

function attributeFromSelectors(selectors, attributeName) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const value = element?.getAttribute(attributeName)?.trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function normalizeWhitespace(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(value || "");
  return textarea.value;
}

function sanitizeFileNameSegment(value, fallback = "item") {
  const normalized = String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (normalized || fallback).slice(0, 80);
}

function normalizeImageUrl(url) {
  if (!url) {
    return "";
  }

  return url
    .replace(/^\\?['\"]+|\\?['\"]+$/g, "")
    .replace(/^\/\//, "https://")
    .replace(/\.jpg_sum\.jpg.*$/i, ".jpg")
    .replace(/\.png_sum\.jpg.*$/i, ".png")
    .replace(/_sum\.jpg.*$/i, "")
    .replace(/\.([0-9]+)x([0-9]+)\.jpg.*$/i, ".jpg")
    .replace(/_[0-9]+x[0-9]+\.jpg.*$/i, ".jpg")
    .replace(/\.jpg_\.webp$/i, ".jpg");
}

const PACKAGE_KEYWORDS = ["包装", "箱装", "装箱", "重量", "件重", "毛重", "净重", "尺寸", "长", "宽", "高", "体积"];

function hasPackageKeyword(value) {
  return PACKAGE_KEYWORDS.some((keyword) => String(value || "").includes(keyword));
}

function parseJsonSafely(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function requestStructuredPageData() {
  if (structuredDataPromise) {
    return structuredDataPromise;
  }

  structuredDataPromise = new Promise((resolve) => {
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const bridgeScript = document.createElement("script");

    const cleanup = (payload) => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("message", handleMessage);
      bridgeScript.remove();
      structuredDataCache = payload;
      resolve(payload);
    };

    function handleMessage(event) {
      if (event.source !== window || event.data?.source !== STRUCTURED_DATA_EVENT || event.data?.requestId !== requestId) {
        return;
      }

      cleanup(event.data.payload || null);
    }

    const timeoutId = window.setTimeout(() => {
      cleanup(null);
    }, 2000);

    window.addEventListener("message", handleMessage);
    bridgeScript.src = chrome.runtime.getURL("page-bridge.js");
    bridgeScript.onload = () => {
      window.dispatchEvent(
        new CustomEvent(STRUCTURED_DATA_EVENT, {
          detail: { requestId }
        })
      );
    };
    bridgeScript.onerror = () => {
      cleanup(null);
    };

    (document.head || document.documentElement).appendChild(bridgeScript);
  });

  return structuredDataPromise;
}

function getStructuredPageData() {
  return structuredDataCache;
}

function collectImages() {
  const structuredData = getStructuredPageData();
  const gallery = structuredData?.gallery;
  if (gallery) {
    const galleryImages = [...(gallery.mainImage || []), ...(gallery.offerImgList || []), gallery.video?.coverUrl]
      .filter(Boolean)
      .map((url) => normalizeImageUrl(String(url)));

    return Array.from(new Set(galleryImages)).filter(Boolean);
  }

  const imageCandidates = new Set();
  const imageSelectors = [
    ".detail-gallery img",
    ".od-gallery-img img",
    ".detail-gallery-wrap img",
    ".tab-content-container img",
    "img[data-imgs]"
  ];

  for (const selector of imageSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const attrs = [
        element.getAttribute("data-src"),
        element.getAttribute("data-lazy-src"),
        element.getAttribute("src")
      ];

      attrs
        .map((value) => normalizeImageUrl(String(value || "")))
        .filter((value) => value && !/\.svg$/i.test(value))
        .forEach((url) => imageCandidates.add(url));

      const dataImgs = element.getAttribute("data-imgs");
      if (dataImgs) {
        const parsed = parseJsonSafely(dataImgs);
        if (parsed && typeof parsed === "object") {
          Object.values(parsed)
            .map((item) => normalizeImageUrl(String(item)))
            .filter((value) => value && !/\.svg$/i.test(value))
            .forEach((url) => imageCandidates.add(url));
        }
      }
    }
  }

  return Array.from(imageCandidates);
}

function collectSpecPairs() {
  const pairs = [];

  const tableRows = document.querySelectorAll("table tr, .offer-attr-list tr, .od-attribute-table tr");
  for (const row of tableRows) {
    const tableTitle = normalizeWhitespace(
      row
        .closest("table")
        ?.closest("section, .module-od-product-pack-info, .module-od-product-attributes, .detail-content, .tab-content-container")
        ?.querySelector("h2, h3, h4, .title, .module-title, .feature-item-label")
        ?.textContent || ""
    );
    if (hasPackageKeyword(tableTitle)) {
      continue;
    }

    const cells = Array.from(row.querySelectorAll("th, td"))
      .map((cell) => normalizeWhitespace(cell.textContent || ""))
      .filter(Boolean);
    if (cells.length < 2) {
      continue;
    }

    for (let index = 0; index + 1 < cells.length; index += 2) {
      const key = cells[index];
      const value = cells[index + 1];
      if (key && value) {
        pairs.push([key, value]);
      }
    }
  }

  const definitionRows = document.querySelectorAll("dl, .detail-attributes-item, .od-attribute-item");
  for (const row of definitionRows) {
    const keyElement = row.querySelector("dt, .label, .name, .attr-name, .key");
    const valueElement = row.querySelector("dd, .value, .attr-value, .val");
    const key = normalizeWhitespace(keyElement?.textContent || "");
    const value = normalizeWhitespace(valueElement?.textContent || "");
    if (key && value) {
      pairs.push([key, value]);
    }
  }

  return pairs;
}

function dedupeLabelValueEntries(entries) {
  const seen = new Set();

  return entries.filter((entry) => {
    const label = normalizeWhitespace(entry?.label || "");
    const value = normalizeWhitespace(entry?.value || "");
    if (!label || !value) {
      return false;
    }

    const signature = `${label}::${value}`;
    if (seen.has(signature)) {
      return false;
    }

    seen.add(signature);
    return true;
  });
}

function buildAttributeEntries(specPairs) {
  return dedupeLabelValueEntries(
    specPairs.map(([label, value]) => ({
      label,
      value
    }))
  );
}

function extractTableData(table) {
  const rows = [];
  const headerSet = new Set();

  for (const row of table.querySelectorAll("tr")) {
    const cells = Array.from(row.querySelectorAll("th, td"))
      .map((cell) => normalizeWhitespace(cell.textContent || ""))
      .filter(Boolean);

    if (!cells.length) {
      continue;
    }

    const thCount = row.querySelectorAll("th").length;
    const tdCount = row.querySelectorAll("td").length;
    if (!rows.length && thCount >= 2 && tdCount === 0) {
      cells.forEach((cell) => headerSet.add(cell));
      continue;
    }

    rows.push(cells);
  }

  const title = normalizeWhitespace(
    table.closest("section, .module-od-product-pack-info, .module-od-product-attributes, .detail-content, .tab-content-container")
      ?.querySelector("h2, h3, h4, .title, .module-title, .feature-item-label")
      ?.textContent || ""
  );
  const text = normalizeWhitespace(table.textContent || "");

  return {
    title,
    headers: Array.from(headerSet),
    rows,
    text
  };
}

function getPackageSignalScore(tableData) {
  const cells = [tableData.title, ...(tableData.headers || []), ...tableData.rows.flat()]
    .map((cell) => normalizeWhitespace(cell))
    .filter(Boolean);

  if (!cells.length) {
    return 0;
  }

  return cells.filter((cell) => hasPackageKeyword(cell)).length / cells.length;
}

function isPackageTable(tableData) {
  return hasPackageKeyword(tableData.title) || getPackageSignalScore(tableData) >= 0.2;
}

function collectPackageTables() {
  const seen = new Set();
  const tables = [];

  for (const table of document.querySelectorAll("table")) {
    const parsed = extractTableData(table);
    if (!parsed.rows.length && !parsed.headers.length) {
      continue;
    }

    if (!isPackageTable(parsed)) {
      continue;
    }

    const signature = JSON.stringify(parsed);
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    tables.push(parsed);
  }

  return tables;
}

function buildStructuredPackageTable(structuredData) {
  const pieceWeightScaleInfo = structuredData?.productPackInfo?.pieceWeightScale?.pieceWeightScaleInfo || [];
  if (!Array.isArray(pieceWeightScaleInfo) || !pieceWeightScaleInfo.length) {
    return null;
  }

  return {
    title: "SKU 包装信息",
    headers: ["SKU", "规格", "重量(g)", "长(cm)", "宽(cm)", "高(cm)", "体积"],
    rows: pieceWeightScaleInfo.map((item) => [
      String(item?.skuId || ""),
      normalizeWhitespace([item?.sku1, item?.sku2, item?.sku3].filter(Boolean).join(" / ")),
      item?.weight || item?.weight === 0 ? String(item.weight) : "",
      item?.length || item?.length === 0 ? String(item.length) : "",
      item?.width || item?.width === 0 ? String(item.width) : "",
      item?.height || item?.height === 0 ? String(item.height) : "",
      item?.volume || item?.volume === 0 ? String(item.volume) : ""
    ])
  };
}

function collectPackageInfo(specPairs, structuredData) {
  const attributeEntries = buildAttributeEntries(specPairs);
  const summary = attributeEntries.filter((entry) => hasPackageKeyword(entry.label));
  const tables = collectPackageTables();
  const structuredTable = buildStructuredPackageTable(structuredData);

  if (structuredTable) {
    tables.push(structuredTable);
  }

  return {
    unitWeight: structuredData?.productPackInfo?.unitWeight ? String(structuredData.productPackInfo.unitWeight) : "",
    summary,
    tables
  };
}

function collectSkuImageMap() {
  const imageMap = new Map();
  const selectors = [
    ".module-od-sku-selection .expand-view-item",
    ".module-od-sku-selection .sku-item",
    "[class*='sku-selection'] .expand-view-item",
    "[class*='sku-selection'] .sku-item"
  ];

  for (const selector of selectors) {
    const items = document.querySelectorAll(selector);
    for (const item of items) {
      const label = normalizeWhitespace(
        item.querySelector(".item-label, [title], .label, .name")?.textContent || item.getAttribute("title") || item.textContent || ""
      )
        .replace(/¥\s*\d+(?:\.\d+)?/g, "")
        .replace(/库存\s*\d+\s*个?/g, "")
        .trim();
      const imageUrl = normalizeImageUrl(
        item.querySelector("img")?.getAttribute("data-src") || item.querySelector("img")?.getAttribute("src") || ""
      );

      if (label && imageUrl && !imageMap.has(label)) {
        imageMap.set(label, imageUrl);
      }
    }

    if (imageMap.size) {
      break;
    }
  }

  return imageMap;
}

function buildSpecMap(pairs) {
  return pairs.reduce((map, [key, value]) => {
    const normalizedKey = key.toLowerCase().replace(/[：:]/g, "").trim();
    if (normalizedKey && !map[normalizedKey]) {
      map[normalizedKey] = value;
    }
    return map;
  }, {});
}

function findSpecValue(specMap, candidates) {
  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase().replace(/[：:]/g, "").trim();
    if (specMap[normalizedCandidate]) {
      return specMap[normalizedCandidate];
    }

    const partialMatch = Object.entries(specMap).find(([key]) => key.includes(normalizedCandidate));
    if (partialMatch) {
      return partialMatch[1];
    }
  }

  return "";
}

function inferBrand(title, specMap) {
  return findSpecValue(specMap, ["品牌", "brand", "品牌名称", "商标"]) || title.split(/[\s/]/).find(Boolean) || "";
}

function normalizeModelList(value) {
  const normalized = String(value || "")
    .replace(/\.\s*(?=iPhone)/gi, ",")
    .replace(/[；;|]/g, ",")
    .replace(/[、，。]/g, ",");

  const items = normalized
    .split(",")
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .filter((item) => !/^\d+个以上$/.test(item));

  return items;
}

function inferModel(specMap) {
  const prioritized = [
    findSpecValue(specMap, ["苹果型号"]),
    findSpecValue(specMap, ["型号", "model", "产品型号"]),
    findSpecValue(specMap, ["适用机型"]),
    findSpecValue(specMap, ["适用型号"])
  ].filter(Boolean);

  for (const candidate of prioritized) {
    const models = normalizeModelList(candidate);
    if (!models.length) {
      continue;
    }

    if (models.length <= 6) {
      return models.join(" / ");
    }
  }

  return "";
}

function inferSku(specMap, offerId) {
  return findSpecValue(specMap, ["sku", "商家编码", "货号"]) || offerId;
}

function inferStock(specMap) {
  return findSpecValue(specMap, ["库存", "可售数量", "供货总量", "stock"]);
}

function inferDescription(title) {
  const structuredData = getStructuredPageData();
  const detailUrl = structuredData?.description?.detailUrl;
  const description = normalizeWhitespace(textFromSelectors([
    ".detail-description",
    "#mod-detail-description",
    ".desc-content",
    ".detail-content"
  ]));

  if (description && !/^https?:\/\//i.test(description)) {
    return description;
  }

  const specMap = buildSpecMap(collectSpecPairs());
  const brand = inferStructuredBrand(specMap) || inferBrand(title, specMap);
  const model = inferModel(specMap);
  const material = findSpecValue(specMap, ["材质", "material"]);
  const features = findSpecValue(specMap, ["功能", "特性", "features"]);
  const style = findSpecValue(specMap, ["款式", "风格", "style"]);
  const craft = findSpecValue(specMap, ["工艺", "craft"]);
  const compatible = normalizeModelList(findSpecValue(specMap, ["适用型号", "适用机型"])).slice(0, 8).join(" / ");

  const summaryParts = [
    title,
    brand ? `品牌：${brand}` : "",
    model ? `型号：${model}` : "",
    material ? `材质：${material}` : "",
    features ? `功能：${features}` : "",
    style ? `款式：${style}` : "",
    craft ? `工艺：${craft}` : "",
    compatible ? `适用机型：${compatible}` : ""
  ].filter(Boolean);

  if (summaryParts.length) {
    return summaryParts.join("；");
  }

  return detailUrl || attributeFromSelectors(["meta[name='description']"], "content") || title;
}

function inferMeasurements(specMap) {
  const structuredData = getStructuredPageData();
  const pieceInfo = structuredData?.productPackInfo?.pieceWeightScale?.pieceWeightScaleInfo?.[0];
  if (pieceInfo) {
    return {
      packageWeight: pieceInfo.weight ? String(pieceInfo.weight) : "",
      packageLength: pieceInfo.length ? String(pieceInfo.length) : "",
      packageWidth: pieceInfo.width ? String(pieceInfo.width) : "",
      packageHeight: pieceInfo.height ? String(pieceInfo.height) : "",
      sizeUnit: "cm",
      weightUnit: "g"
    };
  }

  return {
    packageWeight: findSpecValue(specMap, ["毛重", "重量", "净重", "package weight"]),
    packageLength: findSpecValue(specMap, ["长度", "长", "package length"]),
    packageWidth: findSpecValue(specMap, ["宽度", "宽", "package width"]),
    packageHeight: findSpecValue(specMap, ["高度", "高", "package height"]),
    sizeUnit: findSpecValue(specMap, ["尺寸单位", "单位", "length unit"]),
    weightUnit: findSpecValue(specMap, ["重量单位", "weight unit"])
  };
}

function inferTitle(specMap) {
  const structuredData = getStructuredPageData();
  const productTitle = structuredData?.productTitle?.title;
  const gallerySubject = structuredData?.gallery?.subject;

  return normalizeWhitespace(
    productTitle ||
      gallerySubject ||
      textFromSelectors([".offer-title", ".d-title", ".title-text"]) ||
      attributeFromSelectors(["meta[property='og:title']"], "content") ||
      findSpecValue(specMap, ["标题", "商品名称", "名称"])
  );
}

function inferStructuredBrand(specMap) {
  const structuredData = getStructuredPageData();
  const titleTagBrand = structuredData?.productTitle?.tagList
    ?.find((tag) => tag.brandText)
    ?.brandText;

  return titleTagBrand || findSpecValue(specMap, ["品牌", "brand", "品牌名称", "商标"]);
}

function inferPrice(specMap) {
  const structuredData = getStructuredPageData();
  const finalPriceModel = structuredData?.mainPrice?.finalPriceModel;
  const tradeWithoutPromotion = finalPriceModel?.tradeWithoutPromotion;
  const onHandPrice = finalPriceModel?.onHandPrice;

  if (onHandPrice) {
    return String(onHandPrice);
  }

  if (Array.isArray(tradeWithoutPromotion?.skuMapOriginal) && tradeWithoutPromotion.skuMapOriginal.length) {
    const numericPrices = tradeWithoutPromotion.skuMapOriginal
      .map((item) => Number.parseFloat(item.price))
      .filter((price) => Number.isFinite(price));

    if (numericPrices.length) {
      return String(Math.min(...numericPrices));
    }
  }

  return textFromSelectors([
    ".price-now",
    ".od-pc-offer-price",
    ".price-origin",
    ".price-text",
    "[data-testid='price']"
  ]) || findSpecValue(specMap, ["价格", "price"]);
}

function buildSourcePayload(baseSource, overrides = {}) {
  return {
    ...baseSource,
    ...overrides
  };
}

function buildExportPayload(generatedAt, source, record, raw) {
  return {
    generatedAt,
    source,
    product: {
      title: source.title,
      offerId: source.offerId,
      companyName: source.companyName,
      price: source.price,
      detailUrl: source.detailUrl
    },
    sku: {
      skuId: source.skuId,
      specId: source.specId,
      specAttrs: source.specAttrs,
      options: source.variantOptions,
      price: record.price_mexico,
      stock: record.stock,
      images: raw.images,
      packageInfo: {
        weight: record.package_weight,
        weightUnit: record.package_weight_unit,
        length: record.package_length,
        width: record.package_width,
        height: record.package_height,
        sizeUnit: record.package_dimension_unit
      }
    }
  };
}

function buildPackageMeasurements(pieceInfo, fallbackMeasurements) {
  if (!pieceInfo) {
    return {
      packageWeight: fallbackMeasurements.packageWeight,
      packageLength: fallbackMeasurements.packageLength,
      packageWidth: fallbackMeasurements.packageWidth,
      packageHeight: fallbackMeasurements.packageHeight,
      sizeUnit: fallbackMeasurements.sizeUnit,
      weightUnit: fallbackMeasurements.weightUnit
    };
  }

  return {
    packageWeight: pieceInfo.weight || pieceInfo.weight === 0 ? String(pieceInfo.weight) : "",
    packageLength: pieceInfo.length || pieceInfo.length === 0 ? String(pieceInfo.length) : "",
    packageWidth: pieceInfo.width || pieceInfo.width === 0 ? String(pieceInfo.width) : "",
    packageHeight: pieceInfo.height || pieceInfo.height === 0 ? String(pieceInfo.height) : "",
    sizeUnit: "cm",
    weightUnit: "g"
  };
}

function buildSkuPackages({
  generatedAt,
  source,
  baseRecord,
  images,
  attributes,
  packageInfo,
  specPairs,
  specMap,
  skuImageMap,
  structuredData,
  measurements
}) {
  const skuEntries = structuredData?.mainPrice?.finalPriceModel?.tradeWithoutPromotion?.skuMapOriginal;
  const pieceWeightScaleInfo = structuredData?.productPackInfo?.pieceWeightScale?.pieceWeightScaleInfo || [];
  const measurementsBySkuId = new Map(
    pieceWeightScaleInfo
      .filter((item) => item?.skuId)
      .map((item) => [String(item.skuId), item])
  );

  if (!Array.isArray(skuEntries) || !skuEntries.length) {
    return [];
  }

  return skuEntries.map((skuEntry, index) => {
    const skuId = String(skuEntry?.skuId || `${source.offerId || "sku"}-${index + 1}`);
    const specId = String(skuEntry?.specId || "");
    const specAttrs = normalizeWhitespace(decodeHtmlEntities(skuEntry?.specAttrs || ""));
    const options = specAttrs
      .split(">")
      .map((item) => normalizeWhitespace(item))
      .filter(Boolean);
    const pieceInfo = measurementsBySkuId.get(skuId) || null;
    const packageMeasurements = buildPackageMeasurements(pieceInfo, measurements);
    const matchedImages = options
      .map((option) => skuImageMap.get(option) || "")
      .map((url) => normalizeImageUrl(url))
      .filter(Boolean);
    const fallbackImage = normalizeImageUrl(images[index] || images[0] || "");
    const packageImages = Array.from(new Set(matchedImages)).slice(0, 1);
    if (!packageImages.length && fallbackImage) {
      packageImages.push(fallbackImage);
    }
    const packageRecord = {
      ...baseRecord,
      sku: skuId,
      stock: skuEntry?.canBookCount || skuEntry?.canBookCount === 0 ? String(skuEntry.canBookCount) : baseRecord.stock,
      model: options.at(-1) || baseRecord.model,
      price_mexico: String(skuEntry?.price || skuEntry?.discountPrice || baseRecord.price_mexico || ""),
      package_weight: packageMeasurements.packageWeight,
      package_weight_unit: packageMeasurements.weightUnit,
      package_length: packageMeasurements.packageLength,
      package_width: packageMeasurements.packageWidth,
      package_height: packageMeasurements.packageHeight,
      package_dimension_unit: packageMeasurements.sizeUnit,
      description: specAttrs ? `${baseRecord.description}；SKU规格：${specAttrs}` : baseRecord.description
    };
    const fileBaseName = sanitizeFileNameSegment(`${skuId}${options.length ? `-${options.join("-")}` : ""}`, skuId);
    const packageSource = buildSourcePayload(source, {
      price: packageRecord.price_mexico,
      skuId,
      specId,
      specAttrs,
      variantOptions: options
    });
    const exportData = buildExportPayload(generatedAt, packageSource, packageRecord, {
      images: packageImages,
      attributes,
      packageInfo,
      specPairs,
      specMap,
      skuEntry,
      pieceInfo
    });

    const skuPackageInfo = {
      weight: packageMeasurements.packageWeight,
      weightUnit: packageMeasurements.weightUnit,
      length: packageMeasurements.packageLength,
      width: packageMeasurements.packageWidth,
      height: packageMeasurements.packageHeight,
      sizeUnit: packageMeasurements.sizeUnit
    };

    return {
      skuId,
      specId,
      specAttrs,
      options,
      price: packageRecord.price_mexico,
      stock: packageRecord.stock,
      images: packageImages,
      packageInfo: skuPackageInfo,
      folderName: fileBaseName,
      jsonFileName: `${fileBaseName}.json`,
      exportData
    };
  });
}

function buildFieldRecord() {
  const generatedAt = new Date().toISOString();
  const offerId = String(window.location.href.match(/\/offer\/([^./?#]+)/i)?.[1] || "");
  const specPairs = collectSpecPairs();
  const specMap = buildSpecMap(specPairs);
  const structuredData = getStructuredPageData();
  const title = inferTitle(specMap);
  const images = collectImages();
  const attributes = buildAttributeEntries(specPairs);
  const packageInfo = collectPackageInfo(specPairs, structuredData);
  const skuImageMap = collectSkuImageMap();
  const description = normalizeWhitespace(inferDescription(title));
  const measurements = inferMeasurements(specMap);
  const companyName = structuredData?.productTitle?.shopInfo?.companyName || "";
  const baseRecord = {
    stock: inferStock(specMap),
    model: inferModel(specMap),
    price_mexico: inferPrice(specMap),
    description,
    package_weight: measurements.packageWeight,
    package_weight_unit: measurements.weightUnit,
    package_length: measurements.packageLength,
    package_width: measurements.packageWidth,
    package_height: measurements.packageHeight,
    package_dimension_unit: measurements.sizeUnit
  };

  const source = {
    marketplace: "1688",
    url: window.location.href,
    title,
    offerId,
    price: baseRecord.price_mexico,
    companyName,
    detailUrl: structuredData?.description?.detailUrl || ""
  };
  const skuPackages = buildSkuPackages({
    generatedAt,
    source,
    baseRecord,
    images,
    attributes,
    packageInfo,
    specPairs,
    specMap,
    skuImageMap,
    structuredData,
    measurements
  });

  return {
    generatedAt,
    source: {
      ...source,
      skuPackageCount: skuPackages.length
    },
    product: {
      title,
      offerId,
      companyName,
      price: baseRecord.price_mexico,
      description,
      images,
      detailUrl: structuredData?.description?.detailUrl || ""
    },
    attributes,
    packageInfo,
    detail: {
      url: structuredData?.description?.detailUrl || "",
      blocks: [],
      images: [],
      text: "",
      html: ""
    },
    skuPackages: skuPackages.map((skuPackage) => ({
      skuId: skuPackage.skuId,
      specId: skuPackage.specId,
      specAttrs: skuPackage.specAttrs,
      options: skuPackage.options,
      price: skuPackage.price,
      stock: skuPackage.stock,
      images: skuPackage.images,
      packageInfo: skuPackage.packageInfo
    }))
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "COLLECT_1688_PRODUCT") {
    return false;
  }

  requestStructuredPageData()
    .then(() => {
      sendResponse({
        ok: true,
        data: buildFieldRecord()
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "采集结构化数据失败。"
      });
    });

  return true;
});