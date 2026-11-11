# Medconsults API Specification & Documentation

> **Base URL:** `http://localhost:5001/api/v1`  
> **Protocol:** REST over HTTP / JSON  
> **Auth:** Bearer JWT in `Authorization` header + `HttpOnly` refresh session cookie  
> **Standard Response Format:**  
> Success: `{ "success": true, "data": <payload> }`  
> Failure: `{ "success": false, "error": { "code": "<ERROR_CODE>", "message": "<Description>", "fields": { ... } } }`

---

## Table of Contents
1. [Master Status & Error Codes Reference](#1-master-status--error-codes-reference)
2. [Core Lifecycle State Machines & Scenarios](#2-core-lifecycle-state-machines--scenarios)
3. [Module 1: Health & Infrastructure](#3-module-1-health--infrastructure)
4. [Module 2: Authentication & Sessions](#4-module-2-authentication--sessions)
5. [Module 3: User Profiles & Dependents](#5-module-3-user-profiles--dependents)
6. [Module 4: Public Directory & Discovery](#6-module-4-public-directory--discovery)
7. [Module 5: Doctor Practice Management & Availability](#7-module-5-doctor-practice-management--availability)
8. [Module 6: Appointments Lifecycle](#8-module-6-appointments-lifecycle)
9. [Module 7: Doctor CRM & Patient Records](#9-module-7-doctor-crm--patient-records)
10. [Module 8: Admin Moderation & Platform Stats](#10-module-8-admin-moderation--platform-stats)

---

## 1. Master Status & Error Codes Reference

### HTTP Status Codes Overview
| Status | Meaning | When Returned in Medconsults |
|---|---|---|
| **`200 OK`** | Request succeeded | Standard for successful `GET`, `PATCH`, `PUT`, `DELETE` operations |
| **`201 Created`** | Resource created | Returned on `POST` for registration, booking, and blocks |
| **`400 Bad Request`** | Client request error | Zod validation failure, invalid date formats, or violating business windows |
| **`401 Unauthorized`** | Authentication missing/invalid | Missing Bearer token, expired access token, or invalid refresh session |
| **`403 Forbidden`** | Insufficient permissions | Role mismatch (e.g., patient calling doctor route), unverified email, or blocked account |
| **`404 Not Found`** | Resource does not exist | Mismatched ID, nonexistent doctor slug, or ownership mismatch |
| **`409 Conflict`** | State collision | Duplicate email, double-booking conflict (`SLOT_TAKEN`), or conflicting schedule block |
| **`429 Too Many Requests`** | Rate limiting / abuse guard | Exceeded auth rate limit, booking throttle, or temporary account lockout |
| **`500 Internal Error`** | Server-side exception | Uncaught server or database connection exceptions |

### Application Error Codes Matrix
| Error Code | HTTP Status | Trigger Scenario | Developer Fix / Client Action |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body, query, or path param failed Zod schema checks. Returns `fields` object. | Inspect `error.fields` and correct input formatting. |
| `INVALID_REQUEST` | 400 | Logically invalid parameters (e.g., end time before start time). | Correct logical values before resending. |
| `OUTSIDE_CANCEL_WINDOW` | 400 | Patient attempts to cancel an appointment inside the doctor's cancellation window (e.g., < 4 hours). | Prompt patient to call the clinic directly. |
| `SLOT_IN_PAST` | 400 | Trying to book or block a timestamp that has already elapsed. | Refetch live open slots from the calendar. |
| `UNAUTHORIZED` | 401 | Missing or malformed `Authorization: Bearer <token>` header. | Send valid Bearer token. |
| `TOKEN_EXPIRED` | 401 | 15-minute access JWT has expired. | Call `POST /api/v1/auth/refresh` to get a fresh access token. |
| `TOKEN_INVALID` | 401 | Token signature verification failed or token is malformed. | Re-authenticate via `POST /api/v1/auth/login`. |
| `INVALID_CREDENTIALS` | 401 | Incorrect email or password combination on login. | Prompt user to check credentials or reset password. |
| `REFRESH_REVOKED` | 401 | Replay attack detected on rotating refresh token. Entire session family invalidated. | Force full user re-login immediately. |
| `FORBIDDEN` | 403 | User role does not match required route guard (e.g., patient accessing `/admin`). | Restrict UI view to authorized role. |
| `EMAIL_NOT_VERIFIED` | 403 | Patient or doctor attempts restricted action before verifying email. | Prompt user to check inbox for verification link. |
| `ACCOUNT_BLOCKED` | 403 | Account has been suspended by a platform administrator. | Display admin contact message. |
| `NOT_FOUND` | 404 | Target resource ID does not exist or belongs to another user (ownership isolation). | Confirm ID exists and belongs to active user. |
| `SLOT_TAKEN` | 409 | Another patient confirmed the slot first (concurrency collision). | Refetch slots and prompt user to pick another time. |
| `EMAIL_ALREADY_EXISTS` | 409 | Attempting to register an email that already exists. | Prompt user to log in or request a password reset. |
| `ACCOUNT_LOCKED` | 429 | Exceeded 5 consecutive failed login attempts from same IP. Locked for 15 minutes. | Show countdown timer until lockout expires. |
| `BOOKING_LIMIT_REACHED` | 429 | Patient already holds max active bookings with this doctor (default: 3). | Prompt patient to wait for visit completion before rebooking. |
| `RATE_LIMIT_EXCEEDED` | 429 | Global IP rate limit exceeded (e.g., > 100 requests / 15 min). | Exponential backoff before retrying. |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled database or system crash. | Check server logs; notify backend team. |

---

## 2. Core Lifecycle State Machines & Scenarios

### 2.1 Appointment Lifecycle
```
           ┌──────────────┐
           │   pending    │ (manual confirmation mode)
           └──────┬───────┘
                  │ Doctor confirms
                  ▼
           ┌──────────────┐
           │  confirmed   │◄── (auto-confirm default)
           └──────┬───────┘
                  │ Patient arrives at clinic
                  ▼
           ┌──────────────┐
           │   arrived    │
           └──────┬───────┘
                  │ Consultation finishes
                  ▼
           ┌──────────────┐
           │  completed   │
           └──────────────┘

Terminal / Branching States:
• [pending / confirmed] ──► cancelled (Patient before cancel window, or Doctor anytime)
• [confirmed]            ──► no_show (Doctor marks after appointment start time)
• [confirmed]            ──► rescheduled (Atomic: original cancelled, new slot reserved)
```

#### Multi-Scenario Handling:
1. **Scenario: Normal In-Clinic Consultation**
   * Patient books → Status: `confirmed`
   * Patient reaches clinic → Doctor/Reception marks `arrived`
   * Doctor concludes consultation → Marks `completed` and writes encrypted notes.
2. **Scenario: Patient Cancels Outside Window**
   * Appointment is in 24 hours (cancellation window is 4h) → Patient calls `PATCH /status` with `cancelled` → Status: `cancelled`, slot is freed immediately, notification email queued.
3. **Scenario: Patient Attempts Late Cancellation**
   * Appointment is in 1 hour (inside 4h window) → API returns `400 OUTSIDE_CANCEL_WINDOW` → UI prompts patient to contact clinic by phone.
4. **Scenario: Doctor Emergency Cancellation**
   * Doctor needs to leave unexpectedly → Calls `PATCH /status` with `cancelled` → Permitted anytime regardless of window → Patient receives immediate notification.
5. **Scenario: Atomic Rescheduling**
   * Patient chooses a new slot → Calls `POST /reschedule` with `newStartAt` → In a single MongoDB transaction: new slot is checked for overlaps, created, and old appointment is marked `rescheduled` with old slot released. If new slot fails, original appointment remains completely untouched.

---

### 2.2 Doctor Onboarding & Approval Lifecycle
```
[draft] ──► [pending_approval] ──► [approved] ──► [suspended]
                 │                      │
                 ▼                      ▼
             [rejected]         (edits licenceNo/specialty)
                                        │
                                        ▼
                                [pending_approval]
```

#### Multi-Scenario Handling:
1. **Scenario: Doctor Registration & Setup**
   * Doctor registers → `DoctorProfile` initialized in `draft` mode.
   * Doctor updates clinic address, fee, slot length, and weekly availability.
   * Doctor clicks "Submit for Approval" → Status transitions to `pending_approval`.
2. **Scenario: Admin Approval**
   * Admin reviews licence number on `GET /api/v1/admin/doctors?status=pending_approval`.
   * Admin approves → Status: `approved`. Doctor profile is immediately listed in the public directory and can accept bookings.
3. **Scenario: Admin Rejection**
   * Admin rejects with reason: "Licence registration could not be verified in state medical council."
   * Status transitions to `rejected`; email notification sent to doctor with guidance.
4. **Scenario: Automatic Re-Review Guard**
   * An approved doctor changes their `licenceNo` or `specialty` in their profile.
   * System automatically reverts profile status to `pending_approval` until admin re-verifies credentials.

---

### 2.3 Session Rotation & Security Lifecycle
```
[Login] ──► Issue Session ID + Secret A (Family 1)
                │
                ▼ (Refresh Call)
[Rotate] ──► Invalidate Secret A, Issue Secret B (Family 1)
                │
                ├── Normal call with Secret B: OK, Issue Secret C
                │
                └── Replay attack! (Attacker sends old Secret A)
                          ▼
            [COMPROMISE DETECTED]
            Revoke entire Family 1!
            All active sessions for this device revoked.
```

---

## 3. Module 1: Health & Infrastructure

### `GET /`
**Description:** API root status probe providing service name and quick links.  
**Auth required:** No  
**Minimum role:** Public  

#### Request
Headers: None  
Body: None  

#### Responses
* **`200 OK`**:
  ```json
  {
    "name": "Medconsults API",
    "status": "running",
    "version": "1.0.0",
    "endpoints": {
      "health": "/health",
      "ready": "/ready",
      "api": "/api/v1",
      "doctors": "/api/v1/doctors"
    }
  }
  ```

---

### `GET /health`
**Description:** Liveness probe for monitoring containers and load balancers.  
**Auth required:** No  

#### Responses
* **`200 OK`**:
  ```json
  { "status": "ok", "uptime": 1284.52 }
  ```

---

### `GET /ready`
**Description:** Readiness probe confirming active MongoDB database connection.  
**Auth required:** No  

#### Responses
* **`200 OK` (Database connected)**:
  ```json
  { "status": "ready", "database": "connected" }
  ```
* **`503 Service Unavailable` (Database disconnected)**:
  ```json
  { "status": "unavailable", "database": "disconnected" }
  ```

---

## 4. Module 2: Authentication & Sessions

### `POST /api/v1/auth/register`
**Description:** Register a new patient or doctor account.  
**Auth required:** No  

#### Request
Headers: `Content-Type: application/json`  
Body:
```json
{
  "email": "user@example.com",       // Required. Valid email format. Lowercased automatically.
  "password": "SecurePassword123!", // Required. Min 8, max 100 characters.
  "role": "patient"                 // Optional. "patient" | "doctor". Default: "patient".
}
```

#### Responses
* **`201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "6af333b22e0c9d7af39f0bce",
        "email": "user@example.com",
        "role": "patient",
        "isEmailVerified": false
      },
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```
  *(Sets `HttpOnly; Secure; SameSite=Lax/Strict` cookie `medconsults_refresh`)*
* **`409 Conflict` (`EMAIL_ALREADY_EXISTS`)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "EMAIL_ALREADY_EXISTS",
      "message": "An account with this email address already exists. Please log in or reset your password."
    }
  }
  ```

---

### `POST /api/v1/auth/login`
**Description:** Authenticate using email and password. Includes 5-attempt brute-force lockout.  
**Auth required:** No  

#### Request
Body:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### Responses
* **`200 OK`**: Returns user profile and 15-minute `accessToken`. Sets refresh cookie.
* **`401 Unauthorized` (`INVALID_CREDENTIALS`)**: Email or password incorrect.
* **`403 Forbidden` (`ACCOUNT_BLOCKED`)**: Account has been suspended by an administrator.
* **`429 Too Many Requests` (`ACCOUNT_LOCKED`)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "ACCOUNT_LOCKED",
      "message": "Too many failed login attempts. Please try again in 14 minutes."
    }
  }
  ```

---

### `POST /api/v1/auth/refresh`
**Description:** Rotate refresh session cookie and issue a new access token.  
**Auth required:** Yes (via `medconsults_refresh` cookie)  

#### Responses
* **`200 OK`**: Returns new `accessToken` and updates the `medconsults_refresh` cookie with rotated secret.
* **`401 Unauthorized` (`REFRESH_REVOKED` / `UNAUTHORIZED`)**: Old token was reused or cookie expired.

---

### `POST /api/v1/auth/logout`
**Description:** Revoke current session in the database and clear the refresh cookie.  
**Auth required:** Yes (via refresh cookie)  

#### Responses
* **`200 OK`**: `{ "success": true, "data": { "message": "Logged out successfully" } }`

---

### `POST /api/v1/auth/verify-email`
**Description:** Verify email address using SHA-256 hashed single-use token sent via email.  
**Auth required:** No  
Body: `{ "token": "<hex_token>" }`  
* **`200 OK`**: Email verified successfully.
* **`400 Bad Request`**: Token expired or invalid.

---

### `POST /api/v1/auth/forgot-password` & `POST /api/v1/auth/reset-password`
**Description:** Request password reset link and submit new password.  
* Generic response given on forgot-password to prevent email enumeration.
* Resetting password automatically revokes **all** active sessions across all devices.

---

## 5. Module 3: User Profiles & Dependents

### `GET /api/v1/users/me` & `PATCH /api/v1/users/me`
**Description:** Retrieve or update currently logged-in user profile (including contact phone).  
**Auth required:** Yes  

#### PATCH Body:
```json
{
  "email": "updated@example.com",     // Optional: valid email
  "phone": "+919988776655"           // Optional: E.164 phone number
}
```

#### Responses
* **`200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "6af333b22e0c9d7af39f0bce",
        "email": "patient@example.com",
        "phone": "+919876543210",
        "role": "patient",
        "isEmailVerified": true
      },
      "doctorProfile": null
    }
  }
  ```

---

### `GET /api/v1/users/me/dependents` & `POST /api/v1/users/me/dependents`
**Description:** Manage patient family members (dependents) for multi-person bookings.  
**Auth required:** Yes (Patient)  

#### POST Body
```json
{
  "name": "Aarav Sharma",
  "dob": "2018-06-15",         // ISO date format YYYY-MM-DD
  "relation": "Child"          // "Child" | "Spouse" | "Parent" | "Other" | "Sibling"
}
```

### `PATCH /api/v1/users/me/dependents/:id`
**Description:** Update family dependent details (name, dob, or relationship).  
**Auth required:** Yes (Patient owner)  

#### PATCH Body:
```json
{
  "name": "Aarav Sharma Jr.",
  "relation": "Other"
}
```

### `DELETE /api/v1/users/me/dependents/:id`
**Description:** Soft-delete family dependent (`isDeleted: true`). Excluded from future booking picker and dependent list.  
**Auth required:** Yes (Patient owner)  
**Response:** `200 OK` with `{ "success": true, "data": { "message": "Family member removed successfully" } }`

---

## 6. Module 4: Public Directory & Discovery

### `GET /api/v1/doctors`
**Description:** Search approved and listed doctors. Text search on name, specialty, and area.  
**Auth required:** No (Public)  
**Query Parameters:**
* `city` (string) — Filter by clinic city (e.g. `Bangalore`)
* `specialty` (string) — Filter by specialty (e.g. `Dentist`)
* `type` (string) — `doctor` or `dentist`
* `search` (string) — Free-text search term
* `page` (number, default: 1)
* `limit` (number, default: 10, max: 50)

#### Response — `200 OK`:
```json
{
  "success": true,
  "data": [
    {
      "id": "6af35f212e0c9d7af39f0bf0",
      "slug": "dr-ananya-roy-4f2a",
      "name": "Dr. Ananya Roy",
      "type": "doctor",
      "specialty": "General Physician",
      "fee": 600,
      "clinic": {
        "name": "Roy Wellness Clinic",
        "city": "Bangalore",
        "area": "Indiranagar"
      }
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
}
```

---

### `GET /api/v1/doctors/by-slug/:slug`
**Description:** Fetch full profile, clinic details, and booking settings for a doctor's personal page.  
**Auth required:** No (Public)  
**Security invariant:** Only returns profiles where `status === 'approved'`. Returns `404` otherwise.

---

### `GET /api/v1/doctors/:id/slots`
**Description:** Real-time computation of available booking slots based on clinic schedule, existing appointments, and blocks.  
**Auth required:** No (Public, rate-limited)  
**Query Parameters:**
* `from` (string, required) — Start date `YYYY-MM-DD`
* `to` (string, required) — End date `YYYY-MM-DD` (max horizon: 30 days)

#### Response — `200 OK`:
```json
{
  "success": true,
  "data": {
    "doctorId": "6af35f212e0c9d7af39f0bf0",
    "timezone": "Asia/Kolkata",
    "slotMinutes": 30,
    "slots": [
      {
        "startAt": "2026-11-20T03:30:00.000Z",
        "endAt": "2026-11-20T04:00:00.000Z",
        "localStart": "09:00",
        "localEnd": "09:30"
      }
    ]
  }
}
```

---

## 7. Module 5: Doctor Practice Management & Availability

### `GET /api/v1/doctor/profile` & `PATCH /api/v1/doctor/profile`
**Description:** View and edit clinic address, consultation fee, slot length, lead time, and booking horizon.  
**Auth required:** Yes  
**Role:** `doctor` only  

#### PATCH Body:
```json
{
  "fee": 700,
  "slotMinutes": 30,
  "leadTimeMin": 120,          // Minimum notice required before a booking (e.g., 2 hours)
  "cancelWindowHours": 4,      // Patient cancellation cutoff window
  "autoConfirm": true,         // true = auto confirm; false = manual doctor review
  "clinic": {
    "name": "Apex Dental Clinic",
    "address": "45 MG Road, Indiranagar",
    "city": "Bangalore",
    "timezone": "Asia/Kolkata"
  }
}
```

---

### `PUT /api/v1/doctor/availability`
**Description:** Set weekly operational hours, shifts, breaks, and holiday exceptions in clinic-local time.  
**Auth required:** Yes (`doctor`)  

#### Body:
```json
{
  "weekly": [
    {
      "day": 1,                                                   // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      "ranges": [{ "start": "09:00", "end": "13:00" }, { "start": "14:00", "end": "18:00" }],
      "breaks": [{ "start": "13:00", "end": "14:00" }]
    }
  ],
  "exceptions": [
    {
      "date": "2026-12-25",                                      // YYYY-MM-DD
      "ranges": [],
      "closed": true,
      "reason": "Christmas Holiday"
    }
  ]
}
```

---

### `POST /api/v1/doctor/blocks`
**Description:** Create a manual schedule block (e.g. emergency, walk-in rush, surgery).  
**Auth required:** Yes (`doctor`)  
Body:
```json
{
  "startAt": "2026-11-20T08:00:00.000Z",
  "endAt": "2026-11-20T11:00:00.000Z",
  "reason": "Emergency surgery"
}
```

---

### `POST /api/v1/doctor/appointments/walkin`
**Description:** Doctor or clinic reception records an offline walk-in patient, immediately blocking the online calendar slot.  
**Auth required:** Yes (`doctor`)  
Body:
```json
{
  "patientName": "Ramesh Kumar (Walk-in)",
  "phone": "+919876501234",
  "startAt": "2026-11-20T05:00:00.000Z",
  "reason": "Acute toothache"
}
```

---

## 8. Module 6: Appointments Lifecycle

### `POST /api/v1/appointments`
**Description:** Book an appointment. Executed inside a MongoDB transaction with overlap checking and unique partial index backing.  
**Auth required:** Yes (`patient`)  
**Precondition:** Email must be verified (`isEmailVerified === true`).  

#### Request Body:
```json
{
  "doctorId": "6af35f212e0c9d7af39f0bf0",
  "startAt": "2026-11-20T04:30:00.000Z", // UTC ISO string matching grid slot
  "patientType": "self",                 // "self" | "dependent"
  "dependentId": null,                   // MongoDB ObjectId if patientType is "dependent"
  "reason": "Routine dental cleaning"    // Optional. Encrypted at rest.
}
```

#### Responses
* **`201 Created`**: Appointment created with status `confirmed` (or `pending` if autoConfirm is false).
* **`403 Forbidden` (`EMAIL_NOT_VERIFIED`)**: Patient must verify email first.
* **`409 Conflict` (`PATIENT_OVERLAP`)**: The current patient already holds another active appointment overlapping this time range.
* **`409 Conflict` (`SLOT_TAKEN`)**: Slot was booked simultaneously by another patient or conflicts with a doctor block. Client should immediately refresh slots.
* **`429 Too Many Requests` (`BOOKING_LIMIT_REACHED`)**: Exceeded maximum concurrent active bookings with this doctor (default: 3).

---

### `PATCH /api/v1/appointments/:id/status`
**Description:** Transition appointment status through lifecycle. Role-restricted per state machine rules.  
**Auth required:** Yes (`patient` or `doctor`)  

#### Transitions Allowed:
* **Patient:** Can only transition `confirmed` / `pending` → `cancelled` (if outside cancellation window).
* **Doctor:** Can transition to `confirmed`, `arrived`, `completed`, `no_show`, or `cancelled` anytime.

#### Body:
```json
{
  "status": "arrived",
  "reason": "Patient at reception desk"
}
```

#### Responses:
* **`200 OK`**: Status updated, transition recorded in `statusHistory`, notification queued.
* **`400 Bad Request` (`OUTSIDE_CANCEL_WINDOW`)**: Patient attempted cancellation inside cancellation cutoff.
* **`404 Not Found`**: Appointment does not exist or user does not own it.

---

### `POST /api/v1/appointments/:id/reschedule`
**Description:** Atomically reschedule appointment to a new open slot in one transaction.  
**Auth required:** Yes (`patient` or `doctor`)  
Body:
```json
{
  "newStartAt": "2026-11-21T05:00:00.000Z",
  "reason": "Patient requested next day slot"
}
```

---

### `PUT /api/v1/appointments/:id/notes`
**Description:** Record private clinical consultation notes for an appointment.  
**Auth required:** Yes  
**Role:** `doctor` only (must be the treating doctor who owns the appointment)  
**Security:** Encrypted at rest using **AES-256-GCM** with key version prefix (`v1:<iv>:<ciphertext>:<tag>`). Admins cannot read consultation notes.  

#### Body:
```json
{
  "notes": "Patient diagnosed with stage 1 gingivitis. Performed ultrasonic scaling. Prescribed chlorhexidine mouthwash twice daily for 7 days."
}
```

---

### `GET /api/v1/appointments/:id/calendar.ics`
**Description:** Download standard RFC 5545 `.ics` iCalendar file with clinic location and appointment time.  
**Auth required:** Yes  
**Response Header:** `Content-Type: text/calendar`  

---

## 9. Module 7: Doctor CRM & Patient Records

### `GET /api/v1/doctor/patients`
**Description:** Search and list all unique patients who have booked or attended appointments with this doctor. Includes visit counts, no-show rates, and last consultation date.  
**Auth required:** Yes (`doctor`)  

---

### `GET /api/v1/doctor/patients/:id`
**Description:** Detailed clinical visit history, past notes, and family dependents for an individual patient.  
**Auth required:** Yes (`doctor`)  

---

## 10. Module 8: Admin Moderation & Platform Stats

### `GET /api/v1/admin/doctors`
**Description:** View doctor verification queue filtered by status (`pending_approval`, `approved`, `rejected`).  
**Auth required:** Yes (`admin`)  

---

### `PATCH /api/v1/admin/doctors/:id/status`
**Description:** Approve, reject, or suspend a doctor account.  
**Auth required:** Yes (`admin`)  
Body:
```json
{
  "status": "approved", // "approved" | "rejected" | "suspended"
  "reason": "Licence verified with state medical register"
}
```

---

### `PATCH /api/v1/admin/users/:id/block`
**Description:** Block or unblock an abusive account across the platform. Revokes active sessions immediately.  
**Auth required:** Yes (`admin`)  
Body:
```json
{
  "isBlocked": true
}
```

---

### `GET /api/v1/admin/stats`
**Description:** Platform-wide counters: total doctors, pending approvals, total patients, total appointments booked this week, and overall completion rate.  
**Auth required:** Yes (`admin`)  

