import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const tempE2eDbPath = path.join(os.tmpdir(), `lifebridge_e2e_db_${process.pid}_${Date.now()}.json`);
process.env.NODE_ENV = 'test';
process.env.DB_PATH = tempE2eDbPath;

const { createApiApp } = await import('../server/src/app.js');
const { resetDbCache } = await import('../server/src/db/database.js');

const app = createApiApp();

function buildUncompressedPdfBase64(lines: string[]): string {
  const escaped = lines.map((l) => `(${l.replace(/[()\\]/g, (m) => `\\${m}`)}) Tj T*`).join('\n');
  const streamContent = `BT\n/F1 12 Tf\n72 720 Td\n14 TL\n${escaped}\nET`;
  const pdf = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj',
    `4 0 obj << /Length ${Buffer.byteLength(streamContent, 'latin1')} >>\nstream\n${streamContent}\nendstream endobj`,
    'xref',
    '0 5',
    '0000000000 65535 f ',
    'trailer << /Root 1 0 R /Size 5 >>',
    'startxref',
    '0',
    '%%EOF',
  ].join('\n');
  return `data:application/pdf;base64,${Buffer.from(pdf, 'latin1').toString('base64')}`;
}

function buildFlateCompressedPdfBase64(lines: string[]): string {
  const escaped = lines.map((l) => `(${l.replace(/[()\\]/g, (m) => `\\${m}`)}) Tj T*`).join('\n');
  const streamContent = `BT\n/F1 12 Tf\n72 720 Td\n14 TL\n${escaped}\nET`;
  const compressed = zlib.deflateSync(Buffer.from(streamContent, 'latin1'));
  const head = Buffer.from(
    [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj',
      `4 0 obj << /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`,
    ].join('\n'),
    'latin1'
  );
  const tail = Buffer.from('\nendstream endobj\n%%EOF', 'latin1');
  const full = Buffer.concat([head, compressed, tail]);
  return full.toString('base64');
}

async function loginAs(email: string, password = 'LifeBridge@2026'): Promise<{ token: string }> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return { token: res.body.data.token };
}

