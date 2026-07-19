const { z } = require("zod");
const { DOCUMENT_TYPES } = require("../constants/document-types");
const { AppError } = require("./errors");

const itemSchema = z.object({
  itemCode: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  description: z.string().default(""),
  quantity: z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const parsed = Number(val.replace(/,/g, "").trim());
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }, z.number().nonnegative().default(0)),
  receivedQuantity: z.preprocess((val) => {
    if (val === undefined || val === null || val === "") return undefined;
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const parsed = Number(val.replace(/,/g, "").trim());
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }, z.number().nonnegative().optional()),
});

const poSchema = z.object({
  poNumber: z.string().min(1, "PO number is required"),
  poDate: z.string().nullable().optional(),
  vendorName: z.string().nullable().optional(),
  items: z.array(itemSchema).default([]),
});

const grnSchema = z.object({
  grnNumber: z.string().min(1, "GRN number is required"),
  poNumber: z.string().min(1, "PO number is required"),
  grnDate: z.string().nullable().optional(),
  vendorName: z.string().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  items: z.array(itemSchema).default([]),
});

const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  poNumber: z.string().min(1, "PO number is required"),
  invoiceDate: z.string().nullable().optional(),
  vendorName: z.string().nullable().optional(),
  items: z.array(itemSchema).default([]),
});

function validateExtraction(documentType, rawExtraction) {
  try {
    if (documentType === DOCUMENT_TYPES.PO) {
      return poSchema.parse(rawExtraction);
    }
    if (documentType === DOCUMENT_TYPES.GRN) {
      return grnSchema.parse(rawExtraction);
    }
    if (documentType === DOCUMENT_TYPES.INVOICE) {
      return invoiceSchema.parse(rawExtraction);
    }
    throw new AppError(`Unknown document type: ${documentType}`, 400);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError("Extracted data validation failed.", 422, {
        validationErrors: (error.errors || error.issues || []).map((e) => `${e.path.join(".")}: ${e.message}`),
        rawExtraction,
      });
    }
    throw error;
  }
}

module.exports = {
  validateExtraction,
  poSchema,
  grnSchema,
  invoiceSchema,
};
