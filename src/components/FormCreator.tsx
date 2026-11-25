import React, { useState, useEffect, useId, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useForms } from '../context/FormContext.tsx';
import { FormType, Division, FormItem, FormAttachment, FormDocument } from '../types/index.ts';
import { generateDocNumber } from '../utils/romanNumerals.ts';
import { terbilangRupiah } from '../utils/terbilang.ts';
import { PhysicalFormPreview } from './PhysicalFormPreview.tsx';
import {
  DEFAULT_INITIAL_ITEM,
  FormDraftInput,
  clearFormDraft,
  hasMeaningfulDraftContent,
  loadFormDraft,
  saveFormDraft,
} from '../utils/formDraft.ts';
import { 
  Plus, 
  Trash2, 
  Upload, 
  Paperclip, 
  CheckCircle, 
  Eye, 
  FileEdit, 
  AlertCircle,
  Save,
  Building,
  CreditCard,
  Layers,
  Lock,
  UserCheck,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  WifiOff,
  BookmarkCheck,
  RotateCcw
} from 'lucide-react';
import { SPREADSHEET_URL, copyFormsToClipboard, isAutoSyncConfigured } from '../utils/googleWorkspace.ts';

interface FormCreatorProps {
  onSuccess: (createdDoc: FormDocument) => void;
  onCancel: () => void;
}

