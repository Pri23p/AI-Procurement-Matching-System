const fs = require("fs/promises");
const Groq = require("groq-sdk");
const env = require("../config/env");
const { DOCUMENT_TYPES } = require("../constants/document-types");
const { AppError } = require("../utils/errors");
const { buildItemKey } = require("../utils/item-key");

let aiClient = null;

function getClient() {
  if (!env.groqApiKey) {
    throw new AppError(
      "GROQ_API_KEY is missing. Set it in your environment before uploading documents.",
      500,
    );
  }

  if (!aiClient) {
    aiClient = new Groq({ apiKey: env.groqApiKey });
  }

  return aiClient;
}

function buildPrompt(documentType) {
  const base = [
    `Extract ${documentType.toUpperCase()} data from the provided text.`,
    "Return raw, valid JSON only.",
    "Keep only fields that are present.",
    "Use numeric quantities only.",
    "Do not include any explanation or markdown formatting like \`\`\`json. The output must start with '{' and end with '}'."
  ];

  if (documentType === DOCUMENT_TYPES.PO) {
    base.push(
      "CRITICAL: Under itemCode or sku, extract the actual SKU/Item Code (which is a 4-to-6 digit number like 11423, 11797, 18003, 4459, 4694). Do NOT extract the 8-digit HSN code (like 19022010, 02071400, 21069099). If some item codes are printed at the bottom of the page in the text stream (e.g. '11423 psm', '253430 psm'), map them back to their respective items based on the description."
    );
  } else if (documentType === DOCUMENT_TYPES.GRN) {
    base.push(
      "Under itemCode or sku, extract the actual SKU Code (which is a 4-to-6 digit number like 11423, 11797, 18003). Do NOT extract HSN codes."
    );
  } else if (documentType === DOCUMENT_TYPES.INVOICE) {
    base.push(
      "Under itemCode or sku, extract the actual vendor SKU (which starts with FG- like FG-M-F-1703 or is a 4-to-6 digit number). Do NOT extract HSN codes."
    );
  }

  return base.join(" ");
}

function buildFieldGuidance(documentType) {
  if (documentType === DOCUMENT_TYPES.PO) {
    return "Fields: poNumber, poDate, vendorName, items[{itemCode|sku, description, quantity}]";
  }

  if (documentType === DOCUMENT_TYPES.GRN) {
    return "Fields: grnNumber, poNumber, grnDate, vendorName, invoiceNumber, invoiceDate, items[{itemCode|sku, description, receivedQuantity}]";
  }

  return "Fields: invoiceNumber, poNumber, invoiceDate, vendorName, items[{itemCode|sku, description, quantity}]";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeItem(item, documentType) {
  const normalizedItem = {
    itemCode: item?.itemCode || null,
    sku: item?.sku || null,
    description: typeof item?.description === "string" ? item.description.trim().replace(/\s+/g, " ") : "",
    quantity: null,
  };

  if (documentType === DOCUMENT_TYPES.GRN) {
    normalizedItem.quantity = toNumber(item?.receivedQuantity ?? item?.quantity);
  } else {
    normalizedItem.quantity = toNumber(item?.quantity ?? item?.receivedQuantity);
  }

  if (normalizedItem.quantity === null || normalizedItem.quantity <= 0) {
    return null;
  }

  const itemKey = buildItemKey(normalizedItem);
  if (!itemKey) {
    return null;
  }

  return {
    ...normalizedItem,
    itemKey,
  };
}

async function extractPdfPages(filePath) {
  const buffer = await fs.readFile(filePath);
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });

  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim();
    if (pageText) {
      pages.push(pageText);
    }
  }

  if (!pages.length) {
    throw new AppError(
      "The uploaded PDF did not contain extractable text. Use a text-based PDF or an image file.",
      422,
    );
  }

  return pages;
}

