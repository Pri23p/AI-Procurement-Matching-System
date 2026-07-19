const path = require("path");
const Document = require("../models/document.model");
const { DOCUMENT_TYPE_VALUES } = require("../constants/document-types");
const documentParserService = require("./document-parser.service");
const { normalizeParsedDocument } = require("./document-normalizer.service");
const { refreshMatchResult } = require("./match.service");
const { AppError } = require("../utils/errors");
const { parseDocumentDate } = require("../utils/date");

async function createDocumentFromUpload({ file, documentType }) {
  if (!DOCUMENT_TYPE_VALUES.includes(documentType)) {
    throw new AppError("documentType must be one of: po, grn, invoice.", 400);
  }

  if (!file) {
    throw new AppError("A file upload is required.", 400);
  }

  const { enqueueTask } = require("./queue.service");
  const task = await enqueueTask({ documentType, file });

  return task;
}

async function getDocumentById(documentId) {
  const document = await Document.findById(documentId);
  if (!document) {
    throw new AppError("Document not found.", 404);
  }

  return document;
}

module.exports = {
  createDocumentFromUpload,
  getDocumentById,
};

