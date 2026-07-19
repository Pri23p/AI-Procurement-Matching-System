let productMappingCache = new Map();

function cleanText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeIdentifier(value) {
  return cleanText(value)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function normalizeDescription(value) {
  return cleanText(value).toLowerCase();
}

function getSignatureKey(desc) {
  if (!desc) return null;
  const clean = desc.toLowerCase().replace(/[^a-z]/g, "");

  if (clean.includes("hotwing")) return "desc:hot_wings";
  if (clean.includes("curry")) return "desc:chicken_curry_cut";
  if (clean.includes("boneless") && clean.includes("breast")) return "desc:chicken_boneless_breast";
  if (clean.includes("drumstick")) return "desc:chicken_drumsticks";
  if (clean.includes("spring") && clean.includes("veg")) return "desc:veg_spring_rolls";
  if (clean.includes("pepperoni")) return "desc:pork_pepperoni_salami";
  if (clean.includes("chilli") && clean.includes("salami")) return "desc:chicken_chilli_salami";
  if (clean.includes("plain") && clean.includes("salami")) return "desc:pork_salami";
  if (clean.includes("pork") && clean.includes("salami")) return "desc:pork_salami";
  if (clean.includes("salami")) {
    if (clean.includes("pork")) return "desc:pork_salami";
    return "desc:pork_salami"; // fallback for general salami
  }
  if (clean.includes("seekh") || clean.includes("kabab") || clean.includes("kebab")) return "desc:chicken_seekh_kebab";
  if (clean.includes("kheema") || clean.includes("keema") || clean.includes("mince")) return "desc:chicken_kheema";
  if (clean.includes("cheese") && clean.includes("onion")) return "desc:chicken_cheese_onion_sausage";
  
  if (clean.includes("everyday") && clean.includes("breast")) return "desc:everyday_chicken_breast";
  if (clean.includes("everyday") && clean.includes("fish")) return "desc:everyday_fish_fillet";
  if (clean.includes("pizza") && clean.includes("tikka")) return "desc:pizza_minis_chicken_tikka";
  
  if (clean.includes("chicken") && clean.includes("ham")) return "desc:chicken_ham";
  if (clean.includes("pork") && clean.includes("ham")) return "desc:pork_ham";
  if (clean.includes("pork") && clean.includes("bacon")) return "desc:pork_breakfast_bacon";
  if (clean.includes("breakfast") && clean.includes("bacon")) return "desc:pork_breakfast_bacon";
  if (clean.includes("pork") && clean.includes("sausage")) return "desc:pork_sausage";
  if (clean.includes("sausage")) {
    if (clean.includes("pork")) return "desc:pork_sausage";
    return "desc:pork_sausage"; // fallback for general sausage
  }

  // Momos
  if (clean.includes("momo")) {
    const isTenPcs = desc.includes("10");
    if (clean.includes("veg") && clean.includes("spicy")) return "desc:spicy_veg_momos";
    if (clean.includes("veg") && clean.includes("paneer")) return isTenPcs ? "desc:veg_paneer_momos_10" : "desc:veg_paneer_momos_24";
    if (clean.includes("paneer")) return isTenPcs ? "desc:veg_paneer_momos_10" : "desc:veg_paneer_momos_24";
    if (clean.includes("spicy") && clean.includes("chicken")) return isTenPcs ? "desc:spicy_chicken_momos_10" : "desc:spicy_chicken_momos_24";
    if (clean.includes("chicken")) {
      if (clean.includes("chef") || clean.includes("saver")) return "desc:saver_chicken_momo_pack";
      return isTenPcs ? "desc:original_chicken_momos_10" : "desc:original_chicken_momos_24";
    }
  }

  return null;
}

async function loadProductMappings() {
  const ProductMapping = require("../models/product-mapping.model");
  try {
    const mappings = await ProductMapping.find({}).lean();
    const newCache = new Map();
    for (const mapping of mappings) {
      const canonicalSku = mapping.sku;
      // Add all aliases and clean description to the lookup cache
      for (const alias of mapping.aliases || []) {
        newCache.set(String(alias).trim().toLowerCase(), canonicalSku);
      }
      newCache.set(cleanText(mapping.description).toLowerCase(), canonicalSku);
    }
    productMappingCache = newCache;
    console.log(`[Cache] Loaded ${mappings.length} product mappings.`);
  } catch (error) {
    console.error("[Cache] Failed to load product mappings:", error);
  }
}

function buildItemKey(item) {
  // 1. Check ProductMapping cache lookup
  const identifier = item?.sku || item?.itemCode || item?.code;
  if (identifier) {
    const cleanId = String(identifier).trim().toLowerCase();
    if (productMappingCache.has(cleanId)) {
      return `code:${productMappingCache.get(cleanId).toUpperCase()}`;
    }
  }

  if (item?.description) {
    const cleanDesc = cleanText(item.description).toLowerCase();
    if (productMappingCache.has(cleanDesc)) {
      return `code:${productMappingCache.get(cleanDesc).toUpperCase()}`;
    }
  }

  // 2. Fallback to signature keyword check
  const signatureKey = getSignatureKey(item?.description);
  if (signatureKey) {
    return signatureKey;
  }

  // 3. Fallback to original identifiers
  if (identifier) {
    return `code:${normalizeIdentifier(identifier)}`;
  }

  if (item?.description) {
    return `desc:${normalizeDescription(item.description)}`;
  }

  return null;
}

function getDisplayReference(item) {
  return item?.sku || item?.itemCode || item?.description || "unknown-item";
}

module.exports = {
  buildItemKey,
  cleanText,
  getDisplayReference,
  loadProductMappings,
};
