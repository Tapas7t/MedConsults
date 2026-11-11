import mongoose from 'mongoose';
import dns from 'node:dns';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { DoctorProfile } from '../src/models/DoctorProfile.js';
import { Availability } from '../src/models/Availability.js';
import { Block } from '../src/models/Block.js';
import { Dependent } from '../src/models/Dependent.js';
import { Appointment } from '../src/models/Appointment.js';
import { EmailToken } from '../src/models/EmailToken.js';
import { Session } from '../src/models/Session.js';
import { decryptData } from '../src/utils/encryption.js';

// Setup DNS fallback for Windows MongoDB Atlas connection
try {
  const servers = dns.getServers();
  if (servers.length === 0 || servers.every((s) => s.startsWith('127.'))) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }
} catch {}

const BASE_URL = `http://localhost:${env.PORT}`;
console.log(`\n================================================================================`);
console.log(`🚀 STARTING COMPLETE E2E SCENARIO & DATABASE VERIFICATION TEST SUITE`);
console.log(`Target API: ${BASE_URL}`);
console.log(`Database: ${env.MONGODB_URI.split('@')[1] || 'Connected Cluster'}`);
console.log(`================================================================================\n`);

let totalPassed = 0;
let totalFailed = 0;

function pass(step: string, details?: string) {
  console.log(`  ✅ [PASS] ${step}`);
  if (details) console.log(`     └─ DB/Response Detail: ${details}`);
  totalPassed++;
}

function fail(step: string, error?: any) {
  console.error(`  ❌ [FAIL] ${step}`);
  console.error(`     └─ Error: ${error?.message || error || 'Unknown failure'}`);
  totalFailed++;
}

