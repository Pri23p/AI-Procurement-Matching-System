const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../src/app");
const mongoose = require("mongoose");
const env = require("../src/config/env");
const Task = require("../src/models/task.model");
const Document = require("../src/models/document.model");
const MatchResult = require("../src/models/match-result.model");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

test.describe("Three-Way Match Async Integration Test", () => {
  test.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.mongoUri);
    }
    await Task.deleteMany({});
    await Document.deleteMany({});
    await MatchResult.deleteMany({});
  });

  test.after(async () => {
    await mongoose.disconnect();
  });

  test("can upload a document, task is created, worker processes it, and match result updates", async () => {
    const documentParserService = require("../src/services/document-parser.service");
    const originalParser = documentParserService.parseDocumentWithGroq;

    const mockPoPayload = {
      poNumber: "PO-ASYNC-TEST",
      poDate: "2026-03-16",
      vendorName: "Async Vendor Co",
      items: [
        {
          itemCode: "11423",
          description: "Cheesy Spicy Veg Momos 24.0 Pieces",
          quantity: 50,
        },
      ],
    };

    documentParserService.parseDocumentWithGroq = async () => mockPoPayload;

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "finifi-async-integration-"));
    const filePath = path.join(tempDir, "po.pdf");
    await fs.writeFile(filePath, "placeholder po content");

    try {
      const uploadRes = await request(app)
        .post("/documents/upload")
        .field("documentType", "po")
        .attach("file", filePath);

      assert.equal(uploadRes.statusCode, 202);
      assert.equal(uploadRes.body.task.status, "pending");
      const taskId = uploadRes.body.task.id;

      let taskRes = await request(app).get(`/tasks/${taskId}`);
      assert.equal(taskRes.statusCode, 200);
      assert.equal(taskRes.body.status, "pending");

      const { processNextTask } = require("../src/services/queue.service");
      const processed = await processNextTask();
      assert.equal(processed, true);

      taskRes = await request(app).get(`/tasks/${taskId}`);
      assert.equal(taskRes.statusCode, 200);
      assert.equal(taskRes.body.status, "completed");
      assert.ok(taskRes.body.documentId);

      const matchRes = await request(app).get("/match/PO-ASYNC-TEST");
      assert.equal(matchRes.statusCode, 200);
      assert.equal(matchRes.body.status, "insufficient_documents");
      assert.ok(matchRes.body.reasons.some((r) => r.code === "missing_grn"));

    } finally {
      documentParserService.parseDocumentWithGroq = originalParser;
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
