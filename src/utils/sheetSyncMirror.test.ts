import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBankString,
  resolveAssigneeFromStatus,
  mirrorSheetFormsWithLocal,
} from './sheetSyncMirror.ts';
import { FormDocument } from '../types/index.ts';

const makeLocalForm = (overrides: Partial<FormDocument> = {}): FormDocument => ({
  id: 'local-1',
  sequenceNumber: 1,
  formType: 'FPPB',
  docNumber: 'FPPB-0001/CLX/02/XI/MMXXVI',
  date: '2026-11-02',
  targetDate: '2026-11-05',
  division: 'Services',
  requesterName: 'Hartono Darmawan',
  requesterEmail: 'clx.hartono17@gmail.com',
  requesterRole: 'CSO',
  purpose: 'Pengadaan APD serta Tools Team',
  notes: 'Urgent',
  paymentMethod: 'Bank Transfer',
  bankName: 'BCA',
  bankAccountNo: '8830192831',
  bankAccountName: 'Hartono',
  items: [
    {
      id: 'i-1',
      description: 'Helm Safety',
      qty: 2,
      unit: 'Unit',
      unitPrice: 425000,
      total: 850000,
    },
  ],
  totalAmount: 850000,
  terbilang: 'Delapan Ratus Lima Puluh Ribu Rupiah',
  attachments: [],
  status: 'Pending Approval',
  currentAssigneeRole: 'CSO',
  signatures: {},
  createdAt: '2026-11-02T00:00:00.000Z',
  updatedAt: '2026-11-02T00:00:00.000Z',
  ...overrides,
});

test('parseBankString parses combined bank string cleanly', () => {
  assert.deepEqual(parseBankString('BCA - 8830192831 (a.n Hartono)'), {
    bankName: 'BCA',
    bankAccountNo: '8830192831',
    bankAccountName: 'Hartono',
  });
  assert.deepEqual(parseBankString('-'), {
    bankName: '',
    bankAccountNo: '',
    bankAccountName: '',
  });
});

test('resolveAssigneeFromStatus respects 10M CEO threshold', () => {
  assert.equal(resolveAssigneeFromStatus('Pending Approval', 5_000_000), 'CSO');
  assert.equal(resolveAssigneeFromStatus('Approved by CSO', 5_000_000), 'COO');
  assert.equal(resolveAssigneeFromStatus('Approved by COO', 5_000_000), 'CFO');
  assert.equal(resolveAssigneeFromStatus('Approved by CFO', 10_000_000), 'CFO');
  assert.equal(resolveAssigneeFromStatus('Approved by CFO', 10_000_001), 'CEO');
  assert.equal(resolveAssigneeFromStatus('Fully Approved', 25_000_000), 'CEO');
});

test('mirrorSheetFormsWithLocal removes forms deleted in spreadsheet backend', () => {
  const localForms = [
    makeLocalForm({ id: '1', docNumber: 'FPPB-0001/CLX/02/XI/MMXXVI' }),
    makeLocalForm({ id: '2', docNumber: 'FPPB-0002/CLX/02/XI/MMXXVI', totalAmount: 9_900_000 }),
  ];

  // Simulate user deleting row 1 in Google Sheets so only FPPB-0002 remains
  const sheetForms = [
    {
      docNumber: 'FPPB-0002/CLX/02/XI/MMXXVI',
      formType: 'FPPB' as const,
      purpose: 'Pengadaan Scanner Finance',
      totalAmount: 9_900_000,
      status: 'Pending Approval' as const,
      division: 'Services' as const,
      requesterName: 'Hartono Darmawan',
    },
  ];

  const mirrored = mirrorSheetFormsWithLocal(sheetForms, localForms);
  assert.equal(mirrored.length, 1);
  assert.equal(mirrored[0].docNumber, 'FPPB-0002/CLX/02/XI/MMXXVI');
});

test('mirrorSheetFormsWithLocal returns empty array when spreadsheet is emptied', () => {
  const localForms = [makeLocalForm()];
  const mirrored = mirrorSheetFormsWithLocal([], localForms);
  assert.equal(mirrored.length, 0);
});

test('mirrorSheetFormsWithLocal merges updated sheet values and preserves local items when total matches', () => {
  const localForms = [makeLocalForm()];
  const sheetForms = [
    {
      docNumber: 'FPPB-0001/CLX/02/XI/MMXXVI',
      formType: 'PFB' as any, // legacy label mapped to FPP
      purpose: 'Pengadaan APD Updated',
      totalAmount: 850000,
      status: 'Approved by CSO' as const,
      bankName: 'Mandiri - 1234567890 (a.n PT CLX)',
    },
  ];

  const mirrored = mirrorSheetFormsWithLocal(sheetForms, localForms);
  assert.equal(mirrored.length, 1);
  assert.equal(mirrored[0].formType, 'FPP');
  assert.equal(mirrored[0].purpose, 'Pengadaan APD Updated');
  assert.equal(mirrored[0].currentAssigneeRole, 'COO');
  assert.equal(mirrored[0].bankName, 'Mandiri');
  assert.equal(mirrored[0].bankAccountNo, '1234567890');
  assert.equal(mirrored[0].bankAccountName, 'PT CLX');
  assert.equal(mirrored[0].items.length, 1);
  assert.equal(mirrored[0].items[0].description, 'Helm Safety');
});
