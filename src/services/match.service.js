const Document = require("../models/document.model");
const MatchResult = require("../models/match-result.model");
const { DOCUMENT_TYPES } = require("../constants/document-types");
const { MATCH_STATUSES } = require("../constants/match-statuses");
const { parseDocumentDate, toIsoDate } = require("../utils/date");
const { getDisplayReference } = require("../utils/item-key");

const EPSILON = 0.0001;

function isGreaterThan(left, right) {
  return left - right > EPSILON;
}

function isEffectivelyEqual(left, right) {
  return Math.abs(left - right) <= EPSILON;
}

function summarizeLinkedDocument(document) {
  return {
    id: document.id || document._id.toString(),
    documentNumber: document.documentNumber,
    documentDate: toIsoDate(document.documentDate),
    originalName: document.sourceFile.originalName,
  };
}

function aggregateItems(documents) {
  const map = new Map();

  for (const document of documents) {
    for (const item of document.items || []) {
      if (!item.itemKey) {
        continue;
      }

      if (!map.has(item.itemKey)) {
        map.set(item.itemKey, {
          itemKey: item.itemKey,
          reference: getDisplayReference(item),
          description: item.description || "",
          quantity: 0,
        });
      }

      const existing = map.get(item.itemKey);
      existing.quantity += Number(item.quantity || 0);
      if (!existing.description && item.description) {
        existing.description = item.description;
      }
    }
  }

  return map;
}

function buildReason(code, message, extra = {}) {
  return {
    code,
    message,
    itemKey: extra.itemKey || null,
    reference: extra.reference || null,
  };
}

