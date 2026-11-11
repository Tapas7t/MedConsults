# Medconsults API Quick Reference

Base URL: `http://localhost:5001/api/v1`

## 1. Health & Infra
- `GET /` — Root API info and quick links
- `GET /health` — Uptime and liveness probe
- `GET /ready` — Database connection readiness

## 2. Authentication
- `POST /api/v1/auth/register` — Register patient or doctor
- `POST /api/v1/auth/login` — Login, returns accessToken and sets HttpOnly refresh cookie
- `POST /api/v1/auth/refresh` — Rotate refresh session and issue new access token
- `POST /api/v1/auth/logout` — Revoke session and clear cookies
- `POST /api/v1/auth/verify-email` — Verify email via SHA-256 hashed single-use token
- `POST /api/v1/auth/forgot-password` — Request password reset email
- `POST /api/v1/auth/reset-password` — Reset password using token

## 3. Users & Family Dependents
- `GET /api/v1/users/me` — Fetch authenticated user profile
- `PATCH /api/v1/users/me` — Update phone or profile details
- `GET /api/v1/users/me/export` — Download GDPR data export
- `GET /api/v1/users/me/dependents` — List saved family members
- `POST /api/v1/users/me/dependents` — Add family member (name, dob, relation)
- `PATCH /api/v1/users/me/dependents/:id` — Update dependent
- `DELETE /api/v1/users/me/dependents/:id` — Delete dependent

## 4. Public Discovery
- `GET /api/v1/doctors` — Search directory with filters (specialty, city, area, pagination)
- `GET /api/v1/doctors/by-slug/:slug` — Public profile by SEO slug
- `GET /api/v1/doctors/:id/slots?from=&to=` — Real-time computed open slots

## 5. Doctor Practice Management
- `GET /api/v1/doctor/profile` — Doctor's clinic profile and booking settings
- `PATCH /api/v1/doctor/profile` — Update clinic, address, fee, slot length, lead time
- `POST /api/v1/doctor/profile/submit` — Submit profile for admin approval
- `GET /api/v1/doctor/availability` — Weekly schedule and exception dates
- `PUT /api/v1/doctor/availability` — Update weekly shifts and breaks
- `GET /api/v1/doctor/blocks` — List emergency/manual schedule blocks
- `POST /api/v1/doctor/blocks` — Add block time range
- `DELETE /api/v1/doctor/blocks/:id` — Remove schedule block
- `GET /api/v1/doctor/appointments?date=` — Doctor's today queue
- `POST /api/v1/doctor/appointments/walkin` — Add in-clinic walk-in appointment

## 6. Appointments
- `POST /api/v1/appointments` — Book slot (concurrency and overlap protected)
- `GET /api/v1/appointments` — List my appointments
- `GET /api/v1/appointments/:id` — Appointment detail
- `PATCH /api/v1/appointments/:id/status` — Lifecycle transitions (arrived/completed/cancelled/no_show)
- `POST /api/v1/appointments/:id/reschedule` — Atomic reschedule to new slot
- `PUT /api/v1/appointments/:id/notes` — AES-256-GCM encrypted consultation notes
- `GET /api/v1/appointments/:id/calendar.ics` — Download iCalendar file

## 7. Doctor CRM
- `GET /api/v1/doctor/patients` — CRM patient list with visit counters
- `GET /api/v1/doctor/patients/:id` — Full patient history and notes

## 8. Admin Moderation
- `GET /api/v1/admin/doctors` — Verification queue
- `PATCH /api/v1/admin/doctors/:id/status` — Approve or reject doctor
- `GET /api/v1/admin/users` — List platform users
- `PATCH /api/v1/admin/users/:id/block` — Block/unblock user
- `GET /api/v1/admin/stats` — Platform metrics