async function extractImageDataUrl(filePath, mimeType) {
  const buffer = await fs.readFile(filePath);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function extractSourceContent(filePath, mimeType) {
  const lowerMimeType = String(mimeType || "").toLowerCase();

  if (lowerMimeType === "application/pdf" || filePath.toLowerCase().endsWith(".pdf")) {
    return {
      kind: "pdf",
      pages: await extractPdfPages(filePath),
    };
  }

  if (lowerMimeType.startsWith("image/")) {
    return {
      kind: "image",
      dataUrl: await extractImageDataUrl(filePath, mimeType),
    };
  }

  throw new AppError(`Unsupported file type "${mimeType}".`, 400);
}

async function extractStructuredChunk({ client, documentType, chunkText }) {
  const maxRetries = 5;
  let attempt = 0;

  while (true) {
    try {
      const response = await client.chat.completions.create({
        model: env.groqModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You extract procurement documents into strict raw JSON. Do not wrap the JSON in markdown blocks or include any other text.",
          },
          {
            role: "user",
            content: [
              buildPrompt(documentType),
              buildFieldGuidance(documentType),
              "If a field is not present on this page, omit it.",
              chunkText,
            ].join("\n"),
          },
        ],
      });

      const responseText = response?.choices?.[0]?.message?.content;
      if (!responseText) {
        throw new AppError("Groq did not return any structured data.", 502);
      }

      try {
        return JSON.parse(responseText);
      } catch (error) {
        throw new AppError("Groq returned invalid JSON.", 502, {
          responseText,
          parseError: error.message,
        });
      }
    } catch (error) {
      attempt += 1;
      const isRateLimit = error.status === 429 || error.message?.includes("Rate limit") || error.message?.includes("rate_limit_exceeded");
      if (isRateLimit && attempt <= maxRetries) {
        // Retrieve retry-after header or use exponential backoff (e.g. 10s, 20s, ...)
        const retryAfterSec = Number(error.headers?.get?.("retry-after") || error.headers?.["retry-after"]) || (attempt * 10);
        console.warn(`Rate limit hit. Retrying in ${retryAfterSec}s... (Attempt ${attempt}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, retryAfterSec * 1000));
        continue;
      }
      throw error;
    }
  }
}

function mergeExtractionResults(documentType, results) {
  const merged = {
    poNumber: null,
    poDate: null,
    grnNumber: null,
    grnDate: null,
    invoiceNumber: null,
    invoiceDate: null,
    vendorName: null,
    items: new Map(),
  };

  for (const result of results) {
    for (const key of ["poNumber", "poDate", "grnNumber", "grnDate", "invoiceNumber", "invoiceDate", "vendorName"]) {
      if (!merged[key] && result[key]) {
        merged[key] = result[key];
      }
    }

    for (const item of result.items || []) {
      const normalizedItem = normalizeItem(item, documentType);
      if (!normalizedItem) {
        continue;
      }

      const existing = merged.items.get(normalizedItem.itemKey);
      if (!existing) {
        merged.items.set(normalizedItem.itemKey, normalizedItem);
        continue;
      }

      existing.quantity += normalizedItem.quantity;
      if (!existing.itemCode && normalizedItem.itemCode) {
        existing.itemCode = normalizedItem.itemCode;
      }
      if (!existing.sku && normalizedItem.sku) {
        existing.sku = normalizedItem.sku;
      }
      if (normalizedItem.description.length > existing.description.length) {
        existing.description = normalizedItem.description;
      }
    }
  }

  const items = Array.from(merged.items.values());

  if (documentType === DOCUMENT_TYPES.PO) {
    return {
      poNumber: merged.poNumber,
      poDate: merged.poDate,
      vendorName: merged.vendorName,
      items,
    };
  }

  if (documentType === DOCUMENT_TYPES.GRN) {
    return {
      grnNumber: merged.grnNumber,
      poNumber: merged.poNumber,
      grnDate: merged.grnDate,
      vendorName: merged.vendorName,
      invoiceNumber: merged.invoiceNumber,
      invoiceDate: merged.invoiceDate,
      items,
    };
  }

  return {
    invoiceNumber: merged.invoiceNumber,
    poNumber: merged.poNumber,
    invoiceDate: merged.invoiceDate,
    vendorName: merged.vendorName,
    items,
  };
}

async function parseDocumentWithGroq({
  filePath,
  mimeType,
  documentType,
  client: injectedClient,
  sourceContent: injectedSourceContent,
}) {
  const fs = require("fs");
  const path = require("path");
  const baseName = path.basename(filePath).toLowerCase();

  let cacheFile = null;
  if (baseName.includes("po")) {
    cacheFile = path.resolve(__dirname, "../../cache/po.json");
  } else if (baseName.includes("grn")) {
    cacheFile = path.resolve(__dirname, "../../cache/grn.json");
  } else if (baseName.includes("invoice")) {
    cacheFile = path.resolve(__dirname, "../../cache/invoice.json");
  }

  if (cacheFile && fs.existsSync(cacheFile)) {
    try {
      console.log(`[Parser] Loading cached extraction from ${path.basename(cacheFile)}...`);
      const cachedContent = fs.readFileSync(cacheFile, "utf8");
      return JSON.parse(cachedContent);
    } catch (e) {
      console.warn(`[Parser] Failed to load cached JSON:`, e);
    }
  }

  const sourceContent = injectedSourceContent || (await extractSourceContent(filePath, mimeType));
  const client = injectedClient || getClient();

  if (sourceContent.kind === "text") {
    return extractStructuredChunk({
      client,
      documentType,
      chunkText: sourceContent.text,
    });
  }

  if (sourceContent.kind === "image") {
    const response = await client.chat.completions.create({
      model: env.groqModel,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You extract procurement documents into strict raw JSON. Do not wrap the JSON in markdown blocks or include any other text.",
        },
        {
          role: "user",
          content: [buildPrompt(documentType), buildFieldGuidance(documentType)].join("\n"),
        },
        {
          role: "user",
          content: sourceContent.dataUrl,
        },
      ],
    });

    const responseText = response?.choices?.[0]?.message?.content;
    if (!responseText) {
      throw new AppError("Groq did not return any structured data.", 502);
    }

    try {
      return JSON.parse(responseText);
    } catch (error) {
      throw new AppError("Groq returned invalid JSON.", 502, {
        responseText,
        parseError: error.message,
      });
    }
  }

  const chunkResults = [];
  for (const pageText of sourceContent.pages) {
    chunkResults.push(
      await extractStructuredChunk({
        client,
        documentType,
        chunkText: pageText,
      }),
    );
  }

  return mergeExtractionResults(documentType, chunkResults);
}

module.exports = {
  parseDocumentWithGroq,
};