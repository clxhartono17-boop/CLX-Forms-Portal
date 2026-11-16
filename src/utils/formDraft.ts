import { Division, FormAttachment, FormItem, FormType } from '../types/index.ts';

export const DRAFT_STORAGE_PREFIX = 'clx_form_draft_v1_';

export const DEFAULT_INITIAL_ITEM: FormItem = {
  id: 'item-1',
  description: 'Biaya Port Handling & Forklift Pelabuhan Tanjung Priok',
  qty: 1,
  unit: 'Lot',
  unitPrice: 1500000,
  total: 1500000,
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface FormDraftPayload {
  version: 1;
  savedAt: string;
  userEmail: string;
  formType: FormType;
  selectedDate: string;
  division: Division;
  requesterName: string;
  requesterRole: string;
  purpose: string;
  notes: string;
  paymentMethod: 'Bank Transfer' | 'Cash' | 'Giro / Cheque';
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  items: FormItem[];
  attachments: FormAttachment[];
  attachmentsStripped?: boolean;
  explicitlySaved?: boolean;
}

export type FormDraftInput = Omit<FormDraftPayload, 'version' | 'savedAt'>;

export interface SaveDraftResult {
  saved: boolean;
  savedAt: string;
  attachmentsStripped: boolean;
  error?: string;
}

function getDefaultStorage(): StorageLike | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

export function getDraftStorageKey(email?: string | null): string {
  const normalized = (email || 'guest').trim().toLowerCase() || 'guest';
  return `${DRAFT_STORAGE_PREFIX}${normalized}`;
}

export function hasMeaningfulDraftContent(draft: Partial<FormDraftPayload> | null | undefined): boolean {
  if (!draft) return false;
  if (draft.explicitlySaved) return true;
  if (draft.purpose && draft.purpose.trim().length > 0) return true;
  if (draft.notes && draft.notes.trim().length > 0) return true;
  if (draft.attachments && draft.attachments.length > 0) return true;
  if (draft.formType && draft.formType !== 'FPU') return true;
  if (draft.paymentMethod && draft.paymentMethod !== 'Bank Transfer') return true;
  if (draft.bankName && draft.bankName !== 'BCA (Bank Central Asia)') return true;
  if (draft.bankAccountNo && draft.bankAccountNo !== '8830192831') return true;

  const items = draft.items || [];
  if (items.length > 1) return true;
  if (items.length === 1) {
    const first = items[0];
    if (
      first.description !== DEFAULT_INITIAL_ITEM.description ||
      Number(first.qty) !== DEFAULT_INITIAL_ITEM.qty ||
      first.unit !== DEFAULT_INITIAL_ITEM.unit ||
      Number(first.unitPrice) !== DEFAULT_INITIAL_ITEM.unitPrice
    ) {
      return true;
    }
  }

  return false;
}

export function saveFormDraft(
  input: FormDraftInput,
  storage: StorageLike | null = getDefaultStorage()
): SaveDraftResult {
  const savedAt = new Date().toISOString();
  if (!storage) {
    return { saved: false, savedAt, attachmentsStripped: false, error: 'Storage tidak tersedia' };
  }

  const key = getDraftStorageKey(input.userEmail);
  const fullPayload: FormDraftPayload = {
    ...input,
    version: 1,
    savedAt,
    attachmentsStripped: false,
  };

  try {
    storage.setItem(key, JSON.stringify(fullPayload));
    return { saved: true, savedAt, attachmentsStripped: false };
  } catch (err) {
    // Retry without heavy attachment dataUrls if storage quota exceeded
    try {
      const litePayload: FormDraftPayload = {
        ...fullPayload,
        attachments: [],
        attachmentsStripped: (input.attachments?.length || 0) > 0,
      };
      storage.setItem(key, JSON.stringify(litePayload));
      return {
        saved: true,
        savedAt,
        attachmentsStripped: (input.attachments?.length || 0) > 0,
      };
    } catch (fallbackErr: any) {
      return {
        saved: false,
        savedAt,
        attachmentsStripped: false,
        error: fallbackErr?.message || (err as Error)?.message || 'Gagal menyimpan draft lokal',
      };
    }
  }
}

export function loadFormDraft(
  email?: string | null,
  storage: StorageLike | null = getDefaultStorage()
): FormDraftPayload | null {
  if (!storage) return null;
  const key = getDraftStorageKey(email);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FormDraftPayload;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.items)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearFormDraft(
  email?: string | null,
  storage: StorageLike | null = getDefaultStorage()
): void {
  if (!storage) return;
  try {
    storage.removeItem(getDraftStorageKey(email));
  } catch {
    // Ignore storage removal errors
  }
}
