import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { FormDocument, FormType, UserRole, DigitalStamp } from '../types/index.ts';
import { INITIAL_FORMS } from '../data/mockData.ts';
import { syncToGoogleDrive, syncToGoogleSheets } from '../utils/googleIntegration.ts';
import { generateMergedPdf } from '../utils/pdfGenerator.ts';
import { getNextApprovalStep } from '../utils/approvalRules.ts';
import {
  reconcileFormsWithPendingCreations,
  sanitizeFormForWebhook,
} from '../utils/sheetSyncMirror.ts';
import {
  getGoogleAccessToken,
  autoSyncFormToGoogleSheet,
  autoSyncStatusToGoogleSheet,
  fetchFormsFromAppsScriptWebhook,
  autoUpdateFormInGoogleSheet,
  autoDeleteFormInGoogleSheet,
  isAutoSyncConfigured,
  syncWebhookConfigWithServer,
  hasServerSyncCapability,
} from '../utils/googleWorkspace.ts';

interface FormContextType {
  forms: FormDocument[];
  isLoadingFromSheet: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  refreshFromGoogleSheet: () => Promise<number>;
  addForm: (doc: FormDocument) => Promise<FormDocument>;
  updateForm: (doc: FormDocument) => void;
  deleteForm: (id: string) => void;
  getNextSequence: (type: FormType) => number;
  approveForm: (id: string, user: { role: UserRole; name: string; title: string; signatureUrl?: string }) => Promise<void>;
  rejectForm: (id: string, reason: string, user: { role: UserRole; name: string }) => Promise<void>;
  getPendingApprovalsForRole: (role: UserRole) => FormDocument[];
  pendingCountForUser: (role: UserRole) => number;
  syncDrive: (id: string) => Promise<void>;
  syncSheets: (id: string) => Promise<void>;
  resetToDefault: () => void;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

// Updated storage key to purge previous dummy records and use purely real data
const STORAGE_KEY = 'clx_real_forms_v2';
const PENDING_GRACE_MS = 15000;

export const FormProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [forms, setForms] = useState<FormDocument[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse localStorage forms:', e);
    }
    return INITIAL_FORMS;
  });

  const [isLoadingFromSheet, setIsLoadingFromSheet] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Protects newly created / edited docs during the brief Google Sheet propagation window
  const pendingDocNumbersRef = useRef<Map<string, number>>(new Map());

  const markPendingDoc = (docNumber?: string) => {
    const key = (docNumber || '').trim().toLowerCase();
    if (!key) return;
    pendingDocNumbersRef.current.set(key, Date.now() + PENDING_GRACE_MS);
  };

  const getActivePendingSet = (): Set<string> => {
    const now = Date.now();
    const active = new Set<string>();
    for (const [key, expiresAt] of pendingDocNumbersRef.current.entries()) {
      if (expiresAt > now) {
        active.add(key);
      } else {
        pendingDocNumbersRef.current.delete(key);
      }
    }
    return active;
  };

  const hasAnySyncChannel = (): boolean => {
    return isAutoSyncConfigured() || Boolean(getGoogleAccessToken());
  };

  const refreshFromGoogleSheet = async (force = false): Promise<number> => {
    if (!force && !hasAnySyncChannel()) return forms.length;
    setIsLoadingFromSheet(true);
    try {
      const res = await fetchFormsFromAppsScriptWebhook();
      if (res.success && Array.isArray(res.forms)) {
        const pendingSet = getActivePendingSet();
        setForms(prevForms => reconcileFormsWithPendingCreations(res.forms, prevForms, pendingSet));
        setLastSyncedAt(new Date().toISOString());
        setSyncError(null);
        return res.forms.length;
      }
      if (res.error) {
        setSyncError(res.error);
      }
    } catch (err: any) {
      console.warn('refreshFromGoogleSheet error:', err);
      setSyncError(err?.message || 'Gagal membaca data dari Google Sheet');
    } finally {
      setIsLoadingFromSheet(false);
    }
    return forms.length;
  };

  // Boot server webhook sync + auto-sync polling every 5s and immediate sync on focus/visibility/OAuth/config update
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const startSyncCycle = () => {
      if (!isMounted) return;
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      if (!hasAnySyncChannel()) return;

      // 1. Immediate fetch from sheet "Rekapan Form"
      refreshFromGoogleSheet();

      // 2. Poll every 5 seconds so deleted/edited rows mirror rapidly across all browsers
      interval = setInterval(() => {
        refreshFromGoogleSheet();
      }, 5000);
    };

    syncWebhookConfigWithServer().then(configured => {
      if (!isMounted) return;
      if (configured || getGoogleAccessToken()) {
        startSyncCycle();
      } else {
        // Probe /api/google/forms once in case Service Account is active on backend
        refreshFromGoogleSheet(true);
      }
    });

    const onFocusOrVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      await syncWebhookConfigWithServer();
      if (hasAnySyncChannel()) {
        refreshFromGoogleSheet(true);
      }
    };
    const onConfigUpdated = () => {
      startSyncCycle();
    };
    const onGoogleConnected = () => {
      startSyncCycle();
    };

    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
    window.addEventListener('clx-autosync-updated', onConfigUpdated);
    window.addEventListener('clx-google-connected', onGoogleConnected);

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
      window.removeEventListener('clx-autosync-updated', onConfigUpdated);
      window.removeEventListener('clx-google-connected', onGoogleConnected);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(forms));
    } catch {
      // Quota fallback: strip heavy Base64 attachments & signature images so records still persist locally
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(forms.map(sanitizeFormForWebhook)));
      } catch (err2) {
        console.warn('Failed to save forms to localStorage:', err2);
      }
    }
  }, [forms]);

  const getNextSequence = (type: FormType): number => {
    const existing = forms.filter(f => f.formType === type);
    if (existing.length === 0) return 1;
    const maxSeq = Math.max(...existing.map(f => f.sequenceNumber || 0));
    return maxSeq + 1;
  };

  const addForm = async (newDoc: FormDocument): Promise<FormDocument> => {
    let updatedDoc: FormDocument = { ...newDoc };
    markPendingDoc(updatedDoc.docNumber);

    let sheetsSuccess = false;
    let targetRowNumber: number | undefined;
    let targetSheetName = 'Rekapan Form';
    let syncErrorMsg: string | undefined;

    try {
      // Ensure latest server webhook URL is loaded if a non-admin opened the page
      if (!isAutoSyncConfigured()) {
        await syncWebhookConfigWithServer();
      }

      // 1. Primary path: Webhook or OAuth Google Sheets API (sanitized lightweight payload)
      const autoRes = await autoSyncFormToGoogleSheet(updatedDoc, forms.length + 1);
      sheetsSuccess = autoRes.synced;
      targetRowNumber = autoRes.rowNumber;
      targetSheetName = autoRes.sheetTitle || 'Rekapan Form';
      syncErrorMsg = autoRes.error;

      // 2. Only hit backend /api/google/sheets-sync fallback if server has Service Account or Webhook configured
      if (!sheetsSuccess && hasServerSyncCapability()) {
        try {
          const proxyRes = await syncToGoogleSheets(updatedDoc);
          sheetsSuccess = true;
          targetRowNumber = proxyRes.rowNumber;
          targetSheetName = proxyRes.sheetName || targetSheetName;
          syncErrorMsg = undefined;
        } catch (proxyErr: any) {
          console.warn('Backend sheets proxy notice:', proxyErr);
          if (!syncErrorMsg) {
            syncErrorMsg = proxyErr?.message || 'Sinkronisasi ke Google Sheet belum aktif.';
          }
        }
      }

      updatedDoc.googleSheets = {
        synced: sheetsSuccess,
        rowNumber: targetRowNumber,
        sheetName: targetSheetName,
        syncedAt: sheetsSuccess ? new Date().toISOString() : undefined,
        error: sheetsSuccess ? undefined : syncErrorMsg,
      };
    } catch (err: any) {
      console.warn('Google auto-sync notice on creation:', err);
      updatedDoc.googleSheets = {
        synced: false,
        sheetName: targetSheetName,
        error: err?.message || 'Gagal menyinkronkan ke Google Sheet.',
      };
    }

    setForms(prev => [updatedDoc, ...prev]);
    return updatedDoc;
  };

  const updateForm = (updatedDoc: FormDocument) => {
    markPendingDoc(updatedDoc.docNumber);
    setForms(prev => prev.map(f => (f.id === updatedDoc.id ? updatedDoc : f)));
    // Automatically push update to Google Sheet in background
    autoUpdateFormInGoogleSheet(updatedDoc).catch(err => {
      console.warn('Background autoUpdateForm notice:', err);
    });
  };

  const deleteForm = (id: string) => {
    const target = forms.find(f => f.id === id);
    if (target?.docNumber) {
      pendingDocNumbersRef.current.delete(target.docNumber.trim().toLowerCase());
    }
    setForms(prev => prev.filter(f => f.id !== id));
    if (target?.docNumber) {
      autoDeleteFormInGoogleSheet(target.docNumber).catch(err => {
        console.warn('Background autoDeleteForm notice:', err);
      });
    }
  };

  const approveForm = async (
    id: string,
    user: { role: UserRole; name: string; title: string; signatureUrl?: string }
  ) => {
    const target = forms.find(f => f.id === id);
    if (!target) return;

    // Strict role verification: only account with matching role can approve!
    if (user.role !== target.currentAssigneeRole) {
      throw new Error(
        `Otorisasi ditolak: Pengajuan ini sedang menunggu persetujuan dari peran ${target.currentAssigneeRole}. Akun Anda saat ini adalah ${user.role}.`
      );
    }

    // Apply corporate threshold rule (<= 10 Juta finishes at CFO, > 10 Juta requires CEO)
    const step = getNextApprovalStep(user.role, target.totalAmount);

    const stamp: DigitalStamp = {
      role: user.role,
      userName: user.name,
      userTitle: user.title,
      signatureImage: user.signatureUrl,
      signedAt: new Date().toISOString(),
      digitalHash: `SHA256-CLX-${user.role}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    };

    const updatedSignatures = { ...target.signatures };
    if (user.role === 'CSO') updatedSignatures.cso = stamp;
    else if (user.role === 'COO') updatedSignatures.coo = stamp;
    else if (user.role === 'CFO') updatedSignatures.cfo = stamp;
    else if (user.role === 'CEO') updatedSignatures.ceo = stamp;

    const updatedDoc: FormDocument = {
      ...target,
      status: step.nextStatus,
      currentAssigneeRole: step.nextAssigneeRole,
      signatures: updatedSignatures,
      updatedAt: new Date().toISOString(),
    };

    // Requirement: Yang tersimpan di Google Drive HANYA yang berstatus Full Approved
    if (step.isFullyApproved) {
      try {
        const pdfBytes = await generateMergedPdf(updatedDoc);
        const driveRes = await syncToGoogleDrive(updatedDoc, pdfBytes);
        updatedDoc.googleDrive = {
          uploaded: true,
          folderPath: driveRes.folderPath,
          fileId: driveRes.fileId,
          fileUrl: driveRes.webViewLink,
          uploadedAt: driveRes.uploadedAt,
        };
      } catch (driveErr) {
        console.warn('Drive upload error on fully approved:', driveErr);
      }
    }

    // Update state & push form changes
    updateForm(updatedDoc);

    // Record status update to Google Sheets
    try {
      const webhookOk = await autoSyncStatusToGoogleSheet(updatedDoc);
      if (!webhookOk) {
        await syncToGoogleSheets(updatedDoc);
      }
    } catch (err) {
      console.warn('Sheets update notice:', err);
    }
  };

  const rejectForm = async (
    id: string,
    reason: string,
    user: { role: UserRole; name: string }
  ) => {
    const target = forms.find(f => f.id === id);
    if (!target) return;

    if (user.role !== target.currentAssigneeRole) {
      throw new Error(`Hanya peran ${target.currentAssigneeRole} yang berhak menolak dokumen ini.`);
    }

    const updatedDoc: FormDocument = {
      ...target,
      status: 'Rejected',
      rejectionReason: reason,
      updatedAt: new Date().toISOString(),
    };

    updateForm(updatedDoc);

    try {
      const webhookOk = await autoSyncStatusToGoogleSheet(updatedDoc);
      if (!webhookOk) {
        await syncToGoogleSheets(updatedDoc);
      }
    } catch (err) {
      console.warn('Sheets update notice:', err);
    }
  };

  const getPendingApprovalsForRole = (role: UserRole): FormDocument[] => {
    if (role === 'Staff') return [];
    return forms.filter(
      f => f.currentAssigneeRole === role && f.status !== 'Fully Approved' && f.status !== 'Rejected'
    );
  };

  const pendingCountForUser = (role: UserRole): number => {
    return getPendingApprovalsForRole(role).length;
  };

  const syncDrive = async (id: string) => {
    const doc = forms.find(f => f.id === id);
    if (!doc) return;
    const pdfBytes = await generateMergedPdf(doc);
    const driveRes = await syncToGoogleDrive(doc, pdfBytes);
    const updated: FormDocument = {
      ...doc,
      googleDrive: {
        uploaded: true,
        folderPath: driveRes.folderPath,
        fileId: driveRes.fileId,
        fileUrl: driveRes.webViewLink,
        uploadedAt: driveRes.uploadedAt,
      },
    };
    updateForm(updated);
  };

  const syncSheets = async (id: string) => {
    const doc = forms.find(f => f.id === id);
    if (!doc) return;
    const sheetsRes = await syncToGoogleSheets(doc);
    const updated: FormDocument = {
      ...doc,
      googleSheets: {
        synced: true,
        rowNumber: sheetsRes.rowNumber,
        sheetName: sheetsRes.sheetName,
        syncedAt: sheetsRes.syncedAt,
      },
    };
    updateForm(updated);
  };

  const resetToDefault = () => {
    pendingDocNumbersRef.current.clear();
    localStorage.removeItem(STORAGE_KEY);
    setForms(INITIAL_FORMS);
  };

  return (
    <FormContext.Provider
      value={{
        forms,
        isLoadingFromSheet,
        lastSyncedAt,
        syncError,
        refreshFromGoogleSheet,
        addForm,
        updateForm,
        deleteForm,
        getNextSequence,
        approveForm,
        rejectForm,
        getPendingApprovalsForRole,
        pendingCountForUser,
        syncDrive,
        syncSheets,
        resetToDefault,
      }}
    >
      {children}
    </FormContext.Provider>
  );
};

export const useForms = (): FormContextType => {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useForms must be used within a FormProvider');
  }
  return context;
};
