const Task = require("../models/task.model");
const Document = require("../models/document.model");
const documentParserService = require("./document-parser.service");
const { normalizeParsedDocument } = require("./document-normalizer.service");
const { validateExtraction } = require("../utils/validation");
const { refreshMatchResult } = require("./match.service");
const { parseDocumentDate } = require("../utils/date");

async function enqueueTask({ documentType, file }) {
  const task = await Task.create({
    documentType,
    sourceFile: {
      originalName: file.originalname,
      storagePath: file.path,
      mimeType: file.mimetype || "application/pdf",
      size: file.size,
    },
  });
  return task;
}

async function processNextTask() {
  const task = await Task.findOneAndUpdate(
    { status: "pending" },
    { status: "processing" },
    { returnDocument: "after", sort: { createdAt: 1 } }
  );

  if (!task) {
    return false;
  }

  console.log(`[Worker] Processing task ${task.id} (${task.documentType})...`);
  try {
    const mimeType = task.sourceFile.mimeType;
    const rawExtraction = await documentParserService.parseDocumentWithGroq({
      filePath: task.sourceFile.storagePath,
      mimeType,
      documentType: task.documentType,
    });

    // Validate raw extraction using Zod
    const validated = validateExtraction(task.documentType, rawExtraction);

    // Normalize
    const normalized = normalizeParsedDocument(task.documentType, validated);

    // Create Document
    const document = await Document.create({
      documentType: task.documentType,
      poNumber: normalized.poNumber,
      documentNumber: normalized.documentNumber,
      documentDate: parseDocumentDate(normalized.documentDate),
      vendorName: normalized.vendorName,
      items: normalized.items,
      normalizedData: normalized.normalizedData,
      rawExtraction,
      sourceFile: {
        originalName: task.sourceFile.originalName,
        storagePath: task.sourceFile.storagePath,
        mimeType,
        size: task.sourceFile.size,
      },
      extractionProvider: {
        name: "groq",
        model: process.env.GROQ_MODEL || null,
      },
    });

    // Refresh match result
    await refreshMatchResult(normalized.poNumber);

    task.status = "completed";
    task.poNumber = normalized.poNumber;
    task.documentId = document._id;
    task.error = null;
    await task.save();

    console.log(`[Worker] Task ${task.id} completed successfully.`);
  } catch (error) {
    console.error(`[Worker] Task ${task.id} failed:`, error);
    task.status = "failed";
    task.error = {
      message: error.message,
      stack: error.stack,
      details: error.details || null,
    };
    await task.save();
  }

  return true;
}

let isWorkerRunning = false;
async function startWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;
  console.log("[Worker] Background task processor started.");
  
  // Continuous worker loop
  (async () => {
    while (isWorkerRunning) {
      try {
        const processed = await processNextTask();
        if (!processed) {
          // If no tasks, wait for 1 second
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (err) {
        console.error("[Worker] Error in worker loop:", err);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  })();
}

function stopWorker() {
  isWorkerRunning = false;
  console.log("[Worker] Background task processor stopped.");
}

module.exports = {
  enqueueTask,
  processNextTask,
  startWorker,
  stopWorker,
};