export const FormCreator: React.FC<FormCreatorProps> = ({ onSuccess, onCancel }) => {
  const { 
    currentUser, 
    setShowAuthModal, 
    isGoogleConnected, 
    googleUser, 
    googleToken, 
    connectGoogle,
    isAdmin
  } = useAuth();
  const { getNextSequence, addForm } = useForms();
  const fileInputId = useId();

  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [showPromptGoogle, setShowPromptGoogle] = useState(false);
  const [successModalDoc, setSuccessModalDoc] = useState<FormDocument | null>(null);

  const [formType, setFormType] = useState<FormType>('FPU');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Division dropdown strictly as specified:
  // Project, Operation, Services, General, Finance
  const [division, setDivision] = useState<Division>(currentUser?.division || 'Finance');
  const [requesterName, setRequesterName] = useState(currentUser?.name || '');
  const [requesterRole, setRequesterRole] = useState(currentUser?.title || 'Staff (Maker)');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'Cash' | 'Giro / Cheque' | 'Virtual Account'>('Bank Transfer');
  const [bankName, setBankName] = useState('BCA (Bank Central Asia)');
  const [bankAccountNo, setBankAccountNo] = useState('8830192831');
  const [bankAccountName, setBankAccountName] = useState(currentUser?.name || '');
  const [copiedSingleDoc, setCopiedSingleDoc] = useState(false);

  // Line items state
  const [items, setItems] = useState<FormItem[]>([{ ...DEFAULT_INITIAL_ITEM }]);

  // Attachments
  const [attachments, setAttachments] = useState<FormAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Draft & Offline resilience states
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);
  const [draftAttachmentsWarning, setDraftAttachmentsWarning] = useState(false);
  const [manualDraftFeedback, setManualDraftFeedback] = useState<string | null>(null);
  const hydratedEmailRef = useRef<string | null>(null);
  const explicitDraftRef = useRef<boolean>(false);

  // Hydrate either saved draft OR currentUser defaults without clobbering restored draft values
  useEffect(() => {
    if (!currentUser) {
      hydratedEmailRef.current = null;
      setIsHydrated(false);
      return;
    }

    const normalizedEmail = currentUser.email.toLowerCase();
    if (hydratedEmailRef.current === normalizedEmail) return;
    hydratedEmailRef.current = normalizedEmail;

    const existingDraft = loadFormDraft(currentUser.email);
    if (existingDraft && hasMeaningfulDraftContent(existingDraft)) {
      explicitDraftRef.current = Boolean(existingDraft.explicitlySaved);
      setFormType(existingDraft.formType || 'FPU');
      setSelectedDate(existingDraft.selectedDate || new Date().toISOString().split('T')[0]);
      setDivision(existingDraft.division || currentUser.division || 'Finance');
      setRequesterName(existingDraft.requesterName || currentUser.name);
      setRequesterRole(
        existingDraft.requesterRole ||
          currentUser.title ||
          `${currentUser.role} (${currentUser.division})`
      );
      setPurpose(existingDraft.purpose || '');
      setNotes(existingDraft.notes || '');
      setPaymentMethod(existingDraft.paymentMethod || 'Bank Transfer');
      setBankName(existingDraft.bankName || 'BCA (Bank Central Asia)');
      setBankAccountNo(existingDraft.bankAccountNo || '8830192831');
      setBankAccountName(existingDraft.bankAccountName || currentUser.name);
      setItems(
        existingDraft.items && existingDraft.items.length > 0
          ? existingDraft.items.map(it => {
              const q = Number(it.qty) || 0;
              const p = Number(it.unitPrice) || 0;
              return { ...it, qty: q, unitPrice: p, total: q * p };
            })
          : [{ ...DEFAULT_INITIAL_ITEM }]
      );
      setAttachments(existingDraft.attachments || []);
      setDraftRestoredAt(existingDraft.savedAt);
      setDraftSavedAt(existingDraft.savedAt);
      setDraftAttachmentsWarning(Boolean(existingDraft.attachmentsStripped));
    } else {
      explicitDraftRef.current = false;
      setRequesterName(currentUser.name);
      setRequesterRole(currentUser.title || `${currentUser.role} (${currentUser.division})`);
      setDivision(currentUser.division || 'Finance');
      setBankAccountName(currentUser.name);
      setDraftRestoredAt(null);
      setDraftSavedAt(null);
      setDraftAttachmentsWarning(false);
    }
    setIsHydrated(true);
  }, [currentUser]);

  const buildDraftPayload = useCallback(
    (explicitlySaved = explicitDraftRef.current): FormDraftInput => ({
      userEmail: currentUser?.email || 'guest',
      formType,
      selectedDate,
      division,
      requesterName,
      requesterRole,
      purpose,
      notes,
      paymentMethod,
      bankName,
      bankAccountNo,
      bankAccountName,
      items,
      attachments,
      explicitlySaved,
    }),
    [
      currentUser?.email,
      formType,
      selectedDate,
      division,
      requesterName,
      requesterRole,
      purpose,
      notes,
      paymentMethod,
      bankName,
      bankAccountNo,
      bankAccountName,
      items,
      attachments,
    ]
  );

  // Latest payload ref for synchronous flush on offline/pagehide
  const latestPayloadRef = useRef<FormDraftInput | null>(null);
  useEffect(() => {
    latestPayloadRef.current = buildDraftPayload();
  }, [buildDraftPayload]);

  // Monitor browser online/offline state and flush draft immediately if connection drops
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      const payload = latestPayloadRef.current;
      if (payload && (hasMeaningfulDraftContent(payload) || explicitDraftRef.current)) {
        const res = saveFormDraft(payload);
        if (res.saved) {
          setDraftSavedAt(res.savedAt);
          setDraftAttachmentsWarning(res.attachmentsStripped);
        }
      }
    };
    const handlePageHide = () => {
      const payload = latestPayloadRef.current;
      if (payload && (hasMeaningfulDraftContent(payload) || explicitDraftRef.current)) {
        saveFormDraft(payload);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, []);

  // Automatic debounced draft save on every field edit
  useEffect(() => {
    if (!isHydrated || !currentUser || successModalDoc) return;
    const payload = buildDraftPayload();
    if (!hasMeaningfulDraftContent(payload) && !explicitDraftRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      const res = saveFormDraft(payload);
      if (res.saved) {
        setDraftSavedAt(res.savedAt);
        setDraftAttachmentsWarning(res.attachmentsStripped);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [isHydrated, currentUser, successModalDoc, buildDraftPayload]);

  const handleManualSaveDraft = () => {
    if (!currentUser) return;
    explicitDraftRef.current = true;
    const payload = buildDraftPayload(true);
    const res = saveFormDraft(payload);
    if (res.saved) {
      setDraftSavedAt(res.savedAt);
      setDraftAttachmentsWarning(res.attachmentsStripped);
      const timeLabel = new Date(res.savedAt).toLocaleTimeString('id-ID');
      setManualDraftFeedback(
        res.attachmentsStripped
          ? `Draft formulir tersimpan secara lokal pukul ${timeLabel} (tanpa file lampiran berukuran besar). Aman saat internet terputus.`
          : `Draft formulir tersimpan secara lokal pukul ${timeLabel}. Pekerjaan Anda aman meski internet terputus atau halaman dimuat ulang.`
      );
    } else {
      setValidationError(res.error || 'Gagal menyimpan draft lokal di browser.');
    }
  };

  const handleDiscardDraft = () => {
    clearFormDraft(currentUser?.email);
    explicitDraftRef.current = false;
    setFormType('FPU');
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setDivision(currentUser?.division || 'Finance');
    setRequesterName(currentUser?.name || '');
    setRequesterRole(
      currentUser?.title ||
        (currentUser ? `${currentUser.role} (${currentUser.division})` : 'Staff (Maker)')
    );
    setPurpose('');
    setNotes('');
    setPaymentMethod('Bank Transfer');
    setBankName('BCA (Bank Central Asia)');
    setBankAccountNo('8830192831');
    setBankAccountName(currentUser?.name || '');
    setItems([{ ...DEFAULT_INITIAL_ITEM }]);
    setAttachments([]);
    setDraftRestoredAt(null);
    setDraftSavedAt(null);
    setDraftAttachmentsWarning(false);
    setManualDraftFeedback(null);
    setValidationError(null);
  };

  // Auto-numbering calculation
  const sequence = getNextSequence(formType);
  const dateObj = new Date(selectedDate);
  const autoDocNumber = generateDocNumber(formType, sequence, isNaN(dateObj.getTime()) ? new Date() : dateObj);

  // Total amount calculation
  const totalAmount = items.reduce((sum, item) => sum + (item.total || 0), 0);
  const liveTerbilang = terbilangRupiah(totalAmount);

  // Update line item
  const handleItemChange = (index: number, field: keyof FormItem, val: any) => {
    setItems(prev => {
      const next = [...prev];
      const target = { ...next[index], [field]: val };
      if (field === 'qty' || field === 'unitPrice') {
        const q = field === 'qty' ? parseFloat(val) || 0 : parseFloat(String(target.qty)) || 0;
        const p = field === 'unitPrice' ? parseFloat(val) || 0 : parseFloat(String(target.unitPrice)) || 0;
        target.total = q * p;
      }
      next[index] = target;
      return next;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        description: '',
        qty: 1,
        unit: 'Unit',
        unitPrice: 0,
        total: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Handle Attachment Upload (PDF, PNG, JPG)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();

      reader.onload = event => {
        const dataUrl = event.target?.result as string;
        const newAttachment: FormAttachment = {
          id: `att-${Date.now()}-${i}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          dataUrl: dataUrl,
          uploadedAt: new Date().toISOString(),
        };
        setAttachments(prev => [...prev, newAttachment]);
      };

      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAttachment = (attId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attId));
  };

  // Construct draft doc object for physical preview
  const currentDraftDoc: FormDocument = {
    id: 'draft-temp',
    docNumber: autoDocNumber,
    formType,
    sequenceNumber: sequence,
    date: selectedDate,
    division,
    requesterName,
    requesterRole,
    requesterEmail: currentUser?.email || 'staff@clx.co.id',
    purpose: purpose || '(Belum mengisi keperluan)',
    notes,
    paymentMethod,
    bankName,
    bankAccountNo,
    bankAccountName,
    items: items.map(it => {
      const qtyNum = Number(it.qty) || 0;
      const priceNum = Number(it.unitPrice) || 0;
      return {
        ...it,
        qty: qtyNum,
        unitPrice: priceNum,
        total: qtyNum * priceNum,
      };
    }),
    totalAmount,
    terbilang: liveTerbilang,
    status: 'Pending Approval',
    currentAssigneeRole: 'CSO',
    signatures: {
      maker: {
        role: 'Staff',
        userName: requesterName,
        userTitle: requesterRole,
        signatureImage: currentUser?.signatureUrl,
        signedAt: new Date().toISOString(),
        digitalHash: `SHA256-CLX-MKR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      },
    },
    attachments,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const executeSave = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      explicitDraftRef.current = true;
      const res = saveFormDraft(buildDraftPayload(true));
      if (res.saved) {
        setDraftSavedAt(res.savedAt);
        setDraftAttachmentsWarning(res.attachmentsStripped);
      }
      setValidationError(
        'Koneksi internet sedang terputus (Offline). Data formulir Anda sudah tersimpan otomatis sebagai Draft lokal — silakan ajukan kembali saat internet tersambung.'
      );
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);
    try {
      const newDoc: FormDocument = {
        ...currentDraftDoc,
        id: `${formType.toLowerCase()}-${Date.now()}`,
      };

      const savedDoc = await addForm(newDoc);
      clearFormDraft(currentUser?.email);
      explicitDraftRef.current = false;
      setDraftRestoredAt(null);
      setDraftSavedAt(null);
      setManualDraftFeedback(null);
      setSuccessModalDoc(savedDoc);
    } catch (err: any) {
      explicitDraftRef.current = true;
      const res = saveFormDraft(buildDraftPayload(true));
      if (res.saved) {
        setDraftSavedAt(res.savedAt);
      }
      setValidationError(
        `${err?.message || 'Gagal mengirim dokumen ke server.'} Data formulir Anda tetap tersimpan aman di Draft lokal.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!requesterName.trim()) {
      setValidationError('Harap isi Nama Pemohon (Staff).');
      return;
    }

    if (!selectedDate) {
      setValidationError('Harap pilih Tanggal Pengajuan.');
      return;
    }

    if (!purpose.trim()) {
      setValidationError('Harap isi Keperluan / Deskripsi Pengajuan.');
      return;
    }

    const hasInvalidQty = items.some(it => Number(it.qty) < 0 || Number.isNaN(Number(it.qty)));
    if (hasInvalidQty) {
      setValidationError('Jumlah (Qty) pada rincian item tidak boleh bernilai negatif.');
      return;
    }

    if (totalAmount <= 0) {
      setValidationError('Total pengajuan harus lebih dari Rp 0. Harap isi Qty dan Harga Satuan dengan benar.');
      return;
    }

    // If Auto-Sync Webhook is configured or user is non-admin, proceed directly to save & sync
    if (isAdmin && !isAutoSyncConfigured() && !isGoogleConnected && !googleToken) {
      setShowPromptGoogle(true);
      return;
    }

    await executeSave();
  };

  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden p-8 text-center animate-in fade-in zoom-in-95">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-xs">
          <Lock className="w-8 h-8" />
        </div>
        <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 text-[11px] font-bold uppercase rounded-full mb-2">
          Otentikasi Wajib Karyawan
        </span>
        <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
          Silakan Login atau Registrasi Terlebih Dahulu
        </h2>
        <p className="text-xs text-slate-600 mt-2 leading-relaxed max-w-md mx-auto">
          Sesuai SOP internal <strong>PT. Connectivity Leads eXcellence</strong>, sebelum membuat formulir pengajuan (FPU, FPP, FPPB), pengguna diwajibkan memiliki akun terdaftar di <em>Master Login</em> dan masuk ke sistem.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => setShowAuthModal(true)}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center space-x-1.5"
          >
            <UserCheck className="w-4 h-4" />
            <span>Login / Daftar Akun Baru</span>
          </button>
          <button
            onClick={onCancel}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner & Mode Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 text-xs font-black uppercase rounded bg-blue-100 text-blue-900 border border-blue-200">
              Auto-Generated Document Number
            </span>
            <span className="font-mono font-bold text-slate-800 text-base">
              {autoDocNumber}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Format: [JENIS]-[URUTAN]/CLX/[DD]/[BULAN_ROMAWI]/[TAHUN_ROMAWI]
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {draftSavedAt && (
            <span
              data-testid="draft-status-indicator"
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Draft tersimpan lokal pukul{' '}
                {new Date(draftSavedAt).toLocaleTimeString('id-ID')}
              </span>
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowLivePreview(false)}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              !showLivePreview
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Form Input</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLivePreview(true)}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              showLivePreview
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Live Paper Preview</span>
          </button>
        </div>
      </div>

      {/* Offline Connection Warning Banner */}
      {!isOnline && (
        <div
          data-testid="offline-draft-banner"
          className="flex items-start space-x-3 bg-amber-50 border border-amber-300 text-amber-950 text-xs px-4 py-3 rounded-xl shadow-2xs"
        >
          <WifiOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold">Koneksi Internet Terputus (Mode Offline)</div>
            <p className="text-[11px] text-amber-900 leading-relaxed">
              Seluruh perubahan Anda tetap <strong>tersimpan otomatis sebagai Draft lokal</strong> di browser ini. Anda tidak perlu mengulang dari awal — tekan <strong>Simpan Draft</strong> atau lanjutkan pengisian dan ajukan saat koneksi internet kembali normal.
            </p>
          </div>
        </div>
      )}

      {/* Restored Draft Notification Banner */}
      {draftRestoredAt && (
        <div
          data-testid="restored-draft-banner"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs px-4 py-3 rounded-xl shadow-2xs"
        >
          <div className="flex items-start space-x-2.5">
            <BookmarkCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">
                Draft Formulir Dipulihkan (disimpan {new Date(draftRestoredAt).toLocaleString('id-ID')})
              </div>
              <p className="text-[11px] text-indigo-800 mt-0.5">
                Isian terakhir Anda dimuat kembali secara otomatis agar tidak perlu mengulang dari awal.
                {draftAttachmentsWarning && (
                  <span className="block text-amber-800 font-semibold mt-0.5">
                    Catatan: File lampiran berukuran besar tidak dapat disimpan di cache lokal browser — harap unggah ulang lampiran bila diperlukan.
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDiscardDraft}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-indigo-200 hover:border-red-300 rounded-lg text-xs font-bold transition shrink-0 self-start sm:self-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Hapus Draft & Mulai Kosong</span>
          </button>
        </div>
      )}

      {/* Manual Save Draft Feedback Banner */}
      {manualDraftFeedback && (
        <div
          data-testid="manual-draft-feedback"
          className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs px-4 py-3 rounded-xl"
        >
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{manualDraftFeedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setManualDraftFeedback(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold ml-3"
          >
            &times;
          </button>
        </div>
      )}

      {validationError && (
        <div className="flex items-center space-x-2 bg-red-50 border border-red-200 text-red-800 text-xs px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {showLivePreview ? (
        <PhysicalFormPreview doc={currentDraftDoc} />
      ) : (
        <form noValidate onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Form Type Selector */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
1. Pilih Jenis Formulir (Form Type)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  type: 'FPU' as FormType,
                  title: 'FPU',
                  subtitle: 'Form Permohonan Uang',
                  desc: 'Kas Bon, Uang Muka Operasional, Reimbursement',
                  color: 'border-blue-500 bg-blue-50/50 text-blue-900',
                },
                {
                  type: 'FPP' as FormType,
                  title: 'FPP',
                  subtitle: 'Form Permohonan Pembayaran',
                  desc: 'BBM Solar, Biaya Toll, Port Handling, Faktur Pajak, Pembayaran Vendor',
                  color: 'border-indigo-500 bg-indigo-50/50 text-indigo-900',
                },
                {
                  type: 'FPPB' as FormType,
                  title: 'FPPB',
                  subtitle: 'Form Permohonan Pembelian Barang',
                  desc: 'Alat Kantor, Hardware Gudang, Sparepart Armada',
                  color: 'border-emerald-500 bg-emerald-50/50 text-emerald-900',
                },
              ].map(opt => (
                <button
                  type="button"
                  key={opt.type}
                  onClick={() => setFormType(opt.type)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    formType === opt.type
                      ? `${opt.color} ring-2 ring-blue-500/30 shadow-xs font-semibold`
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black tracking-wide">{opt.title}</span>
                    {formType === opt.type && (
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <div className="text-xs font-bold mt-0.5">{opt.subtitle}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Metadata Section: Division, Date, Requester */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
2. Data Dokumen & Divisi
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* DIVISI / DIVISION Dropdown strictly as required */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Divisi / Division <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={division}
                    onChange={e => setDivision(e.target.value as Division)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="Project">Project</option>
                    <option value="Operation">Operation</option>
                    <option value="Services">Services</option>
                    <option value="General">General</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>
              </div>

              {/* Document Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Pengajuan <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              {/* Pemohon / Requester */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Pemohon (Staff) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={requesterName}
                  onChange={e => setRequesterName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  placeholder="Nama Lengkap Pemohon"
                />
              </div>
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Keperluan / Uraian Kegiatan Pengajuan <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                placeholder="Jelaskan secara spesifik peruntukan uang/biaya/pembelian..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          </div>

          {/* 3. Payment & Bank Information */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
3. Metode Pembayaran & Rekening Penerima
            </label>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Metode Bayar
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Virtual Account">Virtual Account</option>
                  <option value="Cash">Cash (Kas Bon Tunai)</option>
                  <option value="Giro / Cheque">Giro / Cek</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Bank
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="BCA / Mandiri / BNI / BRI"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor Rekening
                </label>
                <input
                  type="text"
                  value={bankAccountNo}
                  onChange={e => setBankAccountNo(e.target.value)}
                  placeholder="Contoh: 8830192831"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Atas Nama (A.N)
                </label>
                <input
                  type="text"
                  value={bankAccountName}
                  onChange={e => setBankAccountName(e.target.value)}
                  placeholder="Nama Pemilik Rekening"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* 4. Line Items Table with Auto-Calculation & Terbilang */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
4. Rincian Barang / Komponen Biaya (Line Items)
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center space-x-1 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                    <th className="py-2.5 px-3">Uraian / Deskripsi</th>
                    <th className="py-2.5 px-3 w-20 text-center">Qty</th>
                    <th className="py-2.5 px-3 w-28 text-center">Satuan</th>
                    <th className="py-2.5 px-3 w-36 text-right">Harga Satuan (Rp)</th>
                    <th className="py-2.5 px-3 w-40 text-right">Total (Rp)</th>
                    <th className="py-2.5 px-2 w-12 text-center">Hapus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-center text-slate-500 font-semibold">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => handleItemChange(idx, 'description', e.target.value)}
                          placeholder="Deskripsi item barang atau pengeluaran biaya..."
                          className="w-full bg-transparent border-0 border-b border-transparent focus:border-blue-500 focus:ring-0 text-xs py-1 text-slate-800"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          aria-label={`Qty item ${idx + 1}`}
                          min="0"
                          step="any"
                          value={item.qty}
                          onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-center text-slate-800"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                          placeholder="Unit/Pcs/Lot"
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-center text-slate-800"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          aria-label={`Harga Satuan item ${idx + 1}`}
                          min="0"
                          step="any"
                          placeholder="0"
                          value={item.unitPrice}
                          onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-right font-mono text-slate-800"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {(item.total || 0).toLocaleString('id-ID')}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={items.length <= 1}
                          className="text-slate-400 hover:text-red-500 disabled:opacity-20 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5 mx-auto" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                    <td colSpan={5} className="py-2.5 px-3 text-right text-slate-700 uppercase">
                      Total Nilai Pengajuan (IDR):
                    </td>
                    <td className="py-2.5 px-3 text-right text-blue-900 font-black text-sm">
                      Rp {totalAmount.toLocaleString('id-ID')}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Auto Terbilang Live Banner */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3">
              <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wide">
                Auto-Terbilang (Number to Words):
              </div>
              <div className="text-xs font-semibold text-blue-950 italic mt-0.5">
                # {liveTerbilang} #
              </div>
            </div>
          </div>

          {/* 5. Attachments & Google Drive Merging Section */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
5. Lampiran Dokumen & Integrasi Google Drive
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  File pendukung (PDF, JPG, PNG) akan digabungkan otomatis ke dalam satu single PDF via pdf-lib dan diupload ke Google Drive.
                </p>
              </div>

              <div className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                Target Parent: 1hgUyTqNsfJsC30pY7O2kPS95DqEEySm9
              </div>
            </div>

            {/* Upload Box */}
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50 transition cursor-pointer relative">
              <input
                id={fileInputId}
                type="file"
                multiple
                accept=".pdf,image/png,image/jpeg"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                Klik atau seret file lampiran ke sini (PDF, PNG, JPG)
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Kuitansi, Faktur Pajak, Surat Perintah Kerja (SPK), Bukti Transfer, atau Foto Barang
              </p>
            </div>

            {/* Attachments List */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-700">
                  {attachments.length} Dokumen Terlampir:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map(att => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <Paperclip className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="font-medium text-slate-800 truncate">{att.name}</span>
                        <span className="text-[10px] text-slate-400">
                          ({(att.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 6. Google Sheets & Drive Real-time Sync Status (Admin Only) */}
          {isAdmin && (
            <div className={`p-4 rounded-xl border transition-all ${
              isGoogleConnected 
                ? 'bg-emerald-50/80 border-emerald-200' 
                : 'bg-amber-50/90 border-amber-300'
            }`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    isGoogleConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900">
                        {isGoogleConnected ? 'Google Sheets Terhubung (Siap Simpan Otomatis)' : 'Google Sheets Belum Terhubung'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isGoogleConnected ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-900'
                      }`}>
                        {isGoogleConnected ? 'Otomatis Masuk Row 9+' : 'Wajib Disambungkan'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      {isGoogleConnected ? (
                        <>
                          Akun aktif: <strong>{googleUser?.email}</strong>. Data form akan langsung masuk ke spreadsheet master: <strong>Rekapan Form</strong> (gid=0).
                        </>
                      ) : (
                        <>
                          Agar formulir Anda langsung masuk ke spreadsheet <strong>Rekapan Form</strong>, silakan klik tombol di samping untuk otorisasi Google (1x klik).
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {!isGoogleConnected ? (
                  <button
                    type="button"
                    disabled={isConnectingGoogle}
                    onClick={async () => {
                      setIsConnectingGoogle(true);
                      try {
                        await connectGoogle();
                      } catch (e: any) {
                        setValidationError(e?.message || 'Gagal menghubungkan akun Google.');
                      } finally {
                        setIsConnectingGoogle(false);
                      }
                    }}
                    className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center space-x-2 px-3.5 py-2 bg-white hover:bg-amber-100 text-slate-800 border border-amber-300 rounded-lg text-xs font-bold shadow-xs transition"
                  >
                    {isConnectingGoogle ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                      </svg>
                    )}
                    <span>{isConnectingGoogle ? 'Menghubungkan...' : 'Hubungkan Google Sekarang'}</span>
                  </button>
                ) : (
                  <a
                    href={SPREADSHEET_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-semibold transition"
                  >
                    <span>Buka Google Sheet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons & Local Draft Feedback */}
          <div className="space-y-2.5 pt-2">
            {validationError && (
              <div
                data-testid="bottom-validation-error"
                className="flex items-center space-x-2 bg-red-50 border border-red-300 text-red-900 text-xs px-4 py-3 rounded-xl font-medium"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {manualDraftFeedback && (
              <div
                data-testid="manual-draft-feedback-bottom"
                className="flex items-center justify-between bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs px-4 py-2.5 rounded-xl"
              >
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{manualDraftFeedback}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setManualDraftFeedback(null)}
                  className="text-emerald-700 hover:text-emerald-950 font-bold ml-3"
                >
                  &times;
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500">
                {!isOnline ? (
                  <span className="inline-flex items-center space-x-1.5 text-amber-800 font-semibold">
                    <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                    <span>Offline: isian tersimpan otomatis di Draft lokal</span>
                  </span>
                ) : draftSavedAt ? (
                  <span className="inline-flex items-center space-x-1.5 text-emerald-700 font-medium">
                    <BookmarkCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      Auto-draft aktif (tersimpan pukul{' '}
                      {new Date(draftSavedAt).toLocaleTimeString('id-ID')})
                    </span>
                  </span>
                ) : (
                  <span>Auto-draft aktif menyimpan isian Anda secara berkala.</span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleManualSaveDraft}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition"
                >
                  <BookmarkCheck className="w-4 h-4 text-emerald-700" />
                  <span>Simpan Draft</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLivePreview(true)}
                  className="px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
                >
                  Preview Form Fisik
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSubmitting ? 'Menyimpan & Menulis ke Sheet...' : 'Simpan & Ajukan Form'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Modal 1: Prompt Connect Google Before Save (Admin Only) */}
      {isAdmin && showPromptGoogle && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <Layers className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Hubungkan Akun Google Anda
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Anda belum menghubungkan akun Google. Untuk memastikan form <strong>{autoDocNumber}</strong> langsung masuk ke Google Sheet <strong>Rekap Form CLX</strong>, hubungkan akun Google Anda sekarang.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                disabled={isConnectingGoogle}
                onClick={async () => {
                  setIsConnectingGoogle(true);
                  try {
                    await connectGoogle();
                    setShowPromptGoogle(false);
                    await executeSave();
                  } catch (err: any) {
                    setValidationError(err?.message || 'Gagal login Google.');
                    setShowPromptGoogle(false);
                  } finally {
                    setIsConnectingGoogle(false);
                  }
                }}
                className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition"
              >
                {isConnectingGoogle ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                )}
                <span>{isConnectingGoogle ? 'Menghubungkan...' : 'Hubungkan Google & Simpan ke Sheet'}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  setShowPromptGoogle(false);
                  await executeSave();
                }}
                className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Simpan di Sistem Saja (Sinkronisasi Nanti)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Success Confirmation with Exact Google Sheet Row details */}
      {successModalDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 text-center animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-200 shadow-xs">
              <CheckCircle className="w-8 h-8" />
            </div>

            <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-900 text-[11px] font-bold uppercase rounded-full mb-2">
              Pengajuan Berhasil Disimpan
            </span>
            <h3 className="text-lg font-black text-slate-900">
              {successModalDoc.docNumber}
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              {successModalDoc.formType} • Divisi {successModalDoc.division} • Total: <strong>Rp {successModalDoc.totalAmount.toLocaleString('id-ID')}</strong>
            </p>

            {/* Google Sheets Sync Result Status */}
            <div
              data-testid="save-sheet-status"
              className={`mt-5 p-3.5 rounded-xl border text-left text-xs ${
                successModalDoc.googleSheets?.synced
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <div className="font-bold flex items-center space-x-1.5">
                <span>
                  {successModalDoc.googleSheets?.synced
                    ? `✅ Tersinkronisasi Otomatis ke Google Sheet (${successModalDoc.googleSheets.sheetName || 'Rekapan Form'})`
                    : '⚠️ Tersimpan di Portal (Belum Masuk ke Google Sheet)'}
                </span>
              </div>
              <p className="text-[11px] mt-1 leading-relaxed">
                {successModalDoc.googleSheets?.synced ? (
                  <>
                    Data pengajuan Anda telah otomatis tercatat di Spreadsheet <strong>{successModalDoc.googleSheets.sheetName || 'Rekapan Form'}</strong>
                    {successModalDoc.googleSheets.rowNumber ? ` (baris ${successModalDoc.googleSheets.rowNumber})` : ''} dan diteruskan ke alur persetujuan C-Level ({successModalDoc.currentAssigneeRole}).
                  </>
                ) : (
                  <>
                    Formulir berhasil tersimpan di portal CLX dan diteruskan ke <strong>{successModalDoc.currentAssigneeRole}</strong>.{' '}
                    {successModalDoc.googleSheets?.error ||
                      (isAdmin
                        ? 'Aktifkan Webhook Google Apps Script melalui tombol Auto-Sync Sheet di bar atas agar data otomatis tertulis ke Google Sheet.'
                        : 'Admin (clx.hartono17@gmail.com) perlu mengaktifkan Auto-Sync Webhook satu kali agar data terkirim otomatis ke Google Sheet.')}
                  </>
                )}
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      if (successModalDoc) {
                        const ok = await copyFormsToClipboard([successModalDoc]);
                        if (ok) {
                          setCopiedSingleDoc(true);
                          setTimeout(() => setCopiedSingleDoc(false), 3000);
                        }
                      }
                    }}
                    className="w-full sm:flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5 border border-slate-300"
                  >
                    {copiedSingleDoc ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                    <span>{copiedSingleDoc ? 'Tersalin ke Clipboard!' : '📋 Salin Baris (Paste ke B9)'}</span>
                  </button>

                  <a
                    href={SPREADSHEET_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5"
                  >
                    <span>Buka Sheet</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  const d = successModalDoc;
                  setSuccessModalDoc(null);
                  onSuccess(d);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
              >
                Ke Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
