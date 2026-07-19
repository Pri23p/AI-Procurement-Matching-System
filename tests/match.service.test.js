const test = require("node:test");
const assert = require("node:assert/strict");
const { buildMatchResultSnapshot } = require("../src/services/match.service");
const { DOCUMENT_TYPES } = require("../src/constants/document-types");
const { MATCH_STATUSES } = require("../src/constants/match-statuses");

function createDocument({
  id,
  documentType,
  poNumber,
  documentNumber,
  documentDate,
  items,
}) {
  return {
    _id: id,
    documentType,
    poNumber,
    documentNumber,
    documentDate,
    items,
    sourceFile: {
      originalName: `${documentNumber}.pdf`,
    },
  };
}

test("returns insufficient_documents when PO is missing", () => {
  const snapshot = buildMatchResultSnapshot("PO-100", [
    createDocument({
      id: "1",
      documentType: DOCUMENT_TYPES.INVOICE,
      poNumber: "PO-100",
      documentNumber: "INV-1",
      documentDate: "2026-03-24",
      items: [
        {
          itemKey: "code:SKU1",
          itemCode: "SKU1",
          description: "Widget",
          quantity: 5,
        },
      ],
    }),
  ]);

  assert.equal(snapshot.status, MATCH_STATUSES.INSUFFICIENT_DOCUMENTS);
  assert.ok(snapshot.reasons.some((reason) => reason.code === "missing_po"));
});

test("returns insufficient_documents when no documents are stored", () => {
  const snapshot = buildMatchResultSnapshot("PO-050", []);

  assert.equal(snapshot.status, MATCH_STATUSES.INSUFFICIENT_DOCUMENTS);
  assert.ok(snapshot.reasons.some((reason) => reason.code === "missing_po"));
  assert.ok(snapshot.reasons.some((reason) => reason.code === "missing_grn"));
  assert.ok(snapshot.reasons.some((reason) => reason.code === "missing_invoice"));
});

test("returns matched when PO, GRN, and invoice quantities align", () => {
  const poNumber = "PO-200";
  const snapshot = buildMatchResultSnapshot(poNumber, [
    createDocument({
      id: "1",
      documentType: DOCUMENT_TYPES.PO,
      poNumber,
      documentNumber: poNumber,
      documentDate: "2026-03-17",
      items: [
        {
          itemKey: "code:SKU1",
          itemCode: "SKU1",
          description: "Widget",
          quantity: 10,
        },
      ],
    }),
    createDocument({
      id: "2",
      documentType: DOCUMENT_TYPES.GRN,
      poNumber,
      documentNumber: "GRN-1",
      documentDate: "2026-03-17",
      items: [
        {
          itemKey: "code:SKU1",
          itemCode: "SKU1",
          description: "Widget",
          quantity: 10,
        },
      ],
    }),
    createDocument({
      id: "3",
      documentType: DOCUMENT_TYPES.INVOICE,
      poNumber,
      documentNumber: "INV-1",
      documentDate: "2026-03-17",
      items: [
        {
          itemKey: "code:SKU1",
          itemCode: "SKU1",
          description: "Widget",
          quantity: 10,
        },
      ],
    }),
  ]);

  assert.equal(snapshot.status, MATCH_STATUSES.MATCHED);
  assert.equal(snapshot.reasons.length, 0);
});

test("returns mismatch when invoice quantity exceeds GRN quantity", () => {
  const poNumber = "PO-300";
  const snapshot = buildMatchResultSnapshot(poNumber, [
    createDocument({
      id: "1",
      documentType: DOCUMENT_TYPES.PO,
      poNumber,
      documentNumber: poNumber,
      documentDate: "2026-03-17",
      items: [
        {
          itemKey: "code:SKU1",
          itemCode: "SKU1",
          description: "Widget",
          quantity: 10,
        },
      ],
    }),
    createDocument({
      id: "2",
      documentType: DOCUMENT_TYPES.GRN,
      poNumber,
      documentNumber: "GRN-1",
      documentDate: "2026-03-17",
      items: [
        {
          itemKey: "code:SKU1",
          itemCode: "SKU1",
          description: "Widget",
          quantity: 5,
        },
      ],
    }),
    createDocument({
      id: "3",
      documentType: DOCUMENT_TYPES.INVOICE,
      poNumber,
      documentNumber: "INV-1",
      documentDate: "2026-03-17",
      items: [
        {
          itemKey: "code:SKU1",
          itemCode: "SKU1",
          description: "Widget",
          quantity: 7,
        },
      ],
    }),
  ]);

  assert.equal(snapshot.status, MATCH_STATUSES.MISMATCH);
  assert.ok(snapshot.reasons.some((reason) => reason.code === "invoice_qty_exceeds_grn_qty"));
});

