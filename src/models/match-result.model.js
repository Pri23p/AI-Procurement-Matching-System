const mongoose = require("mongoose");
const { MATCH_STATUSES } = require("../constants/match-statuses");

const matchReasonSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    itemKey: { type: String, default: null },
    reference: { type: String, default: null },
    message: { type: String, required: true },
  },
  { _id: false },
);

const linkedDocumentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    documentNumber: { type: String, default: null },
    documentDate: { type: String, default: null },
    originalName: { type: String, required: true },
  },
  { _id: false },
);

const itemResultSchema = new mongoose.Schema(
  {
    itemKey: { type: String, required: true },
    reference: { type: String, required: true },
    description: { type: String, default: "" },
    poQuantity: { type: Number, default: 0 },
    totalReceivedQuantity: { type: Number, default: 0 },
    totalInvoicedQuantity: { type: Number, default: 0 },
    fullyReceived: { type: Boolean, default: false },
    fullyInvoiced: { type: Boolean, default: false },
  },
  { _id: false },
);

const matchResultSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(MATCH_STATUSES),
      required: true,
    },
    reasons: {
      type: [matchReasonSchema],
      default: [],
    },
    linkedDocuments: {
      po: { type: [linkedDocumentSchema], default: [] },
      grn: { type: [linkedDocumentSchema], default: [] },
      invoice: { type: [linkedDocumentSchema], default: [] },
    },
    itemResults: {
      type: [itemResultSchema],
      default: [],
    },
    summary: {
      poCount: { type: Number, default: 0 },
      grnCount: { type: Number, default: 0 },
      invoiceCount: { type: Number, default: 0 },
      poItemCount: { type: Number, default: 0 },
      grnItemCount: { type: Number, default: 0 },
      invoiceItemCount: { type: Number, default: 0 },
    },
    lastEvaluatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
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

const MatchResult = mongoose.model("MatchResult", matchResultSchema);

module.exports = MatchResult;

