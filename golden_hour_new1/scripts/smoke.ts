import express from 'express';
import cookieParser from 'cookie-parser';
import assert from 'node:assert/strict';
import { db, initDatabase, releaseExpiredHolds } from '../server/db';
import { apiRouter } from '../server/routes';

async function runSmokeTests() {
  initDatabase();

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  // Save initial bed counts for test hospitals so we can restore them cleanly
  const origCriticare = db
    .prepare('SELECT icu_beds FROM hospitals WHERE id = ?')
    .get('hosp-criticare-andheri') as { icu_beds: number };
  const origShagun = db
    .prepare('SELECT icu_beds FROM hospitals WHERE id = ?')
    .get('hosp-shagun') as { icu_beds: number };

  const createdCaseIds: string[] = [];
  const createdAdmissionIds: string[] = [];

  try {
    console.log('[Smoke] 1. Checking hospital count (44 seeded facilities)...');
    const hospCount = (db.prepare('SELECT COUNT(*) as c FROM hospitals').get() as any).c;
    assert.ok(hospCount >= 44, `Expected at least 44 hospitals, got ${hospCount}`);

    console.log('[Smoke] 1b. Deterministic demo nurse account can log in...');
    const demoNurseLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'nurse', username: 'NS-DEMO-027', passcode: '123456', hospitalId: 'hosp-sevenhills' }),
    });
    assert.equal(demoNurseLogin.status, 200, 'Seven Hills demo nurse must be able to log in');

    console.log('[Smoke] 2. Nurse of hosp-sevenhills cannot login as or PATCH beds of hosp-bombay (403)...');
    const mismatchNurseLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'nurse',
        username: 'NS-7H-104',
        passcode: '123456',
        hospitalId: 'hosp-bombay',
      }),
    });
    assert.equal(mismatchNurseLogin.status, 403, 'Nurse login with mismatched hospitalId must return 403');

    const nurseLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'nurse',
        username: 'NS-7H-104',
        passcode: '123456',
        hospitalId: 'hosp-sevenhills',
      }),
    });
    assert.equal(nurseLoginRes.status, 200);
    const nurseData = await nurseLoginRes.json();
    const nurseToken = nurseData.token as string;

    const patchBombayRes = await fetch(`${baseUrl}/hospitals/hosp-bombay/beds`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nurseToken}`,
      },
      body: JSON.stringify({ icu: 99 }),
    });
    assert.equal(
      patchBombayRes.status,
      403,
      'Nurse of hosp-sevenhills must receive 403 when PATCHing beds of hosp-bombay'
    );

    console.log('[Smoke] 3. Two holds on the last ICU bed -> second gets 409...');
    db.prepare('UPDATE hospitals SET icu_beds = 1 WHERE id = ?').run('hosp-criticare-andheri');
    db.prepare('UPDATE hospitals SET icu_beds = 5 WHERE id = ?').run('hosp-shagun');

    // Login Patient 1
    const pat1Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'patient',
        patientName: 'Smoke Patient One',
        relativeName: 'Attendant One',
        phone: '9820111111',
        age: 35,
        gender: 'Male',
        bloodType: 'O+',
        nearestStation: 'Andheri Station',
      }),
    });
    assert.equal(pat1Res.status, 200);
    const pat1 = await pat1Res.json();
    createdAdmissionIds.push(pat1.admissionId);

    // Login Patient 2
    const pat2Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'patient',
        patientName: 'Smoke Patient Two',
        relativeName: 'Attendant Two',
        phone: '9820122222',
        age: 42,
        gender: 'Female',
        bloodType: 'A+',
        nearestStation: 'Andheri Station',
      }),
    });
    assert.equal(pat2Res.status, 200);
    const pat2 = await pat2Res.json();
    createdAdmissionIds.push(pat2.admissionId);

    const quickPatientRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'patient', patientName: 'Quick Intake Patient', relativeName: 'Attendant', phone: '9820133333', bloodType: "Don't know", nearestStation: 'Andheri Station', isQuickIntake: true }),
    });
    assert.equal(quickPatientRes.status, 200, 'Quick intake should allow withheld demographics');
    const quickPatient = await quickPatientRes.json();
    createdAdmissionIds.push(quickPatient.admissionId);
    const quickAdmission = db.prepare('SELECT is_quick_intake FROM admission_records WHERE id = ?').get(quickPatient.admissionId) as any;
    assert.equal(quickAdmission.is_quick_intake, 1, 'Quick intake marker must persist for downstream portals');

    const case1Id = 'SMOKE-CASE-1-' + Date.now();
    const case2Id = 'SMOKE-CASE-2-' + Date.now();
    createdCaseIds.push(case1Id, case2Id);

    // Patient 1 holds the last ICU bed on hosp-criticare-andheri
    const hold1Res = await fetch(`${baseUrl}/emergency/hold`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pat1.token}`,
      },
      body: JSON.stringify({
        caseId: case1Id,
        admissionId: pat1.admissionId,
        hospitalId: 'hosp-criticare-andheri',
        bedBay: 'ICU Bay #01',
        bedType: 'icu',
        insuranceClaimMode: 'Self-Pay / Cash',
      }),
    });
    assert.equal(hold1Res.status, 200, 'First hold on last ICU bed should succeed (200)');

    // Patient 2 attempts to hold ICU bed on hosp-criticare-andheri (now 0 beds)
    const hold2Res = await fetch(`${baseUrl}/emergency/hold`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pat2.token}`,
      },
      body: JSON.stringify({
        caseId: case2Id,
        admissionId: pat2.admissionId,
        hospitalId: 'hosp-criticare-andheri',
        bedBay: 'ICU Bay #02',
        bedType: 'icu',
        insuranceClaimMode: 'Self-Pay / Cash',
      }),
    });
    assert.equal(hold2Res.status, 409, 'Second hold on exhausted ICU bed must return 409 Conflict');

    console.log('[Smoke] 4. Cancel restores the bed...');
    const cancelRes = await fetch(`${baseUrl}/emergency/cancel-hold`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pat1.token}`,
      },
      body: JSON.stringify({ caseId: case1Id }),
    });
    assert.equal(cancelRes.status, 200);

    const criticareAfterCancel = db
      .prepare('SELECT icu_beds FROM hospitals WHERE id = ?')
      .get('hosp-criticare-andheri') as { icu_beds: number };
    assert.equal(criticareAfterCancel.icu_beds, 1, 'Cancelling hold must restore ICU bed count back to 1');

    console.log('[Smoke] 5. Re-hold to another hospital restores the first hospital bed...');
    // Hold again at hosp-criticare-andheri
    const rehold1 = await fetch(`${baseUrl}/emergency/hold`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pat1.token}`,
      },
      body: JSON.stringify({
        caseId: case1Id,
        admissionId: pat1.admissionId,
        hospitalId: 'hosp-criticare-andheri',
        bedBay: 'ICU Bay #01',
        bedType: 'icu',
        insuranceClaimMode: 'Self-Pay / Cash',
      }),
    });
    assert.equal(rehold1.status, 200);
    assert.equal(
      (db.prepare('SELECT icu_beds FROM hospitals WHERE id = ?').get('hosp-criticare-andheri') as any).icu_beds,
      0
    );

    // Re-hold same caseId to hosp-shagun -> must restore hosp-criticare-andheri to 1 and decrement hosp-shagun to 4
    const switchHospRes = await fetch(`${baseUrl}/emergency/hold`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pat1.token}`,
      },
      body: JSON.stringify({
        caseId: case1Id,
        admissionId: pat1.admissionId,
        hospitalId: 'hosp-shagun',
        bedBay: 'ICU Bay #02',
        bedType: 'icu',
        insuranceClaimMode: 'Cashless Insurance / PM-JAY',
      }),
    });
    assert.equal(switchHospRes.status, 200);
    assert.equal(
      (db.prepare('SELECT icu_beds FROM hospitals WHERE id = ?').get('hosp-criticare-andheri') as any).icu_beds,
      1,
      'First hospital bed must be restored when re-holding to another hospital'
    );
    assert.equal(
      (db.prepare('SELECT icu_beds FROM hospitals WHERE id = ?').get('hosp-shagun') as any).icu_beds,
      4,
      'Second hospital bed must be decremented by 1'
    );

    // Calling hold twice for the same case and same hospital must not decrement twice
    const duplicateHoldRes = await fetch(`${baseUrl}/emergency/hold`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pat1.token}`,
      },
      body: JSON.stringify({
        caseId: case1Id,
        admissionId: pat1.admissionId,
        hospitalId: 'hosp-shagun',
        bedBay: 'ICU Bay #02',
        bedType: 'icu',
        insuranceClaimMode: 'Cashless Insurance / PM-JAY',
      }),
    });
    assert.equal(duplicateHoldRes.status, 200);
    assert.equal(
      (db.prepare('SELECT icu_beds FROM hospitals WHERE id = ?').get('hosp-shagun') as any).icu_beds,
      4,
      'Calling hold twice for the same case and hospital must not decrement twice'
    );

    console.log('[Smoke] 6. Hold survives past 120 s once the ambulance advances the stage...');
    const ambLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'ambulance',
        username: 'AMB-108-9192',
        passcode: '9192',
        vehicleNo: 'MH-02-ER-9192',
      }),
    });
    assert.equal(ambLoginRes.status, 200);
    const ambData = await ambLoginRes.json();

    const advanceRes = await fetch(`${baseUrl}/emergency/stage`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ambData.token}`,
      },
      body: JSON.stringify({
        caseId: case1Id,
        stage: 2,
        street: 'Western Express Highway, Andheri East',
        etaMinutes: 3,
      }),
    });
    assert.equal(advanceRes.status, 200);
    const advancedCase = (await advanceRes.json()).data;
    assert.equal(advancedCase.holdStatus, 'confirmed', 'Advancing stage >= 2 must set holdStatus to confirmed');

    const backwardStageRes = await fetch(`${baseUrl}/emergency/stage`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ambData.token}` },
      body: JSON.stringify({ caseId: case1Id, stage: 1 }),
    });
    assert.equal(backwardStageRes.status, 409, 'Dispatch progression must not move backwards');

    // Simulate > 120s elapsed by backdating hold_expires_at in DB and running releaseExpiredHolds()
    const pastIso = new Date(Date.now() - 300 * 1000).toISOString();
    db.prepare('UPDATE emergency_cases SET hold_expires_at = ? WHERE case_id = ?').run(pastIso, case1Id);
    releaseExpiredHolds();

    const activeCheckRes = await fetch(`${baseUrl}/emergency/active?caseId=${encodeURIComponent(case1Id)}`, {
      headers: { Authorization: `Bearer ${pat1.token}` },
    });
    assert.equal(activeCheckRes.status, 200, 'Confirmed hold must survive past 120s expiry window');
    const activeCaseData = (await activeCheckRes.json()).data;
    assert.equal(activeCaseData.holdStatus, 'confirmed');
    assert.equal(
      (db.prepare('SELECT icu_beds FROM hospitals WHERE id = ?').get('hosp-shagun') as any).icu_beds,
      4,
      'Confirmed hold bed must remain reserved past 120s'
    );

    console.log('[Smoke] ALL SMOKE TESTS PASSED SUCCESSFULLY!');
  } finally {
    // Restore original bed counts and clean up smoke records
    if (origCriticare) {
      db.prepare('UPDATE hospitals SET icu_beds = ? WHERE id = ?').run(
        origCriticare.icu_beds,
        'hosp-criticare-andheri'
      );
    }
    if (origShagun) {
      db.prepare('UPDATE hospitals SET icu_beds = ? WHERE id = ?').run(origShagun.icu_beds, 'hosp-shagun');
    }
    for (const cid of createdCaseIds) {
      db.prepare('DELETE FROM emergency_cases WHERE case_id = ?').run(cid);
    }
    for (const aid of createdAdmissionIds) {
      db.prepare('DELETE FROM admission_records WHERE id = ?').run(aid);
    }
    db.prepare("DELETE FROM user_logs WHERE user_and_contact LIKE 'Smoke Patient%'").run();
    server.close();
  }
}

runSmokeTests().catch((err) => {
  console.error('[Smoke] FAILED:', err);
  process.exit(1);
});
