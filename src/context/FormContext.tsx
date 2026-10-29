import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { FormDocument, FormType, UserRole, DigitalStamp } from '../types/index.ts'; // Sesuaikan ekstensi import Anda
import { syncToGoogleDrive, syncToGoogleSheets, fetchFormsFromGoogleSheets } from '../utils/googleIntegration.ts';
import { generateMergedPdf } from '../utils/pdfGenerator.ts';

// Hapus import INITIAL_FORMS dari mockData.ts karena kita sudah tidak membutuhkannya

interface FormContextType {
  forms: FormDocument[];
  isLoading: boolean; // Tambahan state loading
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
  refreshForms: () => Promise<void>; // Fungsi untuk fetch ulang (refresh)
  resetToDefault: () => void;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

const STORAGE_KEY = 'clx_financial_forms_v1';

export const FormProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [forms, setForms] = useState<FormDocument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fungsi untuk memetakan status ke Assignee berikutnya
  const getAssigneeFromStatus = (status: string): UserRole => {
    switch (status) {
      case 'Pending': return 'CSO';
      case 'Approved by CSO': return 'COO';
      case 'Approved by COO': return 'CFO';
      case 'Approved by CFO': return 'CEO';
      case 'Fully Approved': return 'CEO'; // Selesai
      case 'Rejected': return 'Staff'; // Kembali ke pembuat
      default: return 'CSO';
    }
  };

  const loadFormsFromSheets = useCallback(async () => {
    setIsLoading(true);
    try {
      const rawRows = await fetchFormsFromGoogleSheets();
      
      // Map data array dari Sheets kembali ke format FormDocument React
      const parsedForms: FormDocument[] = rawRows.map((row: any) => {
        const parseSignature = (cell: string, role: UserRole): DigitalStamp | undefined => {
          if (!cell || cell === '-') return undefined;
          // Asumsi format di sheets: "Nama User (YYYY-MM-DD)"
          const match = cell.match(/(.+?)\s*\((.+?)\)/);
          if (match) {
            return {
              role,
              userName: match[1].trim(),
              userTitle: role,
              signedAt: match[2],
              digitalHash: 'Synced-From-Sheets',
            };
          }
          return { role, userName: cell, userTitle: role, signedAt: '', digitalHash: '' };
        };

        // Ekstrak angka urutan dari "Nomor Dokumen" jika memungkinkan
        const docNum: string = row[0] || '';
        const seqMatch = docNum.match(/-(\d+)$/);
        const sequenceNumber = seqMatch ? parseInt(seqMatch[1], 10) : 1;

        const status = row[13] || 'Pending';

        return {
          id: row[0], // Gunakan nomor dokumen sebagai ID unik
          docNumber: row[0],
          sequenceNumber: sequenceNumber,
          date: row[1],
          formType: row[2] as FormType,
          division: row[3],
          requesterName: row[4],
          requesterRole: row[5] as UserRole,
          purpose: row[6],
          totalAmount: Number(row[7]) || 0,
          terbilang: row[8],
          paymentMethod: row[9],
          bankName: row[10] !== '-' ? row[10] : undefined,
          bankAccountNo: row[11] !== '-' ? row[11] : undefined,
          bankAccountName: row[12] !== '-' ? row[12] : undefined,
          status: status as any,
          currentAssigneeRole: getAssigneeFromStatus(status),
          signatures: {
            maker: parseSignature(row[14], 'Staff'),
            cso: parseSignature(row[15], 'CSO'),
            coo: parseSignature(row[16], 'COO'),
            cfo: parseSignature(row[17], 'CFO'),
            ceo: parseSignature(row[18], 'CEO'),
          },
          googleDrive: row[19] !== '-' ? { fileUrl: row[19], uploaded: true } as any : undefined,
          notes: row[20] !== '-' ? row[20] : undefined,
          updatedAt: row[21] || new Date().toISOString(),
        };
      });

      // Data dari Sheets biasanya dari lama ke baru, kita reverse agar yang terbaru di atas
      setForms(parsedForms.reverse());
    } catch (e) {
      console.warn('Gagal fetch dari Google Sheets, menggunakan fallback localStorage:', e);
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setForms(JSON.parse(saved));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Jalankan saat aplikasi pertama kali dimuat
  useEffect(() => {
    loadFormsFromSheets();
  }, [loadFormsFromSheets]);

  // Simpan ke localstorage sebagai cache cadangan (jika offline)
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
    
    // Optimistic Update: Langsung tampil di UI sebelum selesai loading
    setForms(prev => [updatedDoc, ...prev]);

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

      // Update state dengan data yang sudah dilengkapi link
      updateForm(updatedDoc);
    } catch (err) {
      console.warn('Sync gagal (simpan lokal saja):', err);
    }

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

    // Update di React State
    updateForm(updatedDoc);

    // Update ke Google Sheets
    try {
      await syncToGoogleSheets(updatedDoc);
    } catch (err) {
      console.warn('Gagal update form ke Google Sheets:', err);
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
      currentAssigneeRole: 'Staff',
      rejectionReason: reason,
      updatedAt: new Date().toISOString(),
    };

    updateForm(updatedDoc);

    try {
      await syncToGoogleSheets(updatedDoc);
    } catch (err) {
      console.warn('Gagal update penolakan form ke Google Sheets:', err);
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
    setForms([]);
  };

  return (
    <FormContext.Provider
      value={{
        forms,
        isLoading, // Bisa dipakai di komponen untuk me-render spinner
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
        refreshForms: loadFormsFromSheets,
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
