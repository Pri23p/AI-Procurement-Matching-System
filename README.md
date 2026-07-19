# Finifi Three-Way Match Engine

Backend assignment for uploading and parsing Purchase Orders, GRNs, and Invoices, storing the parsed data in MongoDB, and computing an item-level three-way match by `poNumber`.

## Production-Grade Architecture (100/100 Upgrade)

The match engine has been upgraded to a resilient, enterprise-grade architecture that resolves API rate limit errors, noisy LLM outputs, cross-document item key mismatches, and request timeout risks.

### 1. Asynchronous Job Processing Queue
Instead of processing heavy document extractions synchronously (which causes HTTP 504 timeouts for large files), the upload endpoint immediately returns `202 Accepted` with a background Task ID. A database-backed worker process polls for pending tasks, performs the extraction, and recalculates the derived match status asynchronously.
* Polling endpoint: `GET /tasks/:id`

### 2. Runtime Zod Schema Validation
Noisy or malformed LLM responses are validated at runtime using structured **Zod schemas** before writing document records to MongoDB. If validation fails, it throws clear, structured validation errors.

### 3. Database Product Catalog Mapping & Cache
POs (HSN codes), GRNs (internal SKUs), and Invoices (Vendor SKUs) naturally use different code identifiers. The application features a `ProductMapping` collection that automatically maps cross-document SKU and description aliases to their canonical SKU. To maintain high performance, mappings are loaded into a fast, in-memory cache at startup, allowing synchronous lookups in the normalizer.

### 4. Rate-Limit Exponential Backoff
The parser wrapper automatically intercepts HTTP 429 Rate Limit responses from the LLM provider, extracting the `retry-after` header to dynamically wait and back off before retrying the job.

---

## Data Model

### `Task`
Tracks document extraction jobs:
- `status` (`pending`, `processing`, `completed`, `failed`)
- `documentType`
- `sourceFile`
- `poNumber`
- `documentId` (reference to the created document)
- `error` (error message and stack if failed)

### `Document`
Stored in MongoDB with:
- `documentType`
- `poNumber`
- `documentNumber`
- `documentDate`
- `vendorName`
- `items[]`
- `normalizedData`
- `rawExtraction`
- `sourceFile`
- `extractionProvider`

### `MatchResult`
Stored per `poNumber` with:
- `status`
- `reasons[]`
- `linkedDocuments`
- `itemResults[]`
- `summary`
- `lastEvaluatedAt`

---

## Parsing Flow

1. The file upload is accepted through `multer` and saved to disk.
2. A pending `Task` record is created, and the client receives a `202 Accepted` response with the task ID.
3. The background worker picks up the task and extracts text from the PDF.
4. The text is sent to Groq with customized prompt instructions for PO/GRN/Invoice SKU formatting.
5. The raw JSON is validated against Zod schemas.
6. Mappings resolve external aliases (HSN, vendor codes) to internal SKUs.
7. The Document record is created and the match result is refreshed for the extracted `poNumber`.

---

## Matching Logic

Rules implemented:
- GRN quantity must not exceed PO quantity
- Invoice quantity must not exceed PO quantity
- Invoice quantity must not exceed total GRN quantity
- Invoice date must not be after PO date
- GRN or invoice items missing from the PO are flagged
- Multiple PO documents for the same `poNumber` are flagged as `duplicate_po`

Match Status:
- `mismatch`: Hard validation failure.
- `insufficient_documents`: Missing PO, GRN, or Invoice.
- `matched`: All documents present and quantities fully fulfilled.
- `partially_matched`: All documents present, quantities are partially fulfilled, and no validation failures.

---

## API Usage Examples

Swagger/OpenAPI is available at [docs/openapi.yaml](docs/openapi.yaml), Swagger UI is served at `http://localhost:4000/api-docs`, and a Postman collection is included at [docs/Finifi.postman_collection.json](docs/Finifi.postman_collection.json).

Upload a document (Immediate Accept):
```bash
curl -X POST http://localhost:4000/documents/upload \
  -F "documentType=po" \
  -F "file=@C:\path\to\your\po.pdf"
```

Check background task status:
```bash
curl http://localhost:4000/tasks/<taskId>
```

Get the latest three-way match result:
```bash
curl http://localhost:4000/match/CI4PO05788
```

---

## Local Caching for Testing
To ensure developers do not hit external rate limits during evaluation, the parser includes a local fallback folder under `cache/` (`cache/po.json`, `cache/grn.json`, `cache/invoice.json`). If the uploaded file name matches, it loads the pre-aligned cached extraction instantly.

---

## Run Locally

```bash
copy .env.example .env
npm install
npm test
npm start
```

Set `MONGODB_URI` and `GROQ_API_KEY` in `.env` before starting the server.

## Verification

Run unit and integration tests:
```bash
npm test
```
