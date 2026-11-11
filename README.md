# Medconsults

A practice-management and booking web app for individual doctors and dentists.
Built per **Medconsults PRD v2** and **Full-Stack Project Blueprint v2.2**.

## Architecture & Tech Stack

- **Backend**: Node.js (Active LTS v24+) + Express 5 + TypeScript + MongoDB (Mongoose)
- **Frontend**: Next.js (App Router) + React + TypeScript + Tailwind (Medical theme)
- **Authentication**: Session-based with `sessionId.secret` rotation and family revocation (Email/password only)
- **Security**:
  - AES-256-GCM encryption with `keyVersion` prefix for consultation notes & visit reasons
  - DB-level overlap prevention with transactional booking + unique partial index on `(doctorId, startAt)`
  - Timing-safe secret comparisons (`crypto.timingSafeEqual`)
  - Resource ownership validation returning 404 (IDOR prevention)
  - Account lockout with TTL indexing (5 failed attempts → 15 min lock)
  - Zero PII / tokens in logs or email subjects
- **Scheduling**:
  - UTC storage for all appointments
  - Clinic-local schedules with IANA timezone representation
  - Background reminder worker with atomic job claiming (`pending -> processing` with `lockedAt`)

## Project Structure

```
├── backend/            # Express + TypeScript API + Worker
│   ├── src/            # Modular backend source code
│   └── postman/        # Postman collections & environment
├── docs/               # Complete Project & API Documentation
│   ├── API_DOCUMENTATION.md          # Full endpoint catalog, schemas, scenarios & error codes
│   └── DEVELOPER_HANDOVER_GUIDE.md   # Architectural decisions, data models & onboarding guide
├── .agents/skills/     # Antigravity automation skills & runbooks
├── frontend/           # Next.js App Router Client (Phase 2)
├── instruction.md      # Blueprint v2.2 guidelines
└── medconsults_prd.md  # PRD v2 specification
```

## Documentation & Runbooks

* 📖 **[API Documentation](docs/API_DOCUMENTATION.md)**: Complete endpoint catalog, schemas, multi-scenario lifecycle flows, and error taxonomy.
* 🛠️ **[Developer Handover Guide](docs/DEVELOPER_HANDOVER_GUIDE.md)**: Architecture diagrams, ADRs, database collections, environment variable matrix, and handover notes.
* 📋 **[Project Rules](RULES.md)**: Mandatory automatic API documentation and Postman sync rules.

## Quick Start (Backend)

1. `cd backend`
2. `npm install`
3. Check `.env` settings (MongoDB URI, JWT secrets, Encryption keys)
4. Run development server:
   ```bash
   npm run dev
   ```
5. Run tests & Postman sync from project root:
   ```bash
   npm run test:api       # Automated end-to-end API verification suite
   npm run test:backend   # Security & concurrency simulation tests
   npm run postman:sync   # Synchronize collections directly to Postman
   ```