function buildMatchResultSnapshot(poNumber, documents) {
  const poDocuments = documents.filter((doc) => doc.documentType === DOCUMENT_TYPES.PO);
  const grnDocuments = documents.filter((doc) => doc.documentType === DOCUMENT_TYPES.GRN);
  const invoiceDocuments = documents.filter((doc) => doc.documentType === DOCUMENT_TYPES.INVOICE);

  const reasons = [];
  const linkedDocuments = {
    po: poDocuments.map(summarizeLinkedDocument),
    grn: grnDocuments.map(summarizeLinkedDocument),
    invoice: invoiceDocuments.map(summarizeLinkedDocument),
  };

  if (poDocuments.length > 1) {
    reasons.push(
      buildReason(
        "duplicate_po",
        `Found ${poDocuments.length} PO documents for poNumber ${poNumber}.`,
      ),
    );
  }

  const primaryPo = poDocuments[0] || null;
  const poItems = aggregateItems(primaryPo ? [primaryPo] : []);
  const grnItems = aggregateItems(grnDocuments);
  const invoiceItems = aggregateItems(invoiceDocuments);
  const hasPo = Boolean(primaryPo);
  const hasGrn = grnDocuments.length > 0;

  if (hasPo) {
    const poDate = parseDocumentDate(primaryPo.documentDate);
    for (const invoiceDocument of invoiceDocuments) {
      const invoiceDate = parseDocumentDate(invoiceDocument.documentDate);
      if (poDate && invoiceDate && invoiceDate > poDate) {
        reasons.push(
          buildReason(
            "invoice_date_after_po_date",
            `Invoice ${invoiceDocument.documentNumber} is dated after PO ${primaryPo.documentNumber}.`,
          ),
        );
      }
    }
  }

  if (hasPo) {
    for (const [itemKey, item] of grnItems.entries()) {
      if (!poItems.has(itemKey)) {
        reasons.push(
          buildReason("item_missing_in_po", `GRN item ${item.reference} is not present in the PO.`, item),
        );
      }
    }

    for (const [itemKey, item] of invoiceItems.entries()) {
      if (!poItems.has(itemKey)) {
        reasons.push(
          buildReason(
            "item_missing_in_po",
            `Invoice item ${item.reference} is not present in the PO.`,
            item,
          ),
        );
      }
    }
  }

  const missingCategories = [];
  if (!poDocuments.length) {
    missingCategories.push("po");
  }
  if (!grnDocuments.length) {
    missingCategories.push("grn");
  }
  if (!invoiceDocuments.length) {
    missingCategories.push("invoice");
  }

  const allKeys = new Set([
    ...poItems.keys(),
    ...grnItems.keys(),
    ...invoiceItems.keys(),
  ]);

  const itemResults = [];

  for (const itemKey of allKeys) {
    const poItem = poItems.get(itemKey);
    const grnItem = grnItems.get(itemKey);
    const invoiceItem = invoiceItems.get(itemKey);

    const poQuantity = poItem?.quantity || 0;
    const totalReceivedQuantity = grnItem?.quantity || 0;
    const totalInvoicedQuantity = invoiceItem?.quantity || 0;
    const reference =
      poItem?.reference || grnItem?.reference || invoiceItem?.reference || itemKey;
    const description =
      poItem?.description || grnItem?.description || invoiceItem?.description || "";

    if (poItem && isGreaterThan(totalReceivedQuantity, poQuantity)) {
      reasons.push(
        buildReason(
          "grn_qty_exceeds_po_qty",
          `Received quantity for item ${reference} exceeds the PO quantity.`,
          { itemKey, reference },
        ),
      );
    }

    if (poItem && isGreaterThan(totalInvoicedQuantity, poQuantity)) {
      reasons.push(
        buildReason(
          "invoice_qty_exceeds_po_qty",
          `Invoiced quantity for item ${reference} exceeds the PO quantity.`,
          { itemKey, reference },
        ),
      );
    }

    if (hasGrn && isGreaterThan(totalInvoicedQuantity, totalReceivedQuantity)) {
      reasons.push(
        buildReason(
          "invoice_qty_exceeds_grn_qty",
          `Invoiced quantity for item ${reference} exceeds the total GRN quantity.`,
          { itemKey, reference },
        ),
      );
    }

    itemResults.push({
      itemKey,
      reference,
      description,
      poQuantity,
      totalReceivedQuantity,
      totalInvoicedQuantity,
      fullyReceived: poItem ? isEffectivelyEqual(totalReceivedQuantity, poQuantity) : false,
      fullyInvoiced: poItem
        ? isEffectivelyEqual(totalInvoicedQuantity, poQuantity)
        : false,
    });
  }

  let status = MATCH_STATUSES.INSUFFICIENT_DOCUMENTS;

  if (missingCategories.length > 0) {
    for (const category of missingCategories) {
      reasons.push(
        buildReason(
          `missing_${category}`,
          `No ${category.toUpperCase()} document is available yet for poNumber ${poNumber}.`,
        ),
      );
    }
  }

  if (reasons.some((reason) => !reason.code.startsWith("missing_"))) {
    status = MATCH_STATUSES.MISMATCH;
  } else if (missingCategories.length > 0) {
    status = MATCH_STATUSES.INSUFFICIENT_DOCUMENTS;
  } else {
    const isFullyMatched =
      itemResults.length > 0 &&
      itemResults.every(
        (item) =>
          item.fullyReceived &&
          item.fullyInvoiced &&
          isEffectivelyEqual(item.totalInvoicedQuantity, item.totalReceivedQuantity),
      );

    status = isFullyMatched
      ? MATCH_STATUSES.MATCHED
      : MATCH_STATUSES.PARTIALLY_MATCHED;
  }

  return {
    poNumber,
    status,
    reasons,
    linkedDocuments,
    itemResults,
    summary: {
      poCount: poDocuments.length,
      grnCount: grnDocuments.length,
      invoiceCount: invoiceDocuments.length,
      poItemCount: primaryPo?.items?.length || 0,
      grnItemCount: grnDocuments.reduce((sum, doc) => sum + (doc.items?.length || 0), 0),
      invoiceItemCount: invoiceDocuments.reduce((sum, doc) => sum + (doc.items?.length || 0), 0),
    },
    lastEvaluatedAt: new Date(),
  };
}

async function refreshMatchResult(poNumber) {
  const documents = await Document.find({ poNumber }).sort({ createdAt: 1 }).lean();
  if (!documents.length) {
    return null;
  }

  const snapshot = buildMatchResultSnapshot(poNumber, documents);

  return MatchResult.findOneAndUpdate(
    { poNumber },
    snapshot,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );
}

async function getMatchResult(poNumber) {
  const documents = await Document.find({ poNumber }).sort({ createdAt: 1 }).lean();
  if (!documents.length) {
    return buildMatchResultSnapshot(poNumber, []);
  }

  const snapshot = buildMatchResultSnapshot(poNumber, documents);

  return MatchResult.findOneAndUpdate(
    { poNumber },
    snapshot,
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );
}

module.exports = {
  buildMatchResultSnapshot,
  getMatchResult,
  refreshMatchResult,
};
