const mongoose = require("mongoose");
const { DOCUMENT_TYPE_VALUES } = require("../constants/document-types");

const itemSchema = new mongoose.Schema(
  {
    itemKey: { type: String, default: null },
    itemCode: { type: String, default: null },
    sku: { type: String, default: null },
    description: { type: String, default: "" },
    quantity: { type: Number, default: 0 },
    unit: { type: String, default: null },
  },
  {
    _id: false,
  },
);

const documentSchema = new mongoose.Schema(
  {
    documentType: {
      type: String,
      enum: DOCUMENT_TYPE_VALUES,
      required: true,
    },
    poNumber: {
      type: String,
      required: true,
      index: true,
    },
    documentNumber: {
      type: String,
      default: null,
    },
    documentDate: {
      type: Date,
      default: null,
    },
    vendorName: {
      type: String,
      default: null,
    },
    items: {
      type: [itemSchema],
      default: [],
    },
    normalizedData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    rawExtraction: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    sourceFile: {
      originalName: { type: String, required: true },
      storagePath: { type: String, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true },
    },
    extractionProvider: {
      name: { type: String, default: "groq" },
      model: { type: String, default: null },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  },
);

documentSchema.index({ poNumber: 1, documentType: 1, createdAt: 1 });

const Document = mongoose.model("Document", documentSchema);

module.exports = Document;

