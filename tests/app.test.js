const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const request = require("supertest");
const app = require("../src/app");
const Document = require("../src/models/document.model");
const MatchResult = require("../src/models/match-result.model");
const documentParserService = require("../src/services/document-parser.service");

test("GET /health returns ok", async () => {
  const response = await request(app).get("/health");
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "ok");
});

test("uploads a document and returns the current match state through the API", async () => {
  const Task = require("../src/models/task.model");
  const originalParser = documentParserService.parseDocumentWithGroq;
  const originalCreate = Document.create;
  const originalFindById = Document.findById;
  const originalFind = Document.find;
  const originalFindOneAndUpdate = MatchResult.findOneAndUpdate;
  
  const originalTaskCreate = Task.create;
  const originalTaskFindOneAndUpdate = Task.findOneAndUpdate;
  const originalTaskFindById = Task.findById;

  const rawExtraction = {
    poNumber: "PO-100",
    poDate: "2026-03-17",
    vendorName: "Vendor Co",
    items: [
      {
        itemCode: "A1",
        description: "Widget",
        quantity: 5,
      },
    ],
  };

  let storedDocument = null;
  let storedTask = null;

  documentParserService.parseDocumentWithGroq = async () => rawExtraction;
  
  Document.create = async (payload) => {
    storedDocument = {
      id: "doc-1",
      _id: "doc-1",
      ...payload,
    };
    return storedDocument;
  };
  Document.findById = async (documentId) => (documentId === "doc-1" ? storedDocument : null);
  Document.find = () => ({
    sort: () => ({
      lean: async () => (storedDocument ? [storedDocument] : []),
    }),
  });
  
  MatchResult.findOneAndUpdate = async (_query, snapshot) => ({
    id: "match-1",
    _id: "match-1",
    ...snapshot,
  });

  Task.create = async (payload) => {
    storedTask = {
      _id: "task-1",
      id: "task-1",
      status: "pending",
      ...payload,
      save: async function () { return this; }
    };
    return storedTask;
  };

  Task.findOneAndUpdate = async (query, update) => {
    if (storedTask && storedTask.status === "pending") {
      storedTask.status = "processing";
      return storedTask;
    }
    return null;
  };

  Task.findById = (id) => ({
    populate: async () => {
      if (storedTask && storedTask.status === "completed") {
        storedTask.documentId = storedDocument;
      }
      return storedTask;
    }
  });

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "finifi-upload-"));
  const filePath = path.join(tempDir, "sample.pdf");
  await fs.writeFile(filePath, "placeholder");

  try {
    const uploadResponse = await request(app)
      .post("/documents/upload")
      .field("documentType", "po")
      .attach("file", filePath, {
        filename: "sample.pdf",
        contentType: "application/pdf",
      });

    assert.equal(uploadResponse.statusCode, 202);
    assert.equal(uploadResponse.body.task.id, "task-1");
    assert.equal(uploadResponse.body.task.status, "pending");

    // Manually run a single task processing in sync-fashion for testing
    const { processNextTask } = require("../src/services/queue.service");
    await processNextTask();

    const taskResponse = await request(app).get("/tasks/task-1");
    assert.equal(taskResponse.statusCode, 200);
    assert.equal(taskResponse.body.status, "completed");

    const documentResponse = await request(app).get("/documents/doc-1");
    assert.equal(documentResponse.statusCode, 200);
    assert.equal(documentResponse.body.poNumber, "PO-100");

    const matchResponse = await request(app).get("/match/PO-100");
    assert.equal(matchResponse.statusCode, 200);
    assert.equal(matchResponse.body.status, "insufficient_documents");
    assert.ok(matchResponse.body.reasons.some((reason) => reason.code === "missing_grn"));
    assert.ok(matchResponse.body.reasons.some((reason) => reason.code === "missing_invoice"));
  } finally {
    documentParserService.parseDocumentWithGroq = originalParser;
    Document.create = originalCreate;
    Document.findById = originalFindById;
    Document.find = originalFind;
    MatchResult.findOneAndUpdate = originalFindOneAndUpdate;
    
    Task.create = originalTaskCreate;
    Task.findOneAndUpdate = originalTaskFindOneAndUpdate;
    Task.findById = originalTaskFindById;
  }
});

