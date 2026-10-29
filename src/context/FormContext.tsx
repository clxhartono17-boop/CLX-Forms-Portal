import React, { createContext, useContext, useState, useEffect } from 'react';
import { FormDocument, FormType, UserRole, DigitalStamp } from '../types/index.ts';
import { INITIAL_FORMS } from '../data/mockData.ts';
import { syncToGoogleDrive, syncToGoogleSheets } from '../utils/googleIntegration.ts';
import { generateMergedPdf } from '../utils/pdfGenerator.ts';

interface FormContextType {
  forms: FormDocument[];
  addForm: (doc: FormDocument) => Promise<FormDocument>;
  updateForm: (doc: FormDocument) => void;
  deleteForm: (id: string) => void;
  getNextSequence: (type: FormType) => number;
  approveForm: (id: string, user: { role: UserRole; name: string; title: string }) => Promise<void>;
  rejectForm: (id: string, reason: string, user: { role: UserRole; name: string }) => Promise<void>;
  getPendingApprovalsForRole: (role: UserRole) => FormDocument[];
  pendingCountForUser: (role: UserRole) => number;
  syncDrive: (id: string) => Promise<void>;
  syncSheets: (id: string) => Promise<void>;
  resetToDefault: () => void;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

const STORAGE_KEY = 'clx_financial_forms_v1';

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
    // Generate merged PDF & sync
    let updatedDoc = { ...newDoc };
    try {
      const pdfBytes = await generateMergedPdf(updatedDoc);
      const driveRes = await syncToGoogleDrive(updatedDoc, pdfBytes);
      const sheetsRes = await syncToGoogleSheets(updatedDoc);

      updatedDoc.googleDrive = {
        uploaded: true,
        folderPath: driveRes.folderPath,
        fileId: driveRes.fileId,
        fileUrl: driveRes.webViewLink,
        uploadedAt: driveRes.uploadedAt,
      };

      updatedDoc.googleSheets = {
        synced: true,
        rowNumber: sheetsRes.rowNumber,
        sheetName: sheetsRes.sheetName,
        syncedAt: sheetsRes.syncedAt,
      };
    } catch (err) {
      console.warn('Auto-sync notice (simulated fallback applied):', err);
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
    user: { role: UserRole; name: string; title: string }
  ) => {
    const target = forms.find(f => f.id === id);
    if (!target) return;

    const stamp: DigitalStamp = {
      role: user.role,
      userName: user.name,
      userTitle: user.title,
      signedAt: new Date().toISOString(),
      digitalHash: `SHA256-CLX-${user.role}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    };

    let nextStatus = target.status;
    let nextAssignee: UserRole = target.currentAssigneeRole;
    const updatedSignatures = { ...target.signatures };

    if (user.role === 'CSO') {
      updatedSignatures.cso = stamp;
      nextStatus = 'Approved by CSO';
      nextAssignee = 'COO';
    } else if (user.role === 'COO') {
      updatedSignatures.coo = stamp;
      nextStatus = 'Approved by COO';
      nextAssignee = 'CFO';
    } else if (user.role === 'CFO') {
      updatedSignatures.cfo = stamp;
      nextStatus = 'Approved by CFO';
      nextAssignee = 'CEO';
    } else if (user.role === 'CEO') {
      updatedSignatures.ceo = stamp;
      nextStatus = 'Fully Approved';
      nextAssignee = 'CEO';
    }

    const updatedDoc: FormDocument = {
      ...target,
      status: nextStatus,
      currentAssigneeRole: nextAssignee,
      signatures: updatedSignatures,
      updatedAt: new Date().toISOString(),
    };

    // Update in state
    updateForm(updatedDoc);

    // Sync to Sheets
    try {
      await syncToGoogleSheets(updatedDoc);
    } catch (err) {
      console.warn('Sheets update notice:', err);
    }
  };

  const rejectForm = async (
    id: string,
    reason: string,
    _user: { role: UserRole; name: string }
  ) => {
    const target = forms.find(f => f.id === id);
    if (!target) return;

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
    return forms.filter(f => f.currentAssigneeRole === role && f.status !== 'Fully Approved' && f.status !== 'Rejected');
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
