const test = require("node:test");
const assert = require("node:assert/strict");
const { parseDocumentWithGroq } = require("../src/services/document-parser.service");
const { DOCUMENT_TYPES } = require("../src/constants/document-types");
const env = require("../src/config/env");

test("parses structured JSON with an injected Groq client", async () => {
  const expectedPayload = {
    poNumber: "PO-200",
    poDate: "2026-03-17",
    vendorName: "Vendor Co",
    items: [
      {
        itemCode: "A1",
        description: "Widget",
        quantity: 10,
      },
    ],
  };

  let capturedRequest = null;
  const fakeClient = {
    chat: {
      completions: {
        create: async (requestPayload) => {
          capturedRequest = requestPayload;
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify(expectedPayload),
                },
              },
            ],
          };
        },
      },
    },
  };

  const result = await parseDocumentWithGroq({
    filePath: "ignored.pdf",
    mimeType: "application/pdf",
    documentType: DOCUMENT_TYPES.PO,
    client: fakeClient,
    sourceContent: {
      kind: "text",
      text: "PO sample text with line items",
    },
  });

  assert.deepEqual(result, expectedPayload);
  assert.equal(capturedRequest.model, env.groqModel);
  assert.equal(capturedRequest.temperature, 0);
  assert.equal(capturedRequest.response_format.type, "json_object");
  assert.match(capturedRequest.messages[1].content, /Extract PO data from the provided text\./);
  assert.match(capturedRequest.messages[1].content, /Fields: poNumber, poDate, vendorName/);
});