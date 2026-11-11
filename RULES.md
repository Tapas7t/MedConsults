# Project Rules

## Mandatory Rule: Automatic API Documentation & Postman Sync

Whenever you add, modify, or deprecate any API endpoint, route, controller, Zod validation schema, or database model under `backend/src/`, you **MUST ALWAYS** update the corresponding documentation and Postman artifacts before completing your task.

### 1. Update `docs/API_DOCUMENTATION.md`
Every API change must be reflected in [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md):
- **Endpoint Specification:** HTTP Method, Route path, Auth requirement, Role permissions (`patient`, `doctor`, `admin`, `public`).
- **Input Parameters:** Request headers, path params, query params, and complete request body schema with required/optional field annotations.
- **Response Payloads:** Document `200 OK` or `201 Created` sample responses matching actual controller output.
- **Status & Error Codes:** Document all possible error outcomes (`400`, `401`, `403`, `404`, `409`, `429`, `500`) with their exact `code` strings (e.g., `VALIDATION_ERROR`, `SLOT_TAKEN`, `OUTSIDE_CANCEL_WINDOW`).
- **Multi-Scenario Handling:** Describe state transition outcomes (e.g., approve vs. reject, cancel inside vs. outside cutoff, atomic reschedule).

### 2. Update `docs/DEVELOPER_HANDOVER_GUIDE.md`
- If a Mongoose schema or index changes, update the **Database Collections & Indexing Reference** table.
- If any new environment variable is introduced, add it to the **Environment Variables Matrix** (`.env`).
- If a core architectural invariant or business rule changes, record it under **Architectural Decision Records (ADRs)**.

### 3. Update Postman Collections
- Update the relevant standalone category collection under `backend/postman/collections/`.
- Ensure new endpoints, headers, and request/response examples are updated in their category collection.

### 4. Verification Check
After making changes to APIs and documentation, run:
```bash
npm run test:e2e       # Verify all 44 endpoints pass automated scenario tests
npm run test:backend   # Verify security and concurrency guards pass
```
Never mark a task complete if code and documentation are out of sync.

