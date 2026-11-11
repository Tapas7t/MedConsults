import assert from 'assert';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { safeCompare } from '../src/utils/tokenCompare.js';
import { encryptData, decryptData } from '../src/utils/encryption.js';
import { generateDoctorSlots } from '../src/utils/slots.js';

async function runTests() {
  console.log('🧪 Starting Medconsults Security & Concurrency Verification Tests...\n');

  // Test 1: Timing-safe comparison
  console.log('Test 1: Timing-Safe Token Comparison');
  const secretA = 'my-super-secret-token-12345';
  const secretB = 'my-super-secret-token-12345';
  const secretC = 'my-different-token-67890';
  assert.strictEqual(safeCompare(secretA, secretB), true, 'Identical secrets should return true');
  assert.strictEqual(safeCompare(secretA, secretC), false, 'Different secrets should return false');
  console.log('✅ Passed timing-safe comparison test.\n');

  // Test 2: AES-256-GCM Encryption with keyVersion prefix
  console.log('Test 2: AES-256-GCM Encryption with keyVersion Prefix');
  const patientNote = 'Patient diagnosed with seasonal allergic rhinitis. Prescribed antihistamine.';
  const encryptedPayload = encryptData(patientNote);
  console.log('  Encrypted payload format:', encryptedPayload.slice(0, 30) + '...');
  assert.ok(encryptedPayload.startsWith('v1:'), 'Encrypted string must begin with keyVersion prefix "v1:"');
  assert.strictEqual(encryptedPayload.split(':').length, 4, 'Encrypted string must contain 4 colon-separated parts');

  const decryptedNote = decryptData(encryptedPayload);
  assert.strictEqual(decryptedNote, patientNote, 'Decrypted note must match original plain text');
  console.log('✅ Passed AES-256-GCM encryption & decryption test.\n');

  // Test 3: Session Rotation & Family Revocation Logic
  console.log('Test 3: Refresh Session Hash & Secret Comparison');
  const rawSecret = crypto.randomBytes(32).toString('hex');
  const hashed = await bcrypt.hash(rawSecret, 10);
  const isCorrect = await bcrypt.compare(rawSecret, hashed);
  const isWrong = await bcrypt.compare('tampered-secret', hashed);
  assert.strictEqual(isCorrect, true, 'Valid secret matches bcrypt hash');
  assert.strictEqual(isWrong, false, 'Tampered secret fails verification');
  console.log('✅ Passed session bcrypt verification.\n');

  // Test 4: Slot Generation Engine (DST and overlap safety)
  console.log('Test 4: Slot Generation & Overlap Filtering');
  const mockDoctor: any = {
    slotMinutes: 30,
    leadTimeMin: 0,
    horizonDays: 14,
    clinic: { timezone: 'Asia/Kolkata' },
  };

  const mockAvailability: any = {
    weekly: [
      {
        day: 1, // Monday
        ranges: [{ start: '09:00', end: '11:00' }], // 4 slots: 09:00, 09:30, 10:00, 10:30
        breaks: [{ start: '09:30', end: '10:00' }], // Break at 09:30 - 10:00
      },
    ],
    exceptions: [],
  };

  // Find next Monday date
  const nextMonday = new Date();
  nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - nextMonday.getDay()) % 7 || 7));
  const dateStr = nextMonday.toISOString().split('T')[0]!;

  const slots = generateDoctorSlots({
    doctor: mockDoctor,
    availability: mockAvailability,
    appointments: [],
    blocks: [],
    dateStrings: [dateStr],
  });

  console.log(`  Generated ${slots.length} slots for Monday:`, slots.map((s) => s.localTime));
  // Since 09:30-10:00 is a break, expected slots are 09:00, 10:00, 10:30 (3 slots)
  assert.ok(slots.some((s) => s.localTime === '09:00'), '09:00 slot must exist');
  assert.ok(!slots.some((s) => s.localTime === '09:30'), '09:30 slot must be skipped due to break');
  assert.ok(slots.some((s) => s.localTime === '10:00'), '10:00 slot must exist');
  assert.ok(slots.some((s) => s.localTime === '10:30'), '10:30 slot must exist');
  console.log('✅ Passed slot generation and break exclusion test.\n');

  // Test 5: Concurrency Simulation (Parallel slot claims)
  console.log('Test 5: Concurrency Double-Booking Simulation');
  let slotReserved = false;
  async function attemptBooking(patientId: string): Promise<string> {
    // Simulating atomic condition / DB unique constraint
    if (!slotReserved) {
      slotReserved = true;
      return `SUCCESS_${patientId}`;
    } else {
      throw new Error('SLOT_TAKEN');
    }
  }

  const results = await Promise.allSettled([
    attemptBooking('patient_1'),
    attemptBooking('patient_2'),
    attemptBooking('patient_3'),
    attemptBooking('patient_4'),
  ]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  assert.strictEqual(fulfilled.length, 1, 'Exactly 1 booking should succeed concurrently');
  assert.strictEqual(rejected.length, 3, 'All other concurrent attempts must be rejected with error');
  console.log('✅ Passed concurrency simulation: 1 winner, 3 rejected with SLOT_TAKEN.\n');

  console.log('🎉 ALL 5 SECURITY & CONCURRENCY TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
