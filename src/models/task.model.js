const mongoose = require("mongoose");
const { DOCUMENT_TYPE_VALUES } = require("../constants/document-types");

const taskSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
      index: true,
    },
    documentType: {
      type: String,
      enum: DOCUMENT_TYPE_VALUES,
      required: true,
    },
    sourceFile: {
      originalName: { type: String, required: true },
      storagePath: { type: String, required: true },
      mimeType: { type: String, required: true },
      size: { type: Number, required: true },
    },
    poNumber: {
      type: String,
      default: null,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },
    error: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
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
  }
);

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;