describe('LifeBridge AI 9-Step End-to-End Organ Coordination Workflow', () => {
  beforeAll(() => {
    resetDbCache();
    if (fs.existsSync(tempE2eDbPath)) {
      fs.unlinkSync(tempE2eDbPath);
    }
  });

  afterAll(() => {
    resetDbCache();
    if (fs.existsSync(tempE2eDbPath)) {
      fs.unlinkSync(tempE2eDbPath);
    }
  });

  let recipientToken = '';
  let donorToken = '';
  let newHospitalId = '';
  let newHospitalToken = '';
  let newOpportunityId = '';
  let firstRecordId = '';
  let secondRecordId = '';

  it('Step 1 & Step 2: Registers new recipient and donor accounts and logs in cleanly', async () => {
    const recReg = await request(app).post('/api/v1/auth/register').send({
      email: 'e2e.recipient@example.org',
      password: 'RecipientPass#2026',
      displayName: 'Karthikeya Reddy',
      role: 'recipient',
      bloodGroup: 'A+',
      organType: 'kidney',
      age: 38,
    });
    expect(recReg.status).toBe(201);
    expect(recReg.body.data.user.role).toBe('recipient');
    expect(recReg.body.data.user.linkedRecipientId).toBeTruthy();

    const donorReg = await request(app).post('/api/v1/auth/register').send({
      email: 'e2e.donor@example.org',
      password: 'DonorPass#2026',
      displayName: 'Meera Krishnan',
      role: 'donor',
      bloodGroup: 'O-',
      organType: 'liver',
      age: 34,
    });
    expect(donorReg.status).toBe(201);
    expect(donorReg.body.data.user.role).toBe('donor');
    expect(donorReg.body.data.user.linkedDonorId).toBeTruthy();

    const recLogin = await loginAs('e2e.recipient@example.org', 'RecipientPass#2026');
    recipientToken = recLogin.token;

    const donorLogin = await loginAs('e2e.donor@example.org', 'DonorPass#2026');
    donorToken = donorLogin.token;

    const boot = await request(app)
      .get('/api/v1/bootstrap')
      .set('Authorization', `Bearer ${recipientToken}`);
    expect(boot.status).toBe(200);
    expect(boot.body.data.recipients).toHaveLength(1);
    expect(boot.body.data.organOpportunities.length).toBeGreaterThanOrEqual(5);
  });

  it('Step 3: Uploads both uncompressed and FlateDecode-compressed medical profile PDFs, extracts compatibility, and rejects invalid files', async () => {
    // Reject non-PDF file
    const badFile = await request(app)
      .post('/api/v1/portal/medical-profile')
      .set('Authorization', `Bearer ${recipientToken}`)
      .send({
        fileName: 'notes.pdf',
        pdfBase64: Buffer.from('Not actually a PDF file').toString('base64'),
      });
    expect(badFile.status).toBe(400);

    // Upload uncompressed PDF for Recipient (updates blood group O+, kidney, HLA, age, urgency)
    const recPdfBase64 = buildUncompressedPdfBase64([
      'Patient Medical Profile Report',
      'Blood Group: O+',
      'Organ Needed: kidney',
      'HLA Typing: A2, A24, B35, B44, DR4, DR11',
      'Age: 39',
      'Urgency Score: 88',
      'Diagnosis: Stage 5 ESRD candidate ready for renal allocation',
    ]);
    const recUpload = await request(app)
      .post('/api/v1/portal/medical-profile')
      .set('Authorization', `Bearer ${recipientToken}`)
      .send({ fileName: 'karthik_renal_profile.pdf', pdfBase64: recPdfBase64 });
    expect(recUpload.status).toBe(201);
    const recProfile = recUpload.body.data.medicalProfile;
    expect(recProfile.compatibility.bloodGroup).toBe('O+');
    expect(recProfile.compatibility.organType).toBe('kidney');
    expect(recProfile.compatibility.tissueHLA).toContain('A2');
    expect(recProfile.compatibility.age).toBe(39);
    expect(recProfile.compatibility.urgencyScore).toBe(88);

    // Verify linked Recipient record was synced
    const recCheck = await request(app)
      .get('/api/v1/recipients')
      .set('Authorization', `Bearer ${recipientToken}`);
    expect(recCheck.status).toBe(200);
    expect(recCheck.body.data.recipients[0].bloodGroup).toBe('O+');
    expect(recCheck.body.data.recipients[0].urgencyScore).toBe(88);

    // Upload FlateDecode-compressed PDF for Donor
    const donorPdfBase64 = buildFlateCompressedPdfBase64([
      'Living Organ Donor Evaluation Summary',
      'Blood Type: O+',
      'Organ Type: kidney',
      'HLA Profile: A2, A24, B35, DR4',
      'Donor Age: 35',
      'Clinical Notes: Cleared for living kidney donation',
    ]);
    const donorUpload = await request(app)
      .post('/api/v1/portal/medical-profile')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ fileName: 'meera_donor_eval.pdf', pdfBase64: donorPdfBase64 });
    expect(donorUpload.status).toBe(201);
    expect(donorUpload.body.data.medicalProfile.compatibility.bloodGroup).toBe('O+');
    expect(donorUpload.body.data.medicalProfile.compatibility.organType).toBe('kidney');
  });

  it('Step 4 & Step 5: Computes matching recommendations with scores and factor breakdowns against approved hospitals only', async () => {
    const recRecs = await request(app)
      .get('/api/v1/portal/recommendations')
      .set('Authorization', `Bearer ${recipientToken}`);
    expect(recRecs.status).toBe(200);
    const items = recRecs.body.data.recommendations;
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items[0].isSuitable).toBe(true);
    expect(items[0].matchingScore).toBeGreaterThan(75);
    expect(items[0].factors).toHaveLength(4);
    expect(items[0].opportunity.organType).toBe('kidney');
    // Unapproved HOSP-05 must never appear
    expect(items.some((r: { opportunity: { hospitalId: string } }) => r.opportunity.hospitalId === 'HOSP-05')).toBe(false);
  });

  it('Step 6 & Step 7: Submits a Case Coordination Record, prevents duplicates, and withdraws eligible submissions cleanly', async () => {
    const submitRes = await request(app)
      .post('/api/v1/portal/coordination-records')
      .set('Authorization', `Bearer ${recipientToken}`)
      .send({
        opportunityId: 'OPP-KID-01',
        notes: 'Uploaded verified PDF profile and ready for crossmatch scheduling.',
      });
    expect(submitRes.status).toBe(201);
    firstRecordId = submitRes.body.data.coordinationRecord.id;
    expect(submitRes.body.data.coordinationRecord.status).toBe('SUBMITTED');
    expect(submitRes.body.data.coordinationRecord.compatibilityScore).toBeGreaterThan(75);

    // Duplicate active submission should return 409
    const dupRes = await request(app)
      .post('/api/v1/portal/coordination-records')
      .set('Authorization', `Bearer ${recipientToken}`)
      .send({
        opportunityId: 'OPP-KID-01',
        notes: 'Duplicate try',
      });
    expect(dupRes.status).toBe(409);

    // Step 7: Track & Withdraw
    const listRes = await request(app)
      .get('/api/v1/portal/coordination-records')
      .set('Authorization', `Bearer ${recipientToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.coordinationRecords).toHaveLength(1);

    const withdrawRes = await request(app)
      .post(`/api/v1/portal/coordination-records/${firstRecordId}/withdraw`)
      .set('Authorization', `Bearer ${recipientToken}`)
      .send({ reason: 'Selecting closer transplant center in Hyderabad.' });
    expect(withdrawRes.status).toBe(200);
    expect(withdrawRes.body.data.coordinationRecord.status).toBe('WITHDRAWN');
  });

  it('Step 8 & Step 9: Blocks unapproved hospital actions (403), Admin approves hospital & manages users, and Approved Hospital completes full cycle', async () => {
    // Hospital registers (PENDING_APPROVAL)
    const hospReg = await request(app).post('/api/v1/hospitals/register').send({
      name: 'Nizamabad Regional Transplant Hub',
      city: 'Nizamabad',
      state: 'Telangana',
      tier: 'TRANSPLANT_CENTER',
      licenseNumber: 'TS-THOTA-2026-999',
      contactEmail: 'hub.admin@nizamabad-transplant.org',
      organsSupported: ['kidney', 'liver'],
      adminDisplayName: 'Dr. Kavitha Nair',
      adminPassword: 'HospitalPass#2026',
    });
    expect(hospReg.status).toBe(201);
    newHospitalId = hospReg.body.data.hospital.id;
    expect(hospReg.body.data.hospital.registrationStatus).toBe('PENDING_APPROVAL');

    const hospLogin = await loginAs('hub.admin@nizamabad-transplant.org', 'HospitalPass#2026');
    newHospitalToken = hospLogin.token;

    // Unapproved hospital cannot post opportunity (403)
    const blockedPost = await request(app)
      .post('/api/v1/hospitals/opportunities')
      .set('Authorization', `Bearer ${newHospitalToken}`)
      .send({
        organType: 'kidney',
        title: 'Blocked Kidney Opportunity',
        bloodGroup: 'O+',
        tissueHLA: 'A2, A24, B35, DR4',
        preservationWindowHours: 24,
        clinicalRequirements: 'Crossmatch required',
      });
    expect(blockedPost.status).toBe(403);

    // Step 9: Admin approves the hospital
    const adminLogin = await loginAs('admin@lifebridge.demo');
    const approveHosp = await request(app)
      .patch(`/api/v1/admin/hospitals/${newHospitalId}/status`)
      .set('Authorization', `Bearer ${adminLogin.token}`)
      .send({ status: 'APPROVED', remarks: 'THOTA license verified' });
    expect(approveHosp.status).toBe(200);
    expect(approveHosp.body.data.hospital.registrationStatus).toBe('APPROVED');

    // Step 8: Now approved hospital posts a new kidney opportunity
    const postOpp = await request(app)
      .post('/api/v1/hospitals/opportunities')
      .set('Authorization', `Bearer ${newHospitalToken}`)
      .send({
        organType: 'kidney',
        title: 'Nizamabad O+ Renal Program Slot',
        bloodGroup: 'O+',
        tissueHLA: 'A2, A24, B35, B44, DR4, DR11',
        preservationWindowHours: 28,
        minUrgencyScore: 70,
        clinicalRequirements: 'O+ ABO compatible candidate with negative crossmatch.',
      });
    expect(postOpp.status).toBe(201);
    newOpportunityId = postOpp.body.data.organOpportunity.id;

    // Recipient sees newly posted opportunity in recommendations and applies
    const recsAfter = await request(app)
      .get('/api/v1/portal/recommendations')
      .set('Authorization', `Bearer ${recipientToken}`);
    expect(recsAfter.status).toBe(200);
    expect(
      recsAfter.body.data.recommendations.some(
        (r: { opportunity: { id: string } }) => r.opportunity.id === newOpportunityId
      )
    ).toBe(true);

    const submitSecond = await request(app)
      .post('/api/v1/portal/coordination-records')
      .set('Authorization', `Bearer ${recipientToken}`)
      .send({
        opportunityId: newOpportunityId,
        notes: 'Submitting medical profile for Nizamabad renal slot.',
      });
    expect(submitSecond.status).toBe(201);
    secondRecordId = submitSecond.body.data.coordinationRecord.id;

    // Approved hospital inspects registered participants + PDF medical profiles
    const participantsRes = await request(app)
      .get('/api/v1/hospitals/participants')
      .set('Authorization', `Bearer ${newHospitalToken}`);
    expect(participantsRes.status).toBe(200);
    expect(participantsRes.body.data.medicalProfiles.length).toBeGreaterThanOrEqual(2);
    expect(participantsRes.body.data.recipients.length).toBeGreaterThanOrEqual(1);

    // Approved hospital updates record -> UNDER_HOSPITAL_REVIEW -> APPROVED
    const reviewRes = await request(app)
      .patch(`/api/v1/hospitals/coordination-records/${secondRecordId}/status`)
      .set('Authorization', `Bearer ${newHospitalToken}`)
      .send({ status: 'UNDER_HOSPITAL_REVIEW', remarks: 'Crossmatch lab initiated' });
    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.data.coordinationRecord.status).toBe('UNDER_HOSPITAL_REVIEW');

    const approveRecRes = await request(app)
      .patch(`/api/v1/hospitals/coordination-records/${secondRecordId}/status`)
      .set('Authorization', `Bearer ${newHospitalToken}`)
      .send({ status: 'APPROVED', remarks: 'Matched and cleared for transplant scheduling' });
    expect(approveRecRes.status).toBe(200);
    expect(approveRecRes.body.data.coordinationRecord.status).toBe('APPROVED');

    // Recipient cannot withdraw an already APPROVED coordination record (409)
    const blockedWithdraw = await request(app)
      .post(`/api/v1/portal/coordination-records/${secondRecordId}/withdraw`)
      .set('Authorization', `Bearer ${recipientToken}`)
      .send({ reason: 'Changed my mind after approval' });
    expect(blockedWithdraw.status).toBe(409);

    // Step 9: Admin manages user account status (suspend + reactivate)
    const usersRes = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminLogin.token}`);
    const e2eDonorUser = usersRes.body.data.users.find(
      (u: { email: string }) => u.email === 'e2e.donor@example.org'
    );
    expect(e2eDonorUser).toBeTruthy();

    const suspRes = await request(app)
      .patch(`/api/v1/admin/users/${e2eDonorUser.id}/status`)
      .set('Authorization', `Bearer ${adminLogin.token}`)
      .send({ status: 'SUSPENDED' });
    expect(suspRes.status).toBe(200);
    expect(suspRes.body.data.user.status).toBe('SUSPENDED');

    const reactivateRes = await request(app)
      .patch(`/api/v1/admin/users/${e2eDonorUser.id}/status`)
      .set('Authorization', `Bearer ${adminLogin.token}`)
      .send({ status: 'ACTIVE' });
    expect(reactivateRes.status).toBe(200);

    // Verify cryptographic HMAC audit chain integrity remains 100% valid across all 9 steps
    const auditVerify = await request(app)
      .get('/api/v1/audit/verify')
      .set('Authorization', `Bearer ${adminLogin.token}`);
    expect(auditVerify.status).toBe(200);
    expect(auditVerify.body.data.verification.isValid).toBe(true);
  });
});
