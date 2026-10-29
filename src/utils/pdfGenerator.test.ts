import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOfficialFormPdf, generateMergedPdf } from './pdfGenerator.ts';
import { FormDocument } from '../types/index.ts';

const mockDoc: FormDocument = {
  id: 'test-doc-1',
  docNumber: 'FPU-0001/CLX/29/X/MMXXVI',
  formType: 'FPU',
  sequenceNumber: 1,
  date: '2026-10-29',
  division: 'Finance',
  requesterName: 'Budi Santoso',
  requesterRole: 'Finance Staff',
  requesterEmail: 'budi.santoso@clx.co.id',
  purpose: 'Uang Muka Operasional Pengiriman Kargo Tanjung Priok',
  notes: 'Sesuai SPK No. 9812/OPS/2026',
  paymentMethod: 'Bank Transfer',
  bankName: 'BCA',
  bankAccountNo: '8830192831',
  bankAccountName: 'Budi Santoso',
  items: [
    {
      id: 'i1',
      description: 'Biaya Port Handling & Forklift',
      qty: 1,
      unit: 'Lot',
      unitPrice: 1500000,
      total: 1500000,
    },
  ],
  totalAmount: 1500000,
  terbilang: 'Satu Juta Lima Ratus Ribu Rupiah',
  status: 'Pending Approval',
  currentAssigneeRole: 'CSO',
  signatures: {
    maker: {
      role: 'Staff',
      userName: 'Budi Santoso',
      userTitle: 'Staff Maker',
      signedAt: '2026-10-29T08:00:00Z',
      digitalHash: 'SHA256-BUDI-12345',
    },
  },
  attachments: [],
  createdAt: '2026-10-29T08:00:00Z',
  updatedAt: '2026-10-29T08:00:00Z',
};

test('Generates official form PDF and produces valid PDF bytes', async () => {
  const pdfDoc = await generateOfficialFormPdf(mockDoc);
  const bytes = await pdfDoc.save();

  assert.ok(bytes.length > 1000, 'PDF bytes should be generated');
  // First 4 bytes of any valid PDF is %PDF
  const header = String.fromCharCode(...bytes.subarray(0, 4));
  assert.equal(header, '%PDF');
});

test('generateMergedPdf returns valid PDF with or without attachments', async () => {
  const mergedBytes = await generateMergedPdf(mockDoc);
  assert.ok(mergedBytes.length > 1000);
  const header = String.fromCharCode(...mergedBytes.subarray(0, 4));
  assert.equal(header, '%PDF');
});
