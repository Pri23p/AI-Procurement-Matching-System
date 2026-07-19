# Finifi Three-Way Match Engine

Backend assignment for uploading and parsing Purchase Orders, GRNs, and Invoices, storing the parsed data in MongoDB, and computing an item-level three-way match by `poNumber`.

---

## 1. Approach
The service takes uploaded procurement files (PO, GRN, and Invoices) and handles them in a decoupled, state-derived manner:
- **Asynchronous Task Queue**: Files are uploaded instantly (HTTP 202) and registered as background jobs. A MongoDB-backed worker polls and processes the files asynchronously (using text/image extractors and LLM providers) to prevent gateway timeouts.
- **State Recalculation**: Instead of carrying complex workflow history, we treat each uploaded file as an independent event. Once a document is parsed, we load all stored files under that `poNumber` and derive/update the matching state cleanly in MongoDB.
- **Alias-Based Normalization**: Solves the issue where POs, GRNs, and Invoices use different identifier code formats (HSN codes, internal SKUs, and Vendor codes). Mappings are seeded at connection time and checked instantly using an in-memory cache at runtime.

---

## 2. Data Model

### `Task`
Tracks background job states:
- `status` (`pending`, `processing`, `completed`, `failed`)
- `documentType` (`po`, `grn`, `invoice`)
- `sourceFile` (original filename, storage path, file size)
- `poNumber`
- `documentId` (reference to parsed document object)
- `error` (error diagnostics if failed)

### `Document`
Persists the raw and cleaned results of each uploaded file:
- `documentType`
- `poNumber`
- `documentNumber`
- `documentDate`
- `vendorName`
- `items` (`[{ itemKey, itemCode, sku, description, quantity, unit }]`)
- `rawExtraction` (exact JSON received from the LLM)
- `normalizedData` (structured metadata cleanup)

### `MatchResult`
A cached derived snapshot computed per `poNumber`:
- `status` (`matched`, `partially_matched`, `mismatch`, `insufficient_documents`)
- `reasons` (collection of matched warnings and reasons)
- `linkedDocuments` (summarized list of parsed PO, GRN, and Invoice files)
- `itemResults` (item-level matching grid showing poQuantity, totalReceivedQuantity, totalInvoicedQuantity, and status)

---

## 3. Parsing Flow
1. File is uploaded to local disk via `multer`.
2. A database `Task` is registered and returns a `202 Accepted` response with the task ID.
3. The background worker picks up the task, extracts text from the PDF, and sends it to the Groq API.
4. Prompt instructions restrict Groq to return raw JSON only and guide it to extract unique SKU identifiers instead of shared HSN numbers.
5. The extracted payload is validated against Zod schemas.
6. Mappings resolve external aliases (HSN, vendor codes) to internal SKUs.
7. The Document record is created and the match result is refreshed for the extracted `poNumber`.

---

## 4. Matching Logic
Matching operates at the item level by querying the Product Mapping cache first, then falling back to signature keyword description checks:
- **Rules evaluated**:
  - GRN quantity must not exceed PO quantity.
  - Invoice quantity must not exceed PO quantity.
  - Invoice quantity must not exceed total GRN quantity.
  - Invoice date must not be after PO date.
  - GRN or invoice items missing from the PO are flagged.
  - Multiple PO documents for the same `poNumber` are flagged as `duplicate_po`.
- **Match Status**:
  - `mismatch`: One or more hard validation rules fail.
  - `insufficient_documents`: Missing PO, GRN, or Invoice records.
  - `matched`: All documents exist and quantities are 100% fulfilled without errors.
  - `partially_matched`: All documents exist, no errors are present, but quantities are only partially fulfilled.

---

## 5. Out-of-Order Uploads
Since each document is saved independently, documents can be uploaded in any sequence (e.g., Invoice -> GRN -> PO). Once a new file completes processing, the engine fetches all stored documents matching the `poNumber` and recomputes the derived `MatchResult` state. This makes uploads safe to retry, self-healing, and sequence-agnostic.

---

## 6. Assumptions
- One uploaded file represents exactly one Purchase Order, GRN, or Invoice.
- `poNumber` is present and extractable on all documents.
- PDFs either contain extractable text or can be sent to LLM vision APIs as images.
- Date comparisons are strict (invoice date <= PO date), matching the assignment spec literally.

---

## 7. Tradeoffs
- **MongoDB-Backed Queue**: Chosen for simplicity in local setups instead of using Redis and BullMQ, keeping deployment configuration down to a single MongoDB instance.
- **In-Memory Cache**: Loads the product mappings database in memory at startup. Very fast for lookups and keeps the normalizer synchronous, but would need cache synchronization (e.g. PubSub) in a horizontally scaled multi-instance setup.

---

## 8. What I Would Improve With More Time
- Implement request tracing and authentication middleware.
- Add document pagination and user dashboards.
- Deploy uploads directly to cloud storage (S3) instead of local folders.
- Add user-facing screens to manually link and resolve items that fail fuzzy keyword matching.

---

## API Usage Examples

{{ ... }}
npm start
```

Set `MONGODB_URI` and `GROQ_API_KEY` in `.env` before starting the server.

---

## Verification

Run unit and integration tests:
```bash
npm test
```