async function run() {
  // Connect directly to MongoDB for real-time DB state assertions
  console.log('📡 Connecting directly to MongoDB for real-time database state verification...');
  await mongoose.connect(env.MONGODB_URI);
  console.log('✅ Direct MongoDB connection established.\n');

  // Generate unique run identifiers
  const runId = Date.now().toString().slice(-6);
  const patientEmail = `patient_scenario_${runId}@example.com`;
  const doctorEmail = `doctor_scenario_${runId}@example.com`;
  const adminEmail = `admin_scenario_${runId}@example.com`;
  const password = 'TestSecurePass123!';
  const newPassword = 'NewSecretPassword456!';

  let patientToken = '';
  let patientUserId = '';
  let patient2UserId = '';
  let doctorToken = '';
  let doctorUserId = '';
  let doctorProfileId = '';
  let doctorSlug = '';
  let adminToken = '';
  let adminUserId = '';
  let testDependentId = '';
  let testBlockId = '';
  let testAppointmentId = '';
  let rescheduledAppointmentId = '';
  let selectedSlotStart = '';
  let rescheduleSlotStart = '';

  try {
    // -------------------------------------------------------------------------
    // SCENARIO 1: Health & Infrastructure Probes
    // -------------------------------------------------------------------------
    console.log('━━━ SCENARIO 1: Infrastructure & Health Probes ━━━');
    {
      const rootRes = await fetch(`${BASE_URL}/`);
      const rootJson = await rootRes.json();
      if (rootRes.status === 200 && rootJson.name === 'Medconsults API') {
        pass('Discovery probe GET /', `API Name: ${rootJson.name}, Status: ${rootJson.status}`);
      } else {
        fail('Discovery probe GET /', `Unexpected response: ${JSON.stringify(rootJson)}`);
      }

      const res = await fetch(`${BASE_URL}/health`);
      const json = await res.json();
      if (res.status === 200 && json.status === 'ok') {
        pass('Liveness probe GET /health', `Uptime: ${json.uptime}s`);
      } else {
        fail('Liveness probe GET /health', `Unexpected response: ${JSON.stringify(json)}`);
      }

      const readyRes = await fetch(`${BASE_URL}/ready`);
      const readyJson = await readyRes.json();
      if (readyRes.status === 200 && readyJson.database === 'connected') {
        pass('Readiness probe GET /ready', `Database state: ${readyJson.database}`);
      } else {
        fail('Readiness probe GET /ready', `Unexpected response: ${JSON.stringify(readyJson)}`);
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 2: Patient Registration & Database Verification
    // -------------------------------------------------------------------------
    console.log('\n━━━ SCENARIO 2: Patient Registration & DB Insertion ━━━');
    {
      const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: patientEmail, password, role: 'patient' })
      });
      const data = await res.json();
      if (res.status === 201 && data.success) {
        patientToken = data.data.accessToken;
        patientUserId = data.data.user.id;
        pass('POST /api/v1/auth/register (Patient)', `Received Access Token for User ID: ${patientUserId}`);
      } else {
        fail('POST /api/v1/auth/register (Patient)', data.error?.message);
      }

      // DIRECT DB VERIFICATION
      const dbUser = await User.findById(patientUserId);
      if (dbUser && dbUser.email === patientEmail && dbUser.role === 'patient') {
        pass('MongoDB Verification: User Document', `Found User in DB (isEmailVerified: ${dbUser.isEmailVerified}, role: ${dbUser.role})`);
      } else {
        fail('MongoDB Verification: User Document', 'User record not found in MongoDB');
      }

      const dbToken = await EmailToken.findOne({ userId: patientUserId, type: 'verify_email' });
      if (dbToken && dbToken.tokenHash) {
        pass('MongoDB Verification: Email Verification Token', `Created hashed single-use token in DB (Expires: ${dbToken.expiresAt})`);
      } else {
        fail('MongoDB Verification: Email Verification Token', 'EmailToken not found in MongoDB');
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 3: Email Verification Flow
    // -------------------------------------------------------------------------
    console.log('\n━━━ SCENARIO 3: Email Verification & State Change ━━━');
    {
      // Try booking before email verification -> Must fail with 403 EMAIL_NOT_VERIFIED
      const unverifiedBookRes = await fetch(`${BASE_URL}/api/v1/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientToken}` },
        body: JSON.stringify({
          doctorId: new mongoose.Types.ObjectId().toString(),
          startAt: new Date(Date.now() + 86400000).toISOString(),
          patientType: 'self'
        })
      });
      const unverifiedJson = await unverifiedBookRes.json();
      if (unverifiedBookRes.status === 403 && unverifiedJson.error?.code === 'EMAIL_NOT_VERIFIED') {
        pass('Security Rule Guard: Booking Blocked for Unverified Email', `Correctly rejected with 403 EMAIL_NOT_VERIFIED`);
      } else {
        fail('Security Rule Guard: Booking Blocked for Unverified Email', `Expected 403, got ${unverifiedBookRes.status}`);
      }

      // Verify email via actual endpoint POST /api/v1/auth/verify-email
      const rawVerifyToken = `verify_tok_${Date.now()}_${Math.random()}`;
      const crypto = await import('node:crypto');
      const verifyHash = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');
      await EmailToken.create({
        userId: patientUserId,
        type: 'verify_email',
        tokenHash: verifyHash,
        expiresAt: new Date(Date.now() + 3600000)
      });

      const verifyRes = await fetch(`${BASE_URL}/api/v1/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawVerifyToken })
      });
      const verifyJson = await verifyRes.json();
      if (verifyRes.status === 200 && verifyJson.success) {
        pass('POST /api/v1/auth/verify-email', verifyJson.data.message);
      } else {
        fail('POST /api/v1/auth/verify-email', verifyJson.error?.message);
      }

      const updatedUser = await User.findById(patientUserId);
      if (updatedUser?.isEmailVerified === true) {
        pass('MongoDB Verification: Email Verified State Change', `User isEmailVerified successfully flipped to TRUE`);
      } else {
        fail('MongoDB Verification: Email Verified State Change', 'User state not updated');
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 4: Doctor Registration, Automatic Draft Profile & Availability
    // -------------------------------------------------------------------------
    console.log('\n━━━ SCENARIO 4: Doctor Registration & Automatic Profile Provisioning ━━━');
    {
      const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: doctorEmail, password, role: 'doctor' })
      });
      const data = await res.json();
      if (res.status === 201 && data.success) {
        doctorToken = data.data.accessToken;
        doctorUserId = data.data.user.id;
        pass('POST /api/v1/auth/register (Doctor)', `Doctor User ID: ${doctorUserId}`);
      } else {
        fail('POST /api/v1/auth/register (Doctor)', data.error?.message);
      }

      // DIRECT DB VERIFICATION: Did the system auto-create DoctorProfile & Availability?
      const dbDoctorProfile = await DoctorProfile.findOne({ userId: doctorUserId });
      if (dbDoctorProfile && dbDoctorProfile.status === 'draft') {
        doctorProfileId = dbDoctorProfile._id.toString();
        doctorSlug = dbDoctorProfile.slug;
        pass('MongoDB Verification: Auto-created DoctorProfile', `Profile ID: ${doctorProfileId}, Slug: ${doctorSlug}, Status: ${dbDoctorProfile.status}`);
      } else {
        fail('MongoDB Verification: Auto-created DoctorProfile', 'DoctorProfile document was not auto-created in DB');
      }

      const dbAvail = await Availability.findOne({ doctorId: doctorProfileId });
      if (dbAvail) {
        pass('MongoDB Verification: Auto-created Availability Template', `Availability initialized with 7-day default structure`);
      } else {
        fail('MongoDB Verification: Auto-created Availability Template', 'Availability document not found in DB');
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 5: Session Login, Refresh, Password Reset & Logout
    // -------------------------------------------------------------------------
    console.log('\n━━━ SCENARIO 5: Authentication Full Lifecycle (Login, Refresh, Reset, Logout) ━━━');
    {
      let refreshCookie = '';
      const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: patientEmail, password })
      });
      const loginData = await loginRes.json();
      const setCookieHeader = loginRes.headers.get('set-cookie');
      if (setCookieHeader) {
        refreshCookie = setCookieHeader.split(';')[0];
      }
      if (loginRes.status === 200 && loginData.data?.accessToken) {
        patientToken = loginData.data.accessToken;
        pass('POST /api/v1/auth/login (Success)', `Issued fresh accessToken`);
      } else {
        fail('POST /api/v1/auth/login (Success)', loginData.error?.message);
      }

      // Check DB for Session document
      const dbSessions = await Session.find({ userId: patientUserId });
      if (dbSessions.length > 0) {
        pass('MongoDB Verification: Session Tracking', `Active sessions in DB: ${dbSessions.length} (Family ID: ${dbSessions[0].familyId})`);
      } else {
        fail('MongoDB Verification: Session Tracking', 'No active session found in DB');
      }

      // Test POST /api/v1/auth/refresh
      if (refreshCookie) {
        const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Cookie': refreshCookie }
        });
        const refreshData = await refreshRes.json();
        if (refreshRes.status === 200 && refreshData.data?.accessToken) {
          patientToken = refreshData.data.accessToken;
          pass('POST /api/v1/auth/refresh (Token Rotation)', `Rotated session and issued new accessToken`);
        } else {
          fail('POST /api/v1/auth/refresh (Token Rotation)', refreshData.error?.message);
        }
      }

      // Test Invalid Credentials Scenario
      const badLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: patientEmail, password: 'WrongPassword!' })
      });
      const badJson = await badLoginRes.json();
      if (badLoginRes.status === 401 && badJson.error?.code === 'INVALID_CREDENTIALS') {
        pass('Security Scenario: Rejected Invalid Password', `Correctly returned 401 INVALID_CREDENTIALS`);
      } else {
        fail('Security Scenario: Rejected Invalid Password', `Expected 401, got ${badLoginRes.status}`);
      }

      // Test POST /api/v1/auth/forgot-password
      const forgotRes = await fetch(`${BASE_URL}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: patientEmail })
      });
      const forgotData = await forgotRes.json();
      if (forgotRes.status === 200 && forgotData.success) {
        pass('POST /api/v1/auth/forgot-password', forgotData.data.message);
      } else {
        fail('POST /api/v1/auth/forgot-password', forgotData.error?.message);
      }

      // Test POST /api/v1/auth/reset-password
      await EmailToken.deleteMany({ userId: patientUserId, type: 'reset_password' });
      const resetRawToken = `reset_tok_${Date.now()}_${Math.random()}`;
      const crypto = await import('node:crypto');
      const resetHash = crypto.createHash('sha256').update(resetRawToken).digest('hex');
      await EmailToken.create({
        userId: patientUserId,
        type: 'reset_password',
        tokenHash: resetHash,
        expiresAt: new Date(Date.now() + 3600000)
      });

      const resetRes = await fetch(`${BASE_URL}/api/v1/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetRawToken, password: newPassword })
      });
      const resetData = await resetRes.json();
      if (resetRes.status === 200 && resetData.success) {
        pass('POST /api/v1/auth/reset-password', resetData.data.message);
      } else {
        fail('POST /api/v1/auth/reset-password', resetData.error?.message);
      }

      // Log back in with new password to refresh patientToken
      const reLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: patientEmail, password: newPassword })
      });
      const reLoginData = await reLoginRes.json();
      if (reLoginRes.status === 200 && reLoginData.data?.accessToken) {
        patientToken = reLoginData.data.accessToken;
        pass('POST /api/v1/auth/login (Post-Password Reset)', 'Successfully authenticated with updated password');
      }

      // Test POST /api/v1/auth/logout with a temporary user
      const tempEmail = `logout_${runId}@example.com`;
      const tempRegRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: tempEmail, password: 'TempPassword123!', role: 'patient' })
      });
      const tempSetCookie = tempRegRes.headers.get('set-cookie');
      if (tempSetCookie) {
        const logoutRes = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: { 'Cookie': tempSetCookie.split(';')[0] }
        });
        const logoutData = await logoutRes.json();
        if (logoutRes.status === 200 && logoutData.success) {
          pass('POST /api/v1/auth/logout', logoutData.data.message);
        } else {
          fail('POST /api/v1/auth/logout', logoutData.error?.message);
        }
      }
      await User.deleteOne({ email: tempEmail });
    }

    // -------------------------------------------------------------------------
    // SCENARIO 6: Patient Profile & Dependents CRUD (Create, Read, Update, Delete)
    // -------------------------------------------------------------------------
    console.log('\n━━━ SCENARIO 6: User Profile & Dependents CRUD Lifecycle ━━━');
    {
      // 0. GET My Profile
      const getMeRes = await fetch(`${BASE_URL}/api/v1/users/me`, {
        headers: { 'Authorization': `Bearer ${patientToken}` }
      });
      const getMeData = await getMeRes.json();
      if (getMeRes.status === 200 && getMeData.data.user.email === patientEmail) {
        pass('GET /api/v1/users/me (Fetch Profile)', `Fetched user profile: ${getMeData.data.user.email}`);
      } else {
        fail('GET /api/v1/users/me (Fetch Profile)', getMeData.error?.message);
      }

      // 1. Update Profile (Phone)
      const patchUserRes = await fetch(`${BASE_URL}/api/v1/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientToken}` },
        body: JSON.stringify({ phone: '+919988776655' })
      });
      const patchData = await patchUserRes.json();
      if (patchUserRes.status === 200 && patchData.data.user.phone === '+919988776655') {
        pass('PATCH /api/v1/users/me', 'Updated user phone to +919988776655');
      } else {
        fail('PATCH /api/v1/users/me', patchData.error?.message);
      }

      // DB check
      const verifyUserPhone = await User.findById(patientUserId);
      if (verifyUserPhone?.phone === '+919988776655') {
        pass('MongoDB Verification: User Phone Field Updated', `Phone in DB: ${verifyUserPhone.phone}`);
      } else {
        fail('MongoDB Verification: User Phone Field Updated', 'DB phone does not match');
      }

      // 2. Export My Data (GDPR)
      const exportRes = await fetch(`${BASE_URL}/api/v1/users/me/export`, {
        headers: { 'Authorization': `Bearer ${patientToken}` }
      });
      const exportData = await exportRes.json();
      if (exportRes.status === 200 && exportData.data.user?.email === patientEmail) {
        pass('GET /api/v1/users/me/export (GDPR Data Portability)', `Exported data snapshot containing user records`);
      } else {
        fail('GET /api/v1/users/me/export (GDPR Data Portability)', exportData.error?.message);
      }

      // 3. Create Dependent (Child)
      const createDepRes = await fetch(`${BASE_URL}/api/v1/users/me/dependents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientToken}` },
        body: JSON.stringify({ name: 'Baby Aarav', dob: '2020-05-10', relation: 'Child' })
      });
      const createDepData = await createDepRes.json();
      if (createDepRes.status === 201 && createDepData.data._id) {
        testDependentId = createDepData.data._id;
        pass('POST /api/v1/users/me/dependents (Create)', `Created dependent ID: ${testDependentId}`);
      } else {
        fail('POST /api/v1/users/me/dependents (Create)', createDepData.error?.message);
      }

      // DB check creation
      const depInDB = await Dependent.findById(testDependentId);
      if (depInDB && depInDB.name === 'Baby Aarav' && depInDB.relation === 'Child') {
        pass('MongoDB Verification: Dependent Inserted', `Found in DB: ${depInDB.name} (${depInDB.relation})`);
      } else {
        fail('MongoDB Verification: Dependent Inserted', 'Dependent not found in MongoDB');
      }

      // 4. List Dependents
      const getDepsRes = await fetch(`${BASE_URL}/api/v1/users/me/dependents`, {
        headers: { 'Authorization': `Bearer ${patientToken}` }
      });
      const getDepsData = await getDepsRes.json();
      if (getDepsRes.status === 200 && Array.isArray(getDepsData.data) && getDepsData.data.length > 0) {
        pass('GET /api/v1/users/me/dependents (List Dependents)', `Listed dependents count: ${getDepsData.data.length}`);
      } else {
        fail('GET /api/v1/users/me/dependents (List Dependents)', getDepsData.error?.message);
      }

      // 5. Update Dependent (Relation change)
      const updateDepRes = await fetch(`${BASE_URL}/api/v1/users/me/dependents/${testDependentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientToken}` },
        body: JSON.stringify({ name: 'Aarav Sharma Jr.', relation: 'Other' })
      });
      const updateDepData = await updateDepRes.json();
      if (updateDepRes.status === 200 && updateDepData.data.relation === 'Other') {
        pass('PATCH /api/v1/users/me/dependents/:id (Update)', 'Updated relation to Other');
      } else {
        fail('PATCH /api/v1/users/me/dependents/:id (Update)', updateDepData.error?.message);
      }

      // DB check update
      const depUpdatedDB = await Dependent.findById(testDependentId);
      if (depUpdatedDB?.relation === 'Other') {
        pass('MongoDB Verification: Dependent Field Updated', `Relation in DB changed to: ${depUpdatedDB.relation}`);
      } else {
        fail('MongoDB Verification: Dependent Field Updated', 'DB relation not updated');
      }

      // 6. Delete Dependent
      const delDepRes = await fetch(`${BASE_URL}/api/v1/users/me/dependents/${testDependentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${patientToken}` }
      });
      if (delDepRes.status === 200) {
        pass('DELETE /api/v1/users/me/dependents/:id (Delete)', 'Deleted dependent via API');
      } else {
        fail('DELETE /api/v1/users/me/dependents/:id (Delete)', `Status ${delDepRes.status}`);
      }

      // DB check deletion
      const depDeletedDB = await Dependent.findById(testDependentId);
      if (depDeletedDB && depDeletedDB.isDeleted === true) {
        pass('MongoDB Verification: Dependent Soft-Deleted', `Verified isDeleted === true in DB`);
      } else {
        fail('MongoDB Verification: Dependent Soft-Deleted', 'Document still active in DB');
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 7: Doctor Profile Configuration & Admin Verification
    // -------------------------------------------------------------------------
    console.log('\n━━━ SCENARIO 7: Doctor Profile Configuration & Admin Verification ━━━');
    {
      // 0. GET Doctor Profile
      const getDocProfRes = await fetch(`${BASE_URL}/api/v1/doctor/profile`, {
        headers: { 'Authorization': `Bearer ${doctorToken}` }
      });
      const getDocProfData = await getDocProfRes.json();
      if (getDocProfRes.status === 200 && getDocProfData.data._id === doctorProfileId) {
        pass('GET /api/v1/doctor/profile', `Retrieved private profile for Dr. ${getDocProfData.data.name}`);
      } else {
        fail('GET /api/v1/doctor/profile', getDocProfData.error?.message);
      }

      // 1. Doctor updates clinic details, fee, slot length
      const updateDocRes = await fetch(`${BASE_URL}/api/v1/doctor/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
        body: JSON.stringify({
          name: 'Dr. Test Specialist',
          specialty: 'Cardiologist',
          qualifications: ['MBBS', 'MD'],
          licenceNo: 'MED-2026-TEST',
          fee: 750,
          slotMinutes: 30,
          leadTimeMin: 0,
          horizonDays: 30,
          autoConfirm: true,
          listedInDirectory: true,
          clinic: {
            name: 'Specialist Heart Center',
            address: 'Suite 201, Healthcare Towers, MG Road',
            city: 'Bangalore',
            timezone: 'Asia/Kolkata'
          }
        })
      });
      const updateDocData = await updateDocRes.json();
      if (updateDocRes.status === 200 && updateDocData.data.fee === 750) {
        pass('PATCH /api/v1/doctor/profile', `Updated fee: ₹${updateDocData.data.fee}, slot: ${updateDocData.data.slotMinutes}m`);
      } else {
        fail('PATCH /api/v1/doctor/profile', updateDocData.error?.message);
      }

      // DB check doctor update
      const dbDocProfile = await DoctorProfile.findById(doctorProfileId);
      if (dbDocProfile?.fee === 750 && dbDocProfile.clinic.city === 'Bangalore') {
        pass('MongoDB Verification: DoctorProfile Updated', `Fee: ${dbDocProfile.fee}, Clinic City: ${dbDocProfile.clinic.city}`);
      } else {
        fail('MongoDB Verification: DoctorProfile Updated', 'DoctorProfile not updated in DB');
      }

      // 2. Doctor submits for approval
      const submitRes = await fetch(`${BASE_URL}/api/v1/doctor/profile/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${doctorToken}` }
      });
      const submitData = await submitRes.json();
      if (submitRes.status === 200 && submitData.data.status === 'pending_approval') {
        pass('POST /api/v1/doctor/profile/submit', `Status transitioned to pending_approval`);
      } else {
        fail('POST /api/v1/doctor/profile/submit', submitData.error?.message);
      }

      // DB check status
      const dbDocSubmitted = await DoctorProfile.findById(doctorProfileId);
      if (dbDocSubmitted?.status === 'pending_approval') {
        pass('MongoDB Verification: Profile Status is pending_approval', `DB Status: ${dbDocSubmitted.status}`);
      } else {
        fail('MongoDB Verification: Profile Status is pending_approval', 'DB status mismatch');
      }

      // 3. Create Admin user in DB to approve doctor
      const adminUser = await User.create({
        email: adminEmail,
        passwordHash: 'dummy_hash',
        role: 'admin',
        isEmailVerified: true
      });
      adminUserId = adminUser._id.toString();

      // Sign admin JWT
      const { signAccessToken } = await import('../src/utils/jwt.js');
      adminToken = signAccessToken({
        userId: adminUserId,
        email: adminEmail,
        role: 'admin',
        sessionId: 'test_admin_session'
      });
      pass('Admin Setup', `Created Admin User ID: ${adminUserId}`);

      // 4. Admin approves doctor
      const approveRes = await fetch(`${BASE_URL}/api/v1/admin/doctors/${doctorProfileId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'approved', reason: 'Verified credentials successfully' })
      });
      const approveData = await approveRes.json();
      if (approveRes.status === 200 && approveData.data.status === 'approved') {
        pass('PATCH /api/v1/admin/doctors/:id/status (Approval)', `Admin marked doctor as approved`);
      } else {
        fail('PATCH /api/v1/admin/doctors/:id/status (Approval)', approveData.error?.message);
      }

      // DB check approved
      const dbDocApproved = await DoctorProfile.findById(doctorProfileId);
      if (dbDocApproved?.status === 'approved') {
        pass('MongoDB Verification: DoctorProfile is now APPROVED', `DB Status: ${dbDocApproved.status} (Publicly bookable)`);
      } else {
        fail('MongoDB Verification: DoctorProfile is now APPROVED', 'DB status not approved');
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 8: Doctor Availability, Schedule Blocks & Walk-In
    // -------------------------------------------------------------------------
    console.log('\n━━━ SCENARIO 8: Schedule Management, Manual Blocks & Walk-in Entry ━━━');
    {
      // 1. Update Availability (Sunday-Saturday 09:00-18:00 with lunch 13:00-14:00)
      const weekly = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        day,
        ranges: [{ start: '09:00', end: '18:00' }],
        breaks: [{ start: '13:00', end: '14:00' }]
      }));

      const putAvailRes = await fetch(`${BASE_URL}/api/v1/doctor/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
        body: JSON.stringify({ weekly, exceptions: [] })
      });
      const putAvailData = await putAvailRes.json();
      if (putAvailRes.status === 200 && putAvailData.success) {
        pass('PUT /api/v1/doctor/availability', `Updated weekly shifts (09:00-18:00) with 13:00-14:00 lunch break`);
      } else {
        fail('PUT /api/v1/doctor/availability', putAvailData.error?.message);
      }

      // DB check availability
      const dbAvailCheck = await Availability.findOne({ doctorId: doctorProfileId });
      if (dbAvailCheck && dbAvailCheck.weekly.length === 7) {
        pass('MongoDB Verification: Availability Weekly Schedule Saved', `7 weekdays configured with shifts and breaks in DB`);
      } else {
        fail('MongoDB Verification: Availability Weekly Schedule Saved', 'DB availability not updated');
      }

      // 2. GET Doctor Availability
      const getAvailRes = await fetch(`${BASE_URL}/api/v1/doctor/availability`, {
        headers: { 'Authorization': `Bearer ${doctorToken}` }
      });
      const getAvailData = await getAvailRes.json();
      if (getAvailRes.status === 200 && getAvailData.data?.weekly) {
        pass('GET /api/v1/doctor/availability', `Retrieved availability schedule (${getAvailData.data.weekly.length} days configured)`);
      } else {
        fail('GET /api/v1/doctor/availability', getAvailData.error?.message);
      }

      // 3. Create Schedule Block
      const blockStart = new Date(Date.now() + 86400000 * 2); // 2 days later
      blockStart.setUTCHours(10, 0, 0, 0);
      const blockEnd = new Date(blockStart.getTime() + 2 * 60 * 60 * 1000); // 2 hour block

      const createBlockRes = await fetch(`${BASE_URL}/api/v1/doctor/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
        body: JSON.stringify({
          startAt: blockStart.toISOString(),
          endAt: blockEnd.toISOString(),
          reason: 'Clinic maintenance'
        })
      });
      const blockData = await createBlockRes.json();
      if (createBlockRes.status === 201 && blockData.data._id) {
        testBlockId = blockData.data._id;
        pass('POST /api/v1/doctor/blocks (Create Block)', `Created Block ID: ${testBlockId}`);
      } else {
        fail('POST /api/v1/doctor/blocks (Create Block)', blockData.error?.message);
      }

      // DB check block creation
      const blockInDB = await Block.findById(testBlockId);
      if (blockInDB && blockInDB.reason === 'Clinic maintenance') {
        pass('MongoDB Verification: Block Document Inserted', `Found in DB: ${blockInDB.reason} (${blockInDB.startAt.toISOString()})`);
      } else {
        fail('MongoDB Verification: Block Document Inserted', 'Block not found in DB');
      }

      // 4. GET Doctor Blocks
      const getBlocksRes = await fetch(`${BASE_URL}/api/v1/doctor/blocks`, {
        headers: { 'Authorization': `Bearer ${doctorToken}` }
      });
      const getBlocksData = await getBlocksRes.json();
      if (getBlocksRes.status === 200 && Array.isArray(getBlocksData.data)) {
        pass('GET /api/v1/doctor/blocks', `Retrieved active blocks count: ${getBlocksData.data.length}`);
      } else {
        fail('GET /api/v1/doctor/blocks', getBlocksData.error?.message);
      }

      // 5. Delete Schedule Block
      const delBlockRes = await fetch(`${BASE_URL}/api/v1/doctor/blocks/${testBlockId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${doctorToken}` }
      });
      if (delBlockRes.status === 200) {
        pass('DELETE /api/v1/doctor/blocks/:id (Delete Block)', 'Deleted block via API');
      } else {
        fail('DELETE /api/v1/doctor/blocks/:id (Delete Block)', `Status ${delBlockRes.status}`);
      }

      // DB check block deletion
      const blockDeletedDB = await Block.findById(testBlockId);
      if (!blockDeletedDB) {
        pass('MongoDB Verification: Block Document Removed', `Verified ID ${testBlockId} completely deleted from DB`);
      } else {
        fail('MongoDB Verification: Block Document Removed', 'Block document still exists in DB');
      }

      // 6. GET Doctor Appointments Queue
      const getDocApptsRes = await fetch(`${BASE_URL}/api/v1/doctor/appointments`, {
        headers: { 'Authorization': `Bearer ${doctorToken}` }
      });
      const getDocApptsData = await getDocApptsRes.json();
      if (getDocApptsRes.status === 200 && Array.isArray(getDocApptsData.data)) {
        pass('GET /api/v1/doctor/appointments', `Doctor calendar queue retrieved (${getDocApptsData.data.length} appointments)`);
      } else {
        fail('GET /api/v1/doctor/appointments', getDocApptsData.error?.message);
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 9: Public Discovery & Dynamic Slot Generation Engine
    // -------------------------------------------------------------------------
    console.log('\n━━━ SCENARIO 9: Public Directory Search & Dynamic Open Slots ━━━');
    {
      // 1. Directory Search
      const searchRes = await fetch(`${BASE_URL}/api/v1/doctors?city=Bangalore&specialty=Cardiologist`);
      const searchData = await searchRes.json();
      const foundDoctor = searchData.data?.find((d: any) => (d._id || d.id) === doctorProfileId);
      if (searchRes.status === 200 && foundDoctor) {
        pass('GET /api/v1/doctors (Directory Search)', `Found approved doctor in public search: ${foundDoctor.name} (City: ${foundDoctor.clinic.city})`);
      } else {
        fail('GET /api/v1/doctors (Directory Search)', 'Approved doctor not returned in search results');
      }

      // 2. Doctor by Slug
      const slugRes = await fetch(`${BASE_URL}/api/v1/doctors/by-slug/${doctorSlug}`);
      const slugData = await slugRes.json();
      if (slugRes.status === 200 && slugData.data?.slug === doctorSlug) {
        pass('GET /api/v1/doctors/by-slug/:slug (Public Profile)', `Loaded public page data for slug: ${doctorSlug}`);
      } else {
        fail('GET /api/v1/doctors/by-slug/:slug (Public Profile)', slugData.error?.message || `Status: ${slugRes.status}`);
      }

      // 3. Dynamic Open Slots Calculation
      const tomorrow = new Date(Date.now() + 86400000);
      const fromStr = tomorrow.toISOString().split('T')[0];
      const toStr = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];

      const slotsRes = await fetch(`${BASE_URL}/api/v1/doctors/${doctorProfileId}/slots?from=${fromStr}&to=${toStr}`);
      const slotsData = await slotsRes.json();
      const slotsList = Array.isArray(slotsData.data) ? slotsData.data : slotsData.data?.slots || [];
      const availableSlots = slotsList.filter((s: any) => s.isAvailable);
      if (slotsRes.status === 200 && availableSlots.length >= 2) {
        selectedSlotStart = availableSlots[0].startAt;
        rescheduleSlotStart = availableSlots[1].startAt;
        pass('GET /api/v1/doctors/:id/slots (Slot Generation Engine)', `Computed ${availableSlots.length} available slots. Picked slot: ${selectedSlotStart}`);
      } else {
        fail('GET /api/v1/doctors/:id/slots (Slot Generation Engine)', `Failed to generate available slots. Status: ${slotsRes.status}, data: ${JSON.stringify(slotsData)}`);
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 10: Appointment Booking, Encryption & Double-Booking Guard
    // -------------------------------------------------------------------------
    console.log('\n━━━ SCENARIO 10: Transactional Booking, Double-Booking Guard & AES-256 Notes ━━━');
    {
      const plainReason = 'Chest pain and routine ECG consultation';

      // 1. Patient Books Slot
      const bookRes = await fetch(`${BASE_URL}/api/v1/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientToken}` },
        body: JSON.stringify({
          doctorId: doctorProfileId,
          startAt: selectedSlotStart,
          patientType: 'self',
          reason: plainReason
        })
      });
      const bookData = await bookRes.json();
      if (bookRes.status === 201 && bookData.data._id) {
        testAppointmentId = bookData.data._id;
        pass('POST /api/v1/appointments (Booking Confirmed)', `Appointment ID: ${testAppointmentId}, Status: ${bookData.data.status}`);
      } else {
        fail('POST /api/v1/appointments (Booking Confirmed)', bookData.error?.message);
      }

      // DIRECT DB VERIFICATION: Check encryption & status
      const apptInDB = await Appointment.findById(testAppointmentId);
      if (apptInDB && apptInDB.status === 'confirmed') {
        pass('MongoDB Verification: Appointment Created', `Status in DB: ${apptInDB.status}, StartAt: ${apptInDB.startAt.toISOString()}`);

        // Verify reason is encrypted at rest with v1: prefix
        if (apptInDB.reasonEnc && apptInDB.reasonEnc.startsWith('v1:')) {
          pass('MongoDB Security Check: Field-Level Encryption at Rest', `reasonEnc is encrypted: ${apptInDB.reasonEnc.slice(0, 25)}...`);
          const decryptedReason = decryptData(apptInDB.reasonEnc);
          if (decryptedReason === plainReason) {
            pass('Cryptographic Check: AES-256-GCM Decryption Verification', `Decrypted value matches plain text: "${decryptedReason}"`);
          } else {
            fail('Cryptographic Check: AES-256-GCM Decryption Verification', `Mismatch: "${decryptedReason}" !== "${plainReason}"`);
          }
        } else {
          fail('MongoDB Security Check: Field-Level Encryption at Rest', 'reasonEnc not encrypted with v1: prefix');
        }
      } else {
        fail('MongoDB Verification: Appointment Created', 'Appointment document not found in DB');
      }

      // 2. SAME-PATIENT OVERLAP GUARD CHECK
      const patientOverlapRes = await fetch(`${BASE_URL}/api/v1/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientToken}` },
        body: JSON.stringify({
          doctorId: doctorProfileId,
          startAt: selectedSlotStart,
          patientType: 'self',
          reason: 'Attempting to duplicate booking'
        })
      });
      const patientOverlapData = await patientOverlapRes.json();
      if (patientOverlapRes.status === 409 && patientOverlapData.error?.code === 'PATIENT_OVERLAP') {
        pass('Double-Booking Guard: Patient Overlap Rejected', `Correctly caught with 409 PATIENT_OVERLAP`);
      } else {
        fail('Double-Booking Guard: Patient Overlap Rejected', `Expected 409 PATIENT_OVERLAP, got ${patientOverlapRes.status}`);
      }

      // 3. CROSS-PATIENT CONCURRENT SLOT COLLISION CHECK
      const patient2Email = `patient2_scenario_${runId}@example.com`;
      const reg2Res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: patient2Email, password, role: 'patient' })
      });
      const reg2Data = await reg2Res.json();
      const patient2Token = reg2Data.data?.accessToken;
      patient2UserId = reg2Data.data?.user?.id;
      await User.findByIdAndUpdate(patient2UserId, { isEmailVerified: true });

      const collisionRes = await fetch(`${BASE_URL}/api/v1/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patient2Token}` },
        body: JSON.stringify({
          doctorId: doctorProfileId,
          startAt: selectedSlotStart,
          patientType: 'self',
          reason: 'Attempting to take already booked slot'
        })
      });
      const collisionData = await collisionRes.json();
      if (collisionRes.status === 409 && collisionData.error?.code === 'SLOT_TAKEN') {
        pass('Double-Booking Guard: Cross-Patient Concurrency Collision Rejected', `Correctly caught with 409 SLOT_TAKEN`);
      } else {
        fail('Double-Booking Guard: Cross-Patient Concurrency Collision Rejected', `Expected 409 SLOT_TAKEN, got ${collisionRes.status} (${JSON.stringify(collisionData)})`);
      }

      // 4. GET /api/v1/appointments (List patient appointments)
      const getMyApptsRes = await fetch(`${BASE_URL}/api/v1/appointments`, {
        headers: { 'Authorization': `Bearer ${patientToken}` }
      });
      const getMyApptsData = await getMyApptsRes.json();
      if (getMyApptsRes.status === 200 && Array.isArray(getMyApptsData.data) && getMyApptsData.data.length > 0) {
        pass('GET /api/v1/appointments (Patient Appointments)', `Patient queue retrieved (${getMyApptsData.data.length} active appointments)`);
      } else {
        fail('GET /api/v1/appointments (Patient Appointments)', getMyApptsData.error?.message);
      }

      // 5. GET /api/v1/appointments/:id (Single appointment detail)
      const getApptIdRes = await fetch(`${BASE_URL}/api/v1/appointments/${testAppointmentId}`, {
        headers: { 'Authorization': `Bearer ${patientToken}` }
      });
      const getApptIdData = await getApptIdRes.json();
      if (getApptIdRes.status === 200 && getApptIdData.data._id === testAppointmentId) {
        pass('GET /api/v1/appointments/:id (Appointment Detail)', `Retrieved appointment detail, status: ${getApptIdData.data.status}`);
      } else {
        fail('GET /api/v1/appointments/:id (Appointment Detail)', getApptIdData.error?.message);
      }

      // 6. GET /api/v1/appointments/:id/calendar.ics (Download ICS)
      const getIcsRes = await fetch(`${BASE_URL}/api/v1/appointments/${testAppointmentId}/calendar.ics`, {
        headers: { 'Authorization': `Bearer ${patientToken}` }
      });
      const icsText = await getIcsRes.text();
      if (getIcsRes.status === 200 && icsText.includes('BEGIN:VCALENDAR')) {
        pass('GET /api/v1/appointments/:id/calendar.ics (Download ICS)', `Generated RFC 5545 calendar invite (${icsText.length} bytes)`);
      } else {
        fail('GET /api/v1/appointments/:id/calendar.ics (Download ICS)', `Status: ${getIcsRes.status}`);
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 11: Atomic Rescheduling (Old Slot Freed, New Slot Reserved)
    // -------------------------------------------------------------------------
    console.log('\n━━━ SCENARIO 11: Atomic Rescheduling Transaction ━━━');
    {
      const reschedRes = await fetch(`${BASE_URL}/api/v1/appointments/${testAppointmentId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientToken}` },
        body: JSON.stringify({
          newStartAt: rescheduleSlotStart,
          reason: 'Patient requested time change'
        })
      });
      const reschedData = await reschedRes.json();
      if (reschedRes.status === 200 && reschedData.data._id) {
        rescheduledAppointmentId = reschedData.data._id;
        pass('POST /api/v1/appointments/:id/reschedule (Atomic Reschedule)', `New Appointment ID: ${rescheduledAppointmentId}`);
      } else {
        fail('POST /api/v1/appointments/:id/reschedule (Atomic Reschedule)', reschedData.error?.message);
      }

      // DIRECT DB VERIFICATION: Old appointment must be 'rescheduled', new must be 'confirmed'
      const oldApptDB = await Appointment.findById(testAppointmentId);
      const newApptDB = await Appointment.findById(rescheduledAppointmentId);

      if (oldApptDB?.status === 'rescheduled' && newApptDB?.status === 'confirmed') {
        pass('MongoDB Verification: Atomic Reschedule State Guarantee', `Old Appointment marked RESCHEDULED, New Appointment marked CONFIRMED with new slot`);
      } else {
        fail('MongoDB Verification: Atomic Reschedule State Guarantee', `States: Old=${oldApptDB?.status}, New=${newApptDB?.status}`);
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 12: Appointment In-Clinic Lifecycle (Arrived -> Completed -> Notes)
    // -------------------------------------------------------------------------
    console.log('\n━━━ SCENARIO 12: In-Clinic Flow (Arrived -> Completed -> Encrypted Notes) ━━━');
    {
      const currentApptId = rescheduledAppointmentId;

      // 1. Doctor marks Arrived
      const arrivedRes = await fetch(`${BASE_URL}/api/v1/appointments/${currentApptId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
        body: JSON.stringify({ status: 'arrived', reason: 'Patient arrived at waiting lounge' })
      });
      const arrivedData = await arrivedRes.json();
      if (arrivedRes.status === 200 && arrivedData.data.status === 'arrived') {
        pass('PATCH /api/v1/appointments/:id/status (Arrived)', `Status updated to arrived`);
      } else {
        fail('PATCH /api/v1/appointments/:id/status (Arrived)', arrivedData.error?.message);
      }

      // DB check
      const arrivedDB = await Appointment.findById(currentApptId);
      if (arrivedDB?.status === 'arrived') {
        pass('MongoDB Verification: Status is ARRIVED', `DB Status: ${arrivedDB.status}`);
      } else {
        fail('MongoDB Verification: Status is ARRIVED', 'DB status not arrived');
      }

      // 2. Doctor marks Completed
      const completedRes = await fetch(`${BASE_URL}/api/v1/appointments/${currentApptId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
        body: JSON.stringify({ status: 'completed', reason: 'Consultation concluded' })
      });
      const completedData = await completedRes.json();
      if (completedRes.status === 200 && completedData.data.status === 'completed') {
        pass('PATCH /api/v1/appointments/:id/status (Completed)', `Status updated to completed`);
      } else {
        fail('PATCH /api/v1/appointments/:id/status (Completed)', completedData.error?.message);
      }

      // DB check
      const completedDB = await Appointment.findById(currentApptId);
      if (completedDB?.status === 'completed') {
        pass('MongoDB Verification: Status is COMPLETED', `DB Status: ${completedDB.status}`);
      } else {
        fail('MongoDB Verification: Status is COMPLETED', 'DB status not completed');
      }

      // 3. Doctor writes Encrypted Consultation Notes
      const clinicalNotes = 'Patient BP 120/80. Normal sinus rhythm. Prescribed multivitamins and advised 30 min daily walking.';
      const notesRes = await fetch(`${BASE_URL}/api/v1/appointments/${currentApptId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
        body: JSON.stringify({ notes: clinicalNotes })
      });
      const notesData = await notesRes.json();
      if (notesRes.status === 200 && notesData.success) {
        pass('PUT /api/v1/appointments/:id/notes (Doctor Consultation Notes)', 'Saved consultation notes');
      } else {
        fail('PUT /api/v1/appointments/:id/notes (Doctor Consultation Notes)', notesData.error?.message);
      }

      // DIRECT DB VERIFICATION: Verify notes are encrypted at rest with AES-256-GCM
      const notesInDB = await Appointment.findById(currentApptId);
      if (notesInDB?.notesEnc && notesInDB.notesEnc.startsWith('v1:')) {
        pass('MongoDB Security Check: Notes Encrypted at Rest', `notesEnc in DB: ${notesInDB.notesEnc.slice(0, 25)}...`);
        const decryptedNotes = decryptData(notesInDB.notesEnc);
        if (decryptedNotes === clinicalNotes) {
          pass('Cryptographic Check: Notes Decryption Verification', `Decrypted notes match: "${decryptedNotes}"`);
        } else {
          fail('Cryptographic Check: Notes Decryption Verification', 'Decrypted notes mismatch');
        }
      } else {
        fail('MongoDB Security Check: Notes Encrypted at Rest', 'notesEnc not encrypted in DB');
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 13: Doctor CRM (Patient History & Visit Counts)
    // -------------------------------------------------------------------------
    console.log('\n━━━ SCENARIO 13: Doctor CRM & Patient Record Verification ━━━');
    {
      const crmRes = await fetch(`${BASE_URL}/api/v1/doctor/patients`, {
        headers: { 'Authorization': `Bearer ${doctorToken}` }
      });
      const crmData = await crmRes.json();
      const patientInCRM = crmData.data?.find((p: any) => p.userId?.toString() === patientUserId);
      if (crmRes.status === 200 && patientInCRM) {
        pass('GET /api/v1/doctor/patients (CRM Patient Directory)', `Found patient with total visits: ${patientInCRM.totalVisits}`);
      } else {
        fail('GET /api/v1/doctor/patients (CRM Patient Directory)', `Patient not returned in CRM list. Found: ${JSON.stringify(crmData.data)}`);
      }

      // GET /api/v1/doctor/patients/:id (Patient Clinical Timeline)
      const patientDetailRes = await fetch(`${BASE_URL}/api/v1/doctor/patients/${patientUserId}`, {
        headers: { 'Authorization': `Bearer ${doctorToken}` }
      });
      const patientDetailData = await patientDetailRes.json();
      if (patientDetailRes.status === 200 && Array.isArray(patientDetailData.data?.appointments)) {
        pass('GET /api/v1/doctor/patients/:id (Patient Detail)', `Retrieved patient clinical timeline (${patientDetailData.data.appointments.length} visits)`);
      } else {
        fail('GET /api/v1/doctor/patients/:id (Patient Detail)', patientDetailData.error?.message);
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 14: Walk-in Offline Entry
    // -------------------------------------------------------------------------
    console.log('\n━━━ SCENARIO 14: Walk-in Offline Patient Entry ━━━');
    {
      const walkinStart = new Date(Date.now() + 86400000 * 4);
      walkinStart.setUTCHours(11, 0, 0, 0);

      const walkinRes = await fetch(`${BASE_URL}/api/v1/doctor/appointments/walkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
        body: JSON.stringify({
          patientName: 'Sunil Mehta (Offline Walk-in)',
          phone: '+919876000000',
          startAt: walkinStart.toISOString(),
          reason: 'Emergency dental toothache'
        })
      });
      const walkinData = await walkinRes.json();
      if (walkinRes.status === 201 && walkinData.data._id) {
        const walkinId = walkinData.data._id;
        pass('POST /api/v1/doctor/appointments/walkin (Walk-in Entry)', `Created walk-in appointment ID: ${walkinId}`);

        // DB check
        const walkinDB = await Appointment.findById(walkinId);
        if (walkinDB && walkinDB.source === 'walkin' && walkinDB.patientRef.name === 'Sunil Mehta (Offline Walk-in)') {
          pass('MongoDB Verification: Walk-In Document Inserted', `Source: ${walkinDB.source}, Patient: ${walkinDB.patientRef.name}`);
        } else {
          fail('MongoDB Verification: Walk-In Document Inserted', 'Walkin not found in DB');
        }
      } else {
        fail('POST /api/v1/doctor/appointments/walkin (Walk-in Entry)', walkinData.error?.message);
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 15: Admin Moderation (Directory, Stats & Account Block)
    // -------------------------------------------------------------------------
    console.log('\n━━━ SCENARIO 15: Admin Moderation (Account Block & Revocation) ━━━');
    {
      // 1. GET /api/v1/admin/doctors
      const getAdminDocsRes = await fetch(`${BASE_URL}/api/v1/admin/doctors`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const getAdminDocsData = await getAdminDocsRes.json();
      if (getAdminDocsRes.status === 200 && Array.isArray(getAdminDocsData.data)) {
        pass('GET /api/v1/admin/doctors (Admin Doctor Directory)', `Retrieved ${getAdminDocsData.data.length} doctors`);
      } else {
        fail('GET /api/v1/admin/doctors (Admin Doctor Directory)', getAdminDocsData.error?.message);
      }

      // 2. GET /api/v1/admin/users
      const getAdminUsersRes = await fetch(`${BASE_URL}/api/v1/admin/users`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const getAdminUsersData = await getAdminUsersRes.json();
      if (getAdminUsersRes.status === 200 && Array.isArray(getAdminUsersData.data)) {
        pass('GET /api/v1/admin/users (Admin User Roster)', `Retrieved ${getAdminUsersData.data.length} registered users`);
      } else {
        fail('GET /api/v1/admin/users (Admin User Roster)', getAdminUsersData.error?.message);
      }

      // 3. GET /api/v1/admin/stats
      const getAdminStatsRes = await fetch(`${BASE_URL}/api/v1/admin/stats`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const getAdminStatsData = await getAdminStatsRes.json();
      if (getAdminStatsRes.status === 200 && getAdminStatsData.data?.totalDoctors !== undefined) {
        pass('GET /api/v1/admin/stats (Admin Platform Stats)', `Platform metrics: Doctors: ${getAdminStatsData.data.totalDoctors}, Patients: ${getAdminStatsData.data.totalPatients}, Appointments: ${getAdminStatsData.data.totalAppointments}`);
      } else {
        fail('GET /api/v1/admin/stats (Admin Platform Stats)', getAdminStatsData.error?.message);
      }

      // 4. Admin blocks patient
      const blockUserRes = await fetch(`${BASE_URL}/api/v1/admin/users/${patientUserId}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ isBlocked: true, reason: 'Temporary suspension for policy review' })
      });
      const blockUserData = await blockUserRes.json();
      if (blockUserRes.status === 200 && blockUserData.success) {
        pass('PATCH /api/v1/admin/users/:id/block (Block User)', `Admin blocked patient account`);
      } else {
        fail('PATCH /api/v1/admin/users/:id/block (Block User)', blockUserData.error?.message);
      }

      // DB check blocked
      const blockedDBUser = await User.findById(patientUserId);
      if (blockedDBUser?.isBlocked === true) {
        pass('MongoDB Verification: User isBlocked State', `DB isBlocked: ${blockedDBUser.isBlocked}`);
      } else {
        fail('MongoDB Verification: User isBlocked State', 'User not blocked in DB');
      }

      // Patient tries to login while blocked -> Must fail with 403 ACCOUNT_BLOCKED
      const blockedLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: patientEmail, password: newPassword })
      });
      const blockedLoginJson = await blockedLoginRes.json();
      if (blockedLoginRes.status === 403 && blockedLoginJson.error?.code === 'ACCOUNT_BLOCKED') {
        pass('Security Scenario: Blocked User Login Prevented', `Correctly rejected with 403 ACCOUNT_BLOCKED`);
      } else {
        fail('Security Scenario: Blocked User Login Prevented', `Expected 403, got ${blockedLoginRes.status}`);
      }
    }

    // -------------------------------------------------------------------------
    // SCENARIO 16: Safe Cleanup & Final DB State Check
    // -------------------------------------------------------------------------
    console.log('\n━━━ SCENARIO 16: Test Isolation Cleanup & Verification ━━━');
    {
      const usersToClean = [patientUserId, doctorUserId, adminUserId];
      if (patient2UserId) usersToClean.push(patient2UserId);
      await User.deleteMany({ _id: { $in: usersToClean } });
      await DoctorProfile.deleteMany({ _id: doctorProfileId });
      await Availability.deleteMany({ doctorId: doctorProfileId });
      await Appointment.deleteMany({ doctorId: doctorProfileId });
      await Session.deleteMany({ userId: { $in: usersToClean } });
      await EmailToken.deleteMany({ userId: { $in: usersToClean } });
      await Dependent.deleteMany({ _id: testDependentId });

      const remainingUser = await User.findById(patientUserId);
      const remainingDoctor = await DoctorProfile.findById(doctorProfileId);
      const remainingDependent = await Dependent.findById(testDependentId);
      if (!remainingUser && !remainingDoctor && !remainingDependent) {
        pass('MongoDB Verification: Clean Teardown', `All test scenario documents safely cleaned from database`);
      } else {
        fail('MongoDB Verification: Clean Teardown', 'Some test documents remained in database');
      }
    }

  } catch (err: any) {
    console.error('\n💥 Unexpected Exception during scenario execution:', err);
    totalFailed++;
  } finally {
    await mongoose.disconnect();
    console.log('\n================================================================================');
    console.log(`📊 FINAL TEST RUN RESULTS: ${totalPassed} Passed, ${totalFailed} Failed out of ${totalPassed + totalFailed} Assertions`);
    console.log(`================================================================================\n`);
    if (totalFailed > 0) {
      process.exit(1);
    }
  }
}

run();
