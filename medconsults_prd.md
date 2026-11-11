# Medconsults — Product Requirements Document v2

**A practice-management and booking web app for individual doctors and dentists.** Built on *Full-Stack Project Blueprint v2.2*. Stack: Next.js + React, Node.js + Express, MongoDB, Tailwind. Auth: email only.

> **Version Safety Rule (inherited):** No dependency versions are pinned here. Before writing any `package.json`, web-search each package for latest stable and advisories, confirm with `npm show <pkg> version`, run `npm audit`, and state what was verified. Target the current Node.js Active LTS. Also re-verify any Blueprint code sample (for example Sentry handlers, express-mongo-sanitize on Express 5) against current docs.

**What changed from v1:** one doctor = one clinic = one account; the doctor side is a lightweight CRM; consultations are in-clinic; payment is at the clinic; MVP is trimmed; sessions, time, slots and reminders are redesigned; acceptance criteria added.

---

## 1. Product Definition

Medconsults has two faces:

1. **For doctors/dentists (core product):** a personal practice tool. Each doctor registers once, sets up their single clinic, publishes availability, and manages appointments and patients from a dashboard.
2. **For patients:** find a specific doctor (via the doctor's personal link or the public directory) and book an in-clinic appointment in a few taps.

**Positioning:** Every doctor gets a personal booking page (`medconsults.com/dr/<slug>`) to share with their own patients. A simple public directory sits on top. Doctors get value on day one with zero marketplace traffic.

**Goals**

1. A patient books in under 2 minutes, with 4 or fewer taps from the doctor's page.
2. No double-bookings, enforced at the database level.
3. Fewer no-shows through timely reminders that include the clinic address.
4. A doctor can run a day's schedule from the dashboard between patients with minimal taps.
5. Protect patient data to the Blueprint security standard.

**Non-goals (v1):** video/telemedicine, online payments or payouts, multi-clinic doctors, reviews, SMS/WhatsApp, e-prescriptions, insurance, native apps.

**Personas**

| Persona | Needs |
| --- | --- |
| **Patient** | Find their doctor, see fee/address/hours, book for self or a family member, get reminders, reschedule/cancel |
| **Doctor/Dentist** | Publish hours, see today's queue, mark arrived/completed/no-show, keep patient history and private notes, block time, share a booking link |
| **Admin** | Approve doctors, block abusive accounts, see basic platform numbers |

---

## 2. Scope & Phasing

| Phase | Included |
| --- | --- |
| **MVP (P0)** | Email auth (3 roles) with verification and reset; doctor onboarding + admin approval; single-clinic profile; personal booking link; directory search (specialty, area, name); weekly availability, leave and manual blocks; booking (self or dependent); cancel/reschedule; appointment statuses incl. `arrived`; doctor dashboard (today, patients, notes); email reminders; basic admin panel |
| **v1.1** | Reviews (patient-confirmed attendance), doctor stats, data export/deletion UI, session management UI |
| **v2** | SMS/WhatsApp reminders, optional online deposit, Socket.io live updates, reports/CSV, multi-clinic |

**Deliberate cuts from v1:** Socket.io (a `409 SLOT_TAKEN` plus automatic slot refetch covers it), audit-log UI, reports, reviews, payments.

---

## 3. Tech Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | React + **Next.js** (App Router), TypeScript strict | SSR for doctor pages and directory (SEO + shareable links); client components for booking and dashboards |
| Styling | **Tailwind CSS** | Medical theme tokens (§10) |
| Backend | **Node.js + Express**, TypeScript strict | Modular, per Blueprint §2 |
| Database | **MongoDB Atlas** + Mongoose | Replica set (needed for transactions); IP allowlist; restricted DB user |
| Validation | Zod | Env, request bodies, query, params, forms |
| Auth | Email + password, JWT access + rotating refresh sessions | bcryptjs for passwords |
| Security | helmet, cors, express-mongo-sanitize (verify Express 5 support), express-rate-limit | Blueprint §4/§6 |
| Jobs | Dedicated worker process (node-cron or a queue) with atomic job claiming | See §8 |
| Email | nodemailer with SMTP/Resend/SendGrid |  |
| Logging | winston, @sentry/node | Redact PII and tokens |
| Client data | TanStack Query, Axios, React Hook Form + Zod, DOMPurify |  |
| Deploy | Vercel (frontend), Render/Railway (API + worker), Atlas (DB) | **Use one registrable domain**: `medconsults.com` and `api.medconsults.com` so `SameSite=Strict` cookies work |

**Token standard:** access JWT 15 min (Authorization header, in memory only); refresh session 7 days in `HttpOnly; Secure; SameSite=Strict` cookie.

---

## 4. Functional Requirements

### 4.1 Authentication & Sessions (P0)

| ID | Requirement |
| --- | --- |
| AUTH-1 | Register with name, email, **phone**, password, role (`patient` or `doctor`). Admins are seeded or created by admins only. |
| AUTH-2 | Email verification via single-use expiring token (`crypto.randomBytes(32)`, stored as SHA-256 hash). Unverified users cannot book; unverified doctors cannot submit for approval. |
| AUTH-3 | Login returns access token (JSON) and sets the refresh cookie. |
| AUTH-4 | **Session design:** refresh cookie value is `<sessionId>.<secret>`. DB stores `sessionId`, `SHA-256(secret)`, `familyId`, `expiresAt`, device info. Lookup by `sessionId`, compare hash with `timingSafeEqual`. (SHA-256 is appropriate because the secret is high-entropy random; bcrypt hashes cannot be looked up by token.) |
| AUTH-5 | Rotation: each refresh issues a new secret and invalidates the old one. Reuse of an old secret revokes the whole `familyId`. |
| AUTH-6 | Forgot/reset password with expiring single-use token; generic responses (no email enumeration). Reset revokes all sessions. |
| AUTH-7 | Lockout: 5 failed logins → 15 min lock (TTL-indexed attempts). |
| AUTH-8 | Password: min 8 characters, Zod-validated, bcrypt cost ≥ 10. |

### 4.2 Doctor Onboarding & Clinic Profile (P0)

One doctor account owns exactly one clinic, stored directly on the profile.

- **Professional:** name, photo, type (`doctor`/`dentist`), specialty, qualifications, registration/licence number, years of experience, languages, bio.
- **Clinic:** clinic name, full address, area/locality, city, pin/postal code, geo-coordinates, map link, landmark/parking notes, phone, **IANA timezone** (e.g. `Asia/Kolkata`), photos.
- **Booking settings:** consultation fee (display only, "pay at clinic"), slot length (minutes), lead time (min notice), booking horizon (days), cancellation window (hours), auto-confirm (default **on**) or manual approval.
- **Personal slug** for the booking link (unique, validated, reserved words blocked).
- **Status:** `draft` → `pending_approval` → `approved` | `rejected` | `suspended`. Only `approved` profiles are bookable and listed. Edits to licence number or specialty trigger re-review.
- Doctor can **hide from directory** while keeping the personal link active.

### 4.3 Discovery (P0)

- **Personal link:** `/dr/<slug>`, SSR, SEO-friendly, shows profile, clinic, fee, next available slots and a sticky "Book" button.
- **Directory:** search by name, specialty, area/city; filter by type, fee range, language, availability date; sort by earliest availability or fee. Paginated. Text index on non-sensitive fields only; 2dsphere index for "near me" (optional).
- Home page: search bar, specialty tiles, banner, login/sign-up.

### 4.4 Availability (P0)

- **Weekly schedule** in **clinic local time**: per weekday, one or more ranges, plus breaks.
- **Exceptions:** leave days, special hours.
- **Manual blocks:** block any time range (walk-in rush, emergency) in two taps.
- **Walk-in entry:** doctor can create a walk-in appointment for an existing or new patient name, occupying a slot so the online calendar stays accurate.
- **Slot model:** slots are computed on a fixed grid from schedule + `slotMinutes`, converted to UTC for storage and comparison. A slot is bookable only if it does not overlap any active appointment or block.
- **Changing slot length** applies only to dates with no existing appointments; existing appointments keep their stored `endAt`.

### 4.5 Booking (P0)

1. Patient opens doctor page → picks date → picks slot.
2. Chooses **who the visit is for** (self or a saved dependent: name, date of birth, relation), adds reason (optional).
3. Confirms. Status becomes `confirmed` (auto-confirm) or `pending` (manual approval).
4. The server runs **inside a transaction**: checks overlap against active appointments and blocks, then inserts. A unique index on `(doctorId, startAt)` for active statuses is the backstop. Losers get `409 SLOT_TAKEN` and the UI refetches slots.
5. Confirmation emails go to the patient (with address and map link) and the doctor.
6. A patient cannot hold two overlapping active appointments, and may have at most N upcoming active bookings per doctor (default 3) to limit abuse.

### 4.6 Appointment Lifecycle (P0)

```
pending ──► confirmed ──► arrived ──► completed
   │            │            │
   └────────────┴────────────┴──► cancelled (patient / doctor / admin)
                 └──────────────► no_show (doctor, after start time)
confirmed ──► rescheduled (new appointment linked; old slot freed)
```

- **Patient:** view upcoming/past, reschedule or cancel inside the allowed window, add the clinic to calendar (.ics download).
- **Doctor:** confirm/decline pending requests, mark arrived/completed/no-show, reschedule, cancel (patient is emailed), add notes.
- **No-show policy:** count per patient; after a configurable threshold the platform warns, then may restrict booking (admin-reviewable).
- Every transition stores `statusHistory` (who, when, from → to).

### 4.7 Doctor Dashboard & Patient CRM (P0)

- **Today view:** timeline with status chips and one-tap actions (arrived, complete, no-show), next patient highlighted, quick "block time" and "add walk-in".
- **Patients:** list with search; each patient shows visit history, dependents, no-show count, and doctor-only notes.
- **Consultation notes:** doctor-written, per appointment, encrypted at rest (AES-256-GCM with **key version prefix** to allow rotation). Visible to the treating doctor and the patient for that appointment only. **Admins cannot read notes or reasons for visit.**
- **Basic stats (v1.1):** appointments this week, no-show rate, repeat patients.

### 4.8 Notifications (P0, email)

| Event | To | Content notes |
| --- | --- | --- |
| Verify email / password reset | User | Link only |
| Booking confirmed / pending | Patient, Doctor | Date, time, clinic address, map link |
| Doctor confirms/declines | Patient |  |
| Reschedule / cancellation | Both |  |
| Reminders **24 h** and **2 h** before | Patient | Address + directions link |
| Doctor approved/rejected | Doctor |  |

- Emails contain no clinical details. Subjects are generic.
- Users can opt out of reminders (not transactional emails).
- SMS/WhatsApp is v2; the notification service takes a `channel` field from day one.

### 4.9 Admin (P0, minimal)

- Doctor approval queue with licence info; approve/reject (with reason)/suspend.
- Users list: search, block/unblock, soft-remove.
- Basic counters: doctors, patients, appointments this week.
- Admin role is fixed (single level in v1); no access to notes or visit reasons. Admin actions are written to an audit collection (UI in v1.1).

### 4.10 Privacy (P0 policy, v1.1 UI)

- Consent checkbox at signup (terms + privacy), timestamp stored.
- **Retention (proposal, confirm with counsel):** appointment records kept per applicable medical-records rules; deleted accounts are soft-deleted then purged after 30 days where law allows; login attempts 24 h; email tokens expire automatically.
- `GET /users/me/export` and `DELETE /users/me` (confirmation text) in v1.1.
- Footer notice: "Medconsults is a booking platform and does not provide emergency care. In an emergency call your local emergency number."

---

## 5. Acceptance Criteria (key flows)

**Book an appointment**

- *Given* an approved doctor with open slots, *when* a verified patient selects a slot and confirms, *then* an appointment is created with status `confirmed` (or `pending` if manual approval) and both parties receive an email with the clinic address.
- *Given* two patients confirm the same slot simultaneously, *then* exactly one succeeds and the other sees "slot just taken" with refreshed slots.
- *Given* a slot inside the lead time or beyond the horizon, *then* it is not shown and the API rejects it with `400 INVALID_REQUEST`.
- *Given* an unverified email, *when* booking, *then* the API returns `403 EMAIL_NOT_VERIFIED`.

**Cancel / reschedule**

- *Given* a confirmed appointment outside the cancellation window, *when* the patient cancels, *then* the slot is freed and both parties are emailed.
- *Given* an appointment inside the window, *then* the patient is told to call the clinic; the doctor can still cancel anytime.
- *Given* a reschedule, *then* the new slot is reserved and the old one released in one transaction; failure leaves the original intact.

**Availability changes**

- *Given* a doctor blocks a range that contains existing appointments, *then* the UI lists conflicts and requires an explicit choice (keep or cancel and notify) before saving.

**Security**

- *Given* a user requests another party's appointment ID, *then* the API returns `404 NOT_FOUND`.
- *Given* a reused refresh secret, *then* all sessions in that family are revoked and the user must log in again.

**Reminders**

- *Given* two worker instances running, *then* each reminder is sent exactly once.

---

## 6. Data Model

| Collection | Key fields | Indexes / notes |
| --- | --- | --- |
| **User** | email, passwordHash, phone, role, isEmailVerified, isBlocked, consentAt, isDeleted | unique `email` |
| **Session** | userId, sessionId, secretHash, familyId, expiresAt, userAgent | unique `sessionId`; TTL on `expiresAt` |
| **LoginAttempt** | email, ip, count, lockedUntil | TTL |
| **EmailToken** | userId, type, tokenHash, expiresAt | TTL |
| **DoctorProfile** | userId (unique), slug (unique), type, specialty, qualifications, licenceNo, experienceYears, languages, bio, photoUrl, clinic{name,address,area,city,postalCode,geo,mapUrl,notes,phone,timezone,photos}, fee, slotMinutes, leadTimeMin, horizonDays, cancelWindowHours, autoConfirm, listedInDirectory, status | text index (name, specialty, area, city, bio); `status+specialty+city`; 2dsphere on `clinic.geo` |
| **Availability** | doctorId (unique), weekly\[{day, ranges\[\], breaks\[\]}\] in local time, exceptions\[{date, ranges\[\] or closed}\] |  |
| **Block** | doctorId, startAt, endAt (UTC), reason | index `doctorId+startAt` |
| **Dependent** | patientUserId, name, dob, relation | owner-scoped |
| **Appointment** | doctorId, bookedByUserId, patientRef{type: self/dependent/walkin, name, dependentId?}, startAt, endAt (UTC), source (online/walkin), status, reasonEnc, notesEnc, statusHistory\[\], rescheduledFrom | **unique partial** `(doctorId,startAt)` on active statuses; `bookedByUserId+startAt`; `doctorId+startAt` |
| **NotificationJob** | appointmentId, type, channel, runAt, status (pending/processing/sent/failed), attempts, lockedAt | index `status+runAt`; claimed atomically |
| **AuditLog** | actorId, action, entity, entityId, meta, createdAt | admin read-only |
| **Review (v1.1)** | appointmentId (unique), rating, comment, isHidden | requires patient-confirmed attendance |

All queries filter by owner ID and `isDeleted: false`. Appointments in UTC; clinic schedule in clinic-local time with the IANA zone stored on the profile.

---

## 7. API Specification

Base: `/api/v1`. Response shapes and error codes follow the Blueprint (`{ success, data }` / `{ success:false, error:{ code, message, fields? } }`). New codes: `SLOT_TAKEN` (409), `EMAIL_NOT_VERIFIED` (403), `BOOKING_LIMIT_REACHED` (429/400), `OUTSIDE_CANCEL_WINDOW` (400).

| Module | Endpoint | Role | Purpose |
| --- | --- | --- | --- |
| Auth | `POST /auth/register`, `/verify-email`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password` | Public/Cookie | See §4.1 |
| Users | `GET/PATCH /users/me` | Any | Own profile |
|  | `GET/POST/PATCH/DELETE /users/me/dependents` | Patient | Family members |
| Public | `GET /doctors` | Public | Directory search |
|  | `GET /doctors/by-slug/:slug` | Public | Personal page data |
|  | `GET /doctors/:id/slots?from=&to=` | Public | Open slots (rate limited) |
| Doctor | `GET/PATCH /doctor/profile` | Doctor | Clinic + settings |
|  | `POST /doctor/profile/submit` | Doctor | Submit for approval |
|  | `GET/PUT /doctor/availability` | Doctor | Weekly + exceptions |
|  | `GET/POST/DELETE /doctor/blocks` | Doctor | Manual blocks |
|  | `GET /doctor/appointments?date=` | Doctor | Day/list view |
|  | `POST /doctor/appointments/walkin` | Doctor | Add walk-in |
|  | `GET /doctor/patients`, `GET /doctor/patients/:id` | Doctor | CRM list + history |
| Appointments | `POST /appointments` | Patient | Book (transactional) |
|  | `GET /appointments`, `GET /appointments/:id` | Patient/Doctor | Own only; 404 otherwise |
|  | `PATCH /appointments/:id/status` | Patient/Doctor | Role-restricted transitions |
|  | `POST /appointments/:id/reschedule` | Patient/Doctor | Atomic move |
|  | `PUT /appointments/:id/notes` | Doctor | Encrypted notes |
|  | `GET /appointments/:id/calendar.ics` | Owner | Add-to-calendar |
| Admin | `GET /admin/doctors`, `PATCH /admin/doctors/:id/status` | Admin | Approval |
|  | `GET /admin/users`, `PATCH /admin/users/:id/block` | Admin | Moderation |
|  | `GET /admin/stats` | Admin | Counters |
| Infra | `GET /health`, `GET /ready` | Public | Liveness / Mongo readiness; excluded from strict rate limits |

Every endpoint is documented in the Blueprint §5 template (headers, params, body, response codes, Postman example, use cases, business rules). Ownership check is adapted to match `bookedByUserId` or the doctor who owns the appointment, returning 404 otherwise.

---

## 8. Architecture & Engineering Decisions

**Backend:** `server.ts`, `app.ts`, `config/{env,db}.ts`, `middleware/{requireAuth,validate,roleGuard,errorHandler}.ts`, `modules/{auth,users,doctors,availability,appointments,patients,admin}/`, `services/{email,notification}.service.ts`, `utils/{jwt,session,encryption,ownership,slots,time}.ts`, `worker.ts`, `postman/`.

**Middleware order:** Sentry request handler → helmet → cors (explicit origins) → `express.json({limit:'10kb'})` → mongo-sanitize → logging → global rate limit → auth limiter → routes → Sentry error handler → central error handler.

**Frontend (Next.js):** route groups `(public)`, `(patient)`, `(doctor)`, `(admin)`; `lib/env.ts` (Zod-validated `NEXT_PUBLIC_*`), `lib/api/{client,refreshClient}.ts`, `auth/{AuthProvider,tokenStore}`, `RequireAuth` + `RoleGuard`, `features/<resource>/`. Public doctor pages are server-rendered; authenticated areas are client-rendered. Tokens never go in `localStorage`, URLs or server-visible storage.

**Key decisions**

- **Time:** appointments are UTC; schedules are clinic-local using the profile's IANA zone, so daylight-saving shifts never corrupt hours. Slot generation runs on the server only; all conversion uses a tested time utility.
- **Double-booking:** transaction with overlap check + unique partial index as the final guard. A concurrency test is mandatory.
- **Reminders:** a separate worker claims jobs with an atomic `findOneAndUpdate` (`pending → processing`), sends, then marks `sent`. Safe with multiple instances, and recovers stuck jobs via `lockedAt` timeout. Jobs are created or cancelled whenever an appointment is booked, moved or cancelled. Do not rely on a web dyno that may sleep.
- **Encryption:** AES-256-GCM with a `keyVersion` prefix; keys in env (a secrets manager later); rotation procedure documented.
- **Env:** per Blueprint §3, minus Google OAuth, VAPID and payment keys. Adds `APP_BASE_URL`, `CANCEL_WINDOW_HOURS` default, `NOTE_ENCRYPTION_KEY_V1`.

---

## 9. Pages

| Area | Pages |
| --- | --- |
| Public | Home, Directory/search, Doctor page (`/dr/<slug>`), Login, Register, Verify email, Forgot/Reset password, Terms/Privacy, 404 |
| Patient | Booking (slot + who + reason + confirm), My appointments, Appointment detail, Family members, Profile |
| Doctor | Onboarding wizard, Today dashboard, Calendar, Availability & blocks, Patients, Patient detail + notes, Clinic profile & booking settings, Booking link/QR share |
| Admin | Approval queue, Users, Stats |

---

## 10. Design: Medical Theme

**Brand:** calm, clinical, trustworthy, human.

| Token | Hex | Use |
| --- | --- | --- |
| `primary-600` | `#0E7C86` | Teal: primary buttons, links, active |
| `primary-50/100` | `#E6F6F7` / `#C7EBED` | Tints, hover |
| `navy-900` | `#0B2A4A` | Headings, header/footer |
| `accent-500` | `#2F80ED` | Info, secondary |
| `success-600` | `#1E9E6A` | Confirmed, open slots |
| `warning-500` | `#F2A93B` | Pending, reminders |
| `danger-600` | `#D64545` | Cancel, errors |
| `bg` / `surface` | `#F5FAFB` / `#FFFFFF` | Page / cards |
| `text` / `muted` | `#1F2D3D` / `#5B6B7B` | Body / secondary |

Typography: Inter or Plus Jakarta Sans, 16 px base. 12–16 px radius cards, soft shadows, Lucide line icons, skeleton loaders, "Verified" badge, real clinic photos. Status chips: pending amber, confirmed teal, arrived blue, completed green, cancelled red, no-show gray (always with text labels).

**UX priorities:** mobile-first booking with a sticky Book button; doctor dashboard optimized for speed between patients (large tap targets, one-tap status changes); QR code and copy-link for the booking page. **Accessibility:** WCAG 2.1 AA, keyboard navigation, focus rings, labelled fields, `aria-live` confirmations.

---

## 11. Security & Compliance

Adopt Blueprint §6 and §8 checklists in full. Medical emphasis:

- Ownership enforced on every appointment, patient and note query; 404 on mismatch.
- Role guards on all routes; admins cannot read notes or visit reasons.
- Field-level encryption for notes and reasons; no PII, health data or tokens in logs, Sentry events or email subjects.
- Timing-safe token comparison; hashed email and reset tokens; per-route rate limits (auth strict; slots, search, booking, walk-in separate).
- Public slug and directory exposure: only approved, listed doctors; no patient data ever on public pages.
- Frontend: DOMPurify for any rich text, URL validation, CSP, no unsanitized `dangerouslySetInnerHTML`.
- Infra: HTTPS only, Atlas allowlist, least-privilege DB user, tested backups.
- **Before launch:** confirm legal requirements for health data and doctor records in the launch geography (for example India's DPDP Act, HIPAA for US, GDPR for EU): consent, retention, breach process, privacy policy.
- Blueprint §9 hygiene: `.gitignore`, `.cursorignore`, `npm ci`, `npm audit --audit-level=high`, secret scanning in CI.

---

## 12. Non-Functional Requirements

| Area | Target |
| --- | --- |
| Performance | API p95 \< 300 ms reads; slot query \< 500 ms; LCP \< 2.5 s on public pages |
| Reliability | Idempotent jobs; email retry with backoff; graceful shutdown; health/readiness probes |
| Integrity | DB-level overlap guard; UTC storage; transactions for book/reschedule |
| Observability | Structured logs, Sentry, request IDs |
| Browsers | Latest 2 versions of Chrome, Safari, Firefox, Edge |

---

## 13. Testing

- **Unit:** slot generation (including DST transitions), status transitions, encryption (key versions), session rotation.
- **Integration:** auth, booking, ownership, role guards against a test MongoDB replica set.
- **Concurrency:** N parallel bookings for one slot → exactly one wins.
- **Worker:** two workers, one reminder → sent once.
- **E2E:** doctor onboarding → approval → patient books → reminder → arrived → completed; reschedule and cancel paths.
- **Postman:** collection and environment in `backend/postman/`, covering 200/400/401/403/404/409/429 per endpoint.
- **CI per PR:** `npm ci`, lint, `tsc --noEmit`, tests, `npm audit --audit-level=high`.

---

## 14. Success Metrics (hypotheses to validate in the pilot)

| Metric | Initial hypothesis |
| --- | --- |
| Doctors activated (profile approved + link shared) | 70% of onboarded pilot doctors within 7 days |
| Share of bookings via personal link vs directory | Track; expect link-dominant early |
| Booking completion (page view → confirmed) | Baseline in pilot, then set target |
| No-show rate | Compare to each clinic's pre-Medconsults baseline |
| Median time to book | \< 2 min |
| Double-bookings | 0 |
| Doctor weekly active use | ≥ 4 days/week at pilot clinics |

---

## 15. Delivery & Launch Plan

| Sprint | Deliverables |
| --- | --- |
| 1 | Scaffold, env validation, CI, design system, email auth, sessions |
| 2 | Doctor onboarding, clinic profile, admin approval, personal page |
| 3 | Availability engine, slots API, transactional booking |
| 4 | Appointment lifecycle, dashboard (today, walk-in, blocks), dependents |
| 5 | Notes (encrypted), patient CRM, reminder worker, emails, directory search |
| 6 | Hardening, concurrency/security tests, legal review, pilot launch |

**Pilot:** onboard 5–10 clinics in one area, help each set up their schedule and share their link with existing patients, then iterate on dashboard speed and no-show data before opening the directory broadly. Supply of active doctors is the real bottleneck, so doctor onboarding support matters more than any extra feature.

---

## 16. Risks & Open Questions

| Item | Decision / mitigation |
| --- | --- |
| Legal scope for health data | Choose launch geography; legal review pre-launch |
| Licence verification | Manual admin review in v1; consider registry lookup later |
| No-show enforcement strictness | Warn first; make threshold configurable |
| Walk-in handling | Manual blocks + walk-in entry in v1 |
| Reminder effectiveness with email only | Measure; bring SMS/WhatsApp forward if open rates are poor |
| Directory emptiness | Personal links give doctors value regardless of traffic |
| Free-tier hosting limits | Use paid tier for API + worker before pilot |

---

## 17. AI-Assistant Build Prompt (from Blueprint §11)

```
Build "Medconsults" per the attached PRD v2 and Project Blueprint: a single-clinic-per-doctor booking and light CRM web app for in-clinic consultations, pay at clinic.
Frontend: Next.js (App Router) + React + TypeScript + Tailwind with the PRD medical theme. Backend: Node.js + Express + TypeScript + MongoDB (Mongoose). Auth: email/password only.
Before writing any package.json: web search each dependency for latest stable + advisories, confirm with `npm show <pkg> version`, never copy versions from docs, and state what you verified. Re-verify Blueprint code samples against current library docs.
Implement MVP (P0) only. Follow: sessionId.secret refresh sessions with rotation and family revocation; transactional booking with overlap check + unique partial index; UTC appointments and clinic-local schedules; separate worker with atomic job claiming for reminders; AES-256-GCM with key-version prefix for notes; assertOwnership returning 404; timingSafeEqual for secrets; /health and /ready.
Deliver: .env.example (both), root .gitignore, .cursorignore, README + CI, Postman collection/environment, strict tsconfig, endpoint docs per Blueprint §5, and tests for concurrency and reminders.
```