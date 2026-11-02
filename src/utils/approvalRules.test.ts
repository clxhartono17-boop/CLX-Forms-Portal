import test from 'node:test';
import assert from 'node:assert/strict';
import { requiresCeoApproval, getNextApprovalStep, CEO_APPROVAL_THRESHOLD } from './approvalRules.ts';
import { generateDocNumber, toRoman } from './romanNumerals.ts';
import { getDriveFolderPath, getMonthNameEnglish } from './googleIntegration.ts';
import { FormDocument } from '../types/index.ts';

test('CEO approval threshold is strictly > Rp 10 Juta', () => {
  assert.equal(CEO_APPROVAL_THRESHOLD, 10_000_000);
  assert.equal(requiresCeoApproval(5_000_000), false);
  assert.equal(requiresCeoApproval(10_000_000), false);
  assert.equal(requiresCeoApproval(10_000_001), true);
  assert.equal(requiresCeoApproval(25_000_000), true);
});

test('Approval workflow: <= 10 Juta completes at CFO', () => {
  const stepCso = getNextApprovalStep('CSO', 7_500_000);
  assert.equal(stepCso.nextAssigneeRole, 'COO');
  assert.equal(stepCso.isFullyApproved, false);

  const stepCoo = getNextApprovalStep('COO', 7_500_000);
  assert.equal(stepCoo.nextAssigneeRole, 'CFO');
  assert.equal(stepCoo.isFullyApproved, false);

  const stepCfo = getNextApprovalStep('CFO', 7_500_000);
  assert.equal(stepCfo.nextStatus, 'Fully Approved');
  assert.equal(stepCfo.isFullyApproved, true);
  assert.equal(stepCfo.requiresCeo, false);
});

test('Approval workflow: > 10 Juta requires CEO final approval', () => {
  const stepCfo = getNextApprovalStep('CFO', 15_000_000);
  assert.equal(stepCfo.nextStatus, 'Approved by CFO');
  assert.equal(stepCfo.nextAssigneeRole, 'CEO');
  assert.equal(stepCfo.isFullyApproved, false);
  assert.equal(stepCfo.requiresCeo, true);

  const stepCeo = getNextApprovalStep('CEO', 15_000_000);
  assert.equal(stepCeo.nextStatus, 'Fully Approved');
  assert.equal(stepCeo.isFullyApproved, true);
});

test('Roman numerals conversion and official doc number format', () => {
  assert.equal(toRoman(10), 'X');
  assert.equal(toRoman(2026), 'MMXXVI');

  const testDate = new Date(2026, 9, 29); // 29 October 2026
  const docNumFpu = generateDocNumber('FPU', 1, testDate);
  assert.equal(docNumFpu, 'FPU-0001/CLX/29/X/MMXXVI');

  const docNumFpp = generateDocNumber('FPP', 2, testDate);
  assert.equal(docNumFpp, 'FPP-0002/CLX/29/X/MMXXVI');
});

test('Drive folder path structure matches [NAMA_FORM] / [BULAN] / [TANGGAL] / [NOMOR_FORM]', () => {
  const sampleDoc: FormDocument = {
    id: 'test-1',
    docNumber: 'FPU-0001/CLX/29/X/MMXXVI',
    formType: 'FPU',
    sequenceNumber: 1,
    date: '2026-10-29',
    division: 'Finance',
    requesterName: 'Budi Santoso',
    requesterRole: 'Staff',
    requesterEmail: 'budi@clx.co.id',
    purpose: 'Test purpose',
    paymentMethod: 'Bank Transfer',
    items: [],
    totalAmount: 5000000,
    terbilang: 'Lima Juta Rupiah',
    status: 'Pending Approval',
    currentAssigneeRole: 'CSO',
    signatures: {},
    attachments: [],
    createdAt: '2026-10-29T00:00:00Z',
    updatedAt: '2026-10-29T00:00:00Z',
  };

  const folder = getDriveFolderPath(sampleDoc);
  assert.equal(folder.formName, 'FPU');
  assert.equal(folder.monthName, 'October');
  assert.equal(folder.shortDocNum, 'FPU-0001');
  assert.equal(folder.fullPath, 'FPU / October / 29 / FPU-0001');
});

test('formatFormRow produces exact 19 columns aligned with user Google Sheet Row 8 headers', async () => {
  const { formatFormRow } = await import('./googleWorkspace.ts');
  const sampleDoc: FormDocument = {
    id: 'test-2',
    docNumber: 'FPP-0001/CLX/02/XI/MMXXVI',
    formType: 'FPP',
    sequenceNumber: 1,
    date: '2026-11-02',
    division: 'Finance',
    requesterName: 'Hartono Darmawan',
    requesterRole: 'CSO',
    requesterEmail: 'hartono@clx.co.id',
    purpose: 'Biaya BBM Solar & Toll Operasional Armada',
    paymentMethod: 'Bank Transfer',
    bankName: 'BCA',
    bankAccountNo: '8830192831',
    bankAccountName: 'Hartono Darmawan',
    items: [],
    totalAmount: 2500000,
    terbilang: 'Dua Juta Lima Ratus Ribu Rupiah',
    status: 'Pending Approval',
    currentAssigneeRole: 'CSO',
    signatures: {},
    attachments: [],
    createdAt: '2026-11-02T00:00:00Z',
    updatedAt: '2026-11-02T00:00:00Z',
  };

  const row = formatFormRow(sampleDoc, 1);
  // Must match exactly the 19 columns of Row 8 in Rekap Form CLX
  assert.equal(row.length, 19);
  assert.equal(row[0], 1); // No
  assert.equal(row[1], 'FPP'); // Jenis Form
  assert.equal(row[2], 'FPP-0001/CLX/02/XI/MMXXVI'); // No. Formulir
  assert.equal(row[3], '2026-11-02'); // Tgl Pengajuan
  assert.equal(row[4], '2026-11-02'); // Tgl Dibutuhkan
  assert.equal(row[5], 'Finance'); // Divisi / Dept
  assert.equal(row[6], 'Hartono Darmawan'); // Pemohon (Requestor)
  assert.equal(row[7], 'Biaya BBM Solar & Toll Operasional Armada'); // Keperluan
  assert.equal(row[8], 2500000); // DPP
  assert.equal(row[9], 0); // Pajak
  assert.equal(row[10], 2500000); // Total Nilai
  assert.equal(row[11], 'Bank Transfer'); // Metode Pembayaran
  assert.ok(row[12].includes('BCA')); // Bank info
  assert.equal(row[14], 'Maker -> CSO -> COO -> CFO (Selesai di CFO)'); // Level Otorisasi
  assert.equal(row[15], 'Pending Approval'); // Status Otorisasi
});

