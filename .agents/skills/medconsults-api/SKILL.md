---
name: medconsults-api
description: >-
  Use this skill to inspect, test, and manage the Medconsults backend API and sync collections to Postman. Supports running automated endpoint verification tests, checking MongoDB readiness, and syncing standalone category-wise collections to the user's Postman workspace.
---

# Medconsults API & Postman Management Skill

> [!IMPORTANT]
> ### 🚨 Mandatory Rule (Read First): Automatic API Documentation & Postman Sync
> Whenever you add, modify, or deprecate any API endpoint, route, controller, Zod validation schema, or Mongoose model under `backend/src/`, you **MUST ALWAYS** update the corresponding documentation and Postman artifacts before completing your task.
>
> 1. **Update `docs/API_DOCUMENTATION.md`**:
>    - Method, route path, auth requirement, role guards (`patient`, `doctor`, `admin`, `public`).
>    - Headers, path params, query params, request body schema.
>    - Sample success responses (`200 OK` / `201 Created`).
>    - All status & application error codes (`400`, `401`, `403`, `404`, `409`, `429`, `500`) with exact `code` strings.
>    - Multi-scenario handling (e.g. approve, reject, cancel within vs outside window, atomic reschedule).
> 2. **Update `docs/DEVELOPER_HANDOVER_GUIDE.md`**:
>    - Database collections & indexing table if schemas change.
>    - Environment variables matrix if new `.env` keys are added.
>    - Architectural Decision Records (ADRs) if core rules change.
> 3. **Update Postman Collections & Skill Reference**:
>    - Standalone category collections in `backend/postman/collections/`.
>    - Quick reference in `.agents/skills/medconsults-api/references/endpoints.md`.
>    - Push updates to Postman via `npm run postman:sync`.
> 4. **Run Verification**:
>    - Run `npm run test:api` and `npm run test:backend`.
>
> **Never mark a task complete if code and documentation are out of sync.**

---

## Workflows & Commands

### 1. Run Automated API Test Suite
Executes end-to-end integration checks against the running server (`http://localhost:5001`), verifying root liveness, MongoDB readiness, public directory, registration, login, and authenticated patient routes.

```bash
node .agents/skills/medconsults-api/scripts/test-api.js
```

### 2. Sync Collections to Postman Workspace
Synchronizes all 8 individual category collections from `backend/postman/collections/` into the user's Postman workspace (`medconsults`):

```bash
node .agents/skills/medconsults-api/scripts/sync-postman.js
```

### 3. Run Security & Concurrency Verification
Executes the backend's timing-safe comparison, AES-256-GCM encryption with key version prefix, session hashing, slot generation, and 4-way double-booking concurrency simulation:

```bash
npm test --prefix backend
```

### 4. Check API Server Status
Verifies the server is active on the configured port:

```bash
curl http://localhost:5001/ready
```

---

## References

* [API Endpoints & Payloads Reference](./references/endpoints.md)
* [Local Postman Collections](../../backend/postman/collections/)
* [Postman Environment Settings](../../backend/postman/environment.json)

