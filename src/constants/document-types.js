const DOCUMENT_TYPES = Object.freeze({
  PO: "po",
  GRN: "grn",
  INVOICE: "invoice",
});

const DOCUMENT_TYPE_VALUES = Object.freeze(Object.values(DOCUMENT_TYPES));

module.exports = {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_VALUES,
};

