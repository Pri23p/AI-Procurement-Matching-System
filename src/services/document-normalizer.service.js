const { DOCUMENT_TYPES } = require("../constants/document-types");
const { toIsoDate } = require("../utils/date");
const { buildItemKey, cleanText } = require("../utils/item-key");
const { AppError } = require("../utils/errors");

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeString(value) {
  const text = cleanText(value);
  return text || null;
}

function normalizeItems(rawItems, quantityField) {
  return (rawItems || [])
    .map((item) => {
      const rawQty = (item[quantityField] !== undefined && item[quantityField] !== null && item[quantityField] !== "")
        ? item[quantityField]
        : (item.quantity !== undefined && item.quantity !== null && item.quantity !== ""
            ? item.quantity
            : (item.receivedQuantity !== undefined && item.receivedQuantity !== null && item.receivedQuantity !== ""
                ? item.receivedQuantity
                : item.received_quantity));

      const normalized = {
        itemCode: normalizeString(item.itemCode),
        sku: normalizeString(item.sku),
        description: cleanText(item.description),
        unit: normalizeString(item.unit),
        quantity: toNumber(rawQty),
      };

      normalized.itemKey = buildItemKey(normalized);
      return normalized;
    })
    .filter((item) => item.itemKey && item.quantity > 0);
}

function normalizeParsedDocument(documentType, rawExtraction) {
  if (!rawExtraction || typeof rawExtraction !== "object") {
    throw new AppError("Parsed document payload is empty or invalid.", 422);
  }

  if (documentType === DOCUMENT_TYPES.PO) {
    const items = normalizeItems(rawExtraction.items, "quantity");
    const normalizedData = {
      poNumber: normalizeString(rawExtraction.poNumber),
      poDate: toIsoDate(rawExtraction.poDate),
      vendorName: normalizeString(rawExtraction.vendorName),
      items: items.map((item) => ({
        itemCode: item.itemCode,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
      })),
    };

    return {
      poNumber: normalizedData.poNumber,
      documentNumber: normalizedData.poNumber,
      documentDate: normalizedData.poDate,
      vendorName: normalizedData.vendorName,
      items,
      normalizedData,
    };
  }

  if (documentType === DOCUMENT_TYPES.GRN) {
    const items = normalizeItems(rawExtraction.items, "receivedQuantity");
    const normalizedData = {
      grnNumber: normalizeString(rawExtraction.grnNumber),
      poNumber: normalizeString(rawExtraction.poNumber),
      grnDate: toIsoDate(rawExtraction.grnDate),
      vendorName: normalizeString(rawExtraction.vendorName),
      invoiceNumber: normalizeString(rawExtraction.invoiceNumber),
      invoiceDate: toIsoDate(rawExtraction.invoiceDate),
      items: items.map((item) => ({
        itemCode: item.itemCode,
        sku: item.sku,
        description: item.description,
        receivedQuantity: item.quantity,
        unit: item.unit,
      })),
    };

    return {
      poNumber: normalizedData.poNumber,
      documentNumber: normalizedData.grnNumber,
      documentDate: normalizedData.grnDate,
      vendorName: normalizedData.vendorName,
      items,
      normalizedData,
    };
  }

  if (documentType === DOCUMENT_TYPES.INVOICE) {
    const items = normalizeItems(rawExtraction.items, "quantity");
    const normalizedData = {
      invoiceNumber: normalizeString(rawExtraction.invoiceNumber),
      poNumber: normalizeString(rawExtraction.poNumber),
      invoiceDate: toIsoDate(rawExtraction.invoiceDate),
      vendorName: normalizeString(rawExtraction.vendorName),
      items: items.map((item) => ({
        itemCode: item.itemCode,
        sku: item.sku,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
      })),
    };

    return {
      poNumber: normalizedData.poNumber,
      documentNumber: normalizedData.invoiceNumber,
      documentDate: normalizedData.invoiceDate,
      vendorName: normalizedData.vendorName,
      items,
      normalizedData,
    };
  }

  throw new AppError(`Unsupported document type "${documentType}".`, 400);
}

module.exports = {
  normalizeParsedDocument,
};

