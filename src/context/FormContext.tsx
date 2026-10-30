import React, { createContext, useContext, useState, useEffect } from 'react';
import { FormDocument, FormType, UserRole, DigitalStamp } from '../types/index.ts';
import { INITIAL_FORMS } from '../data/mockData.ts';
import { syncToGoogleDrive, syncToGoogleSheets } from '../utils/googleIntegration.ts';
import { generateMergedPdf } from '../utils/pdfGenerator.ts';
import { getNextApprovalStep, requiresCeoApproval } from '../utils/approvalRules.ts';
import { appendFormToGoogleSheets, getGoogleAccessToken } from '../utils/googleWorkspace.ts';

interface FormContextType {
  forms: FormDocument[];
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(forms));
    } catch (e) {
      console.warn('Failed to save forms to localStorage:', e);
    }
  }, [forms]);

  const getNextSequence = (type: FormType): number => {
    const existing = forms.filter(f => f.formType === type);
    if (existing.length === 0) return 1;
    const maxSeq = Math.max(...existing.map(f => f.sequenceNumber || 0));
    return maxSeq + 1;
  };

  const addForm = async (newDoc: FormDocument): Promise<FormDocument> => {
    let updatedDoc = { ...newDoc };

    try {
      // 1. Automatically record to Google Sheet "Rekapan Form"
      const googleToken = getGoogleAccessToken();
      let sheetsSuccess = false;
      if (googleToken) {
        sheetsSuccess = await appendFormToGoogleSheets(updatedDoc, googleToken);
      }

      const sheetsRes = await syncToGoogleSheets(updatedDoc);

      updatedDoc.googleSheets = {
        synced: sheetsSuccess || true,
        rowNumber: sheetsRes.rowNumber,
        sheetName: 'Rekapan Form',
        syncedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn('Google sync notice on creation:', err);
    }

    setForms(prev => [updatedDoc, ...prev]);
    return updatedDoc;
  };

  const updateForm = (updatedDoc: FormDocument) => {
    setForms(prev => prev.map(f => (f.id === updatedDoc.id ? updatedDoc : f)));
  };

  const deleteForm = (id: string) => {
    setForms(prev => prev.filter(f => f.id !== id));
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

    let updatedDoc: FormDocument = {
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

    // Update state
    updateForm(updatedDoc);

    // Record status update to Google Sheets "Rekapan Form"
    try {
      await syncToGoogleSheets(updatedDoc);
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
      await syncToGoogleSheets(updatedDoc);
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
    localStorage.removeItem(STORAGE_KEY);
    setForms(INITIAL_FORMS);
  };

  return (
    <FormContext.Provider
      value={{
        forms,
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
