import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearFormDraft,
  DEFAULT_INITIAL_ITEM,
  FormDraftInput,
  getDraftStorageKey,
  hasMeaningfulDraftContent,
  loadFormDraft,
  saveFormDraft,
  StorageLike,
} from './formDraft';

function createMemoryStorage(maxBytes = Infinity): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      if (value.length > maxBytes) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

function makeDraftInput(overrides: Partial<FormDraftInput> = {}): FormDraftInput {
  return {
    userEmail: 'maker@clx.co.id',
    formType: 'FPU',
    selectedDate: '2026-11-15',
    division: 'Finance',
    requesterName: 'Budi Staff',
    requesterRole: 'Staff Finance',
    purpose: '',
    notes: '',
    paymentMethod: 'Bank Transfer',
    bankName: 'BCA (Bank Central Asia)',
    bankAccountNo: '8830192831',
    bankAccountName: 'Budi Staff',
    items: [{ ...DEFAULT_INITIAL_ITEM }],
    attachments: [],
    ...overrides,
  };
}

test('getDraftStorageKey scopes keys cleanly by lowercased user email', () => {
  assert.equal(getDraftStorageKey('User@CLX.co.id'), 'clx_form_draft_v1_user@clx.co.id');
  assert.equal(getDraftStorageKey(''), 'clx_form_draft_v1_guest');
  assert.equal(getDraftStorageKey(null), 'clx_form_draft_v1_guest');
});

test('hasMeaningfulDraftContent distinguishes untouched default form from edited drafts', () => {
  const untouched = makeDraftInput();
  assert.equal(hasMeaningfulDraftContent(untouched), false);

  assert.equal(hasMeaningfulDraftContent(makeDraftInput({ purpose: 'Biaya Kirim Jakarta' })), true);
  assert.equal(hasMeaningfulDraftContent(makeDraftInput({ formType: 'FPPB' })), true);
  assert.equal(hasMeaningfulDraftContent(makeDraftInput({ explicitlySaved: true })), true);
  assert.equal(
    hasMeaningfulDraftContent(
      makeDraftInput({
        items: [{ ...DEFAULT_INITIAL_ITEM, unitPrice: 12345, total: 12345 }],
      })
    ),
    true
  );
});

test('saveFormDraft and loadFormDraft roundtrip preserves unconstrained prices and items per user', () => {
  const storage = createMemoryStorage();
  const res = saveFormDraft(
    makeDraftInput({
      userEmail: 'staff.a@clx.co.id',
      purpose: 'Pembelian alat survey lapangan',
      items: [
        {
          id: 'item-1',
          description: 'Kabel LAN Cat6',
          qty: 3,
          unit: 'Roll',
          unitPrice: 17250,
          total: 51750,
        },
      ],
    }),
    storage
  );

  assert.equal(res.saved, true);
  assert.equal(res.attachmentsStripped, false);

  const loadedA = loadFormDraft('staff.a@clx.co.id', storage);
  assert.ok(loadedA);
  assert.equal(loadedA.purpose, 'Pembelian alat survey lapangan');
  assert.equal(loadedA.items[0].unitPrice, 17250);
  assert.equal(loadedA.items[0].total, 51750);

  // Different user has no draft
  assert.equal(loadFormDraft('staff.b@clx.co.id', storage), null);
});

test('saveFormDraft gracefully strips heavy attachments on QuotaExceededError without losing form text', () => {
  // Small quota: big attachment throws, stripped lite draft fits
  const storage = createMemoryStorage(1200);
  const bigDataUrl = 'data:application/pdf;base64,' + 'A'.repeat(2500);

  const res = saveFormDraft(
    makeDraftInput({
      purpose: 'Pengajuan dengan lampiran besar',
      attachments: [
        {
          id: 'att-1',
          name: 'invoice-besar.pdf',
          size: 2500,
          type: 'application/pdf',
          dataUrl: bigDataUrl,
          uploadedAt: '2026-11-15T10:00:00.000Z',
        },
      ],
    }),
    storage
  );

  assert.equal(res.saved, true);
  assert.equal(res.attachmentsStripped, true);

  const loaded = loadFormDraft('maker@clx.co.id', storage);
  assert.ok(loaded);
  assert.equal(loaded.purpose, 'Pengajuan dengan lampiran besar');
  assert.equal(loaded.attachmentsStripped, true);
  assert.deepEqual(loaded.attachments, []);
});

test('clearFormDraft removes saved draft for the specified user', () => {
  const storage = createMemoryStorage();
  saveFormDraft(makeDraftInput({ purpose: 'Akan dihapus' }), storage);
  assert.ok(loadFormDraft('maker@clx.co.id', storage));

  clearFormDraft('maker@clx.co.id', storage);
  assert.equal(loadFormDraft('maker@clx.co.id', storage), null);
});
