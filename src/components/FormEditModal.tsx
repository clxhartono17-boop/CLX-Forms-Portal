import React, { useState, useEffect } from 'react';
import { FormDocument, FormType, Division, FormItem } from '../types/index.ts';
import { useForms } from '../context/FormContext.tsx';
import { formatRupiah } from '../utils/pdfGenerator.ts';
import { terbilangRupiah } from '../utils/terbilang.ts';
import { requiresCeoApproval } from '../utils/approvalRules.ts';
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  Edit3, 
  AlertCircle
} from 'lucide-react';

interface FormEditModalProps {
  doc: FormDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updatedDoc: FormDocument) => void;
}

export const FormEditModal: React.FC<FormEditModalProps> = ({
  doc,
  isOpen,
  onClose,
  onSaved,
}) => {
  const { updateForm, deleteForm } = useForms();

  const [formType, setFormType] = useState<FormType>('FPP');
  const [date, setDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [division, setDivision] = useState<Division>('Finance');
  const [requesterName, setRequesterName] = useState('');
  const [requesterRole, setRequesterRole] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'Cash' | 'Giro / Cheque'>('Bank Transfer');
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [settlementDate, setSettlementDate] = useState('');
  const [lineItems, setLineItems] = useState<FormItem[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (doc) {
      setFormType(doc.formType === 'PFB' ? 'FPP' : doc.formType);
      setDate(doc.date || '');
      setTargetDate(doc.targetDate || doc.date || '');
      setDivision(doc.division);
      setRequesterName(doc.requesterName);
      setRequesterRole(doc.requesterRole || '');
      setPurpose(doc.purpose);
      setNotes(doc.notes || '');
      setPaymentMethod(doc.paymentMethod || 'Bank Transfer');
      setBankName(doc.bankName || '');
      setBankAccountNo(doc.bankAccountNo || '');
      setBankAccountName(doc.bankAccountName || '');
      setSettlementDate(doc.settlementDate || '');
      
      if (doc.items && doc.items.length > 0) {
        setLineItems(doc.items.map(it => ({ ...it })));
      } else {
        setLineItems([
          {
            id: 'item-1',
            description: doc.purpose || 'Pengajuan',
            qty: 1,
            unit: 'Unit',
            unitPrice: doc.totalAmount || 0,
            total: doc.totalAmount || 0,
          }
        ]);
      }
      setValidationError(null);
      setConfirmDelete(false);
    }
  }, [doc, isOpen]);

  if (!isOpen || !doc) return null;

  // Calculate live totals
  const totalAmount = lineItems.reduce((acc, item) => acc + (Number(item.total) || 0), 0);
  const liveTerbilang = terbilangRupiah(totalAmount);
  const needsCeo = requiresCeoApproval(totalAmount);

  const handleItemChange = (index: number, field: keyof FormItem, value: any) => {
    setLineItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index], [field]: value };

      if (field === 'qty' || field === 'unitPrice') {
        const qty = field === 'qty' ? Number(value) || 0 : Number(target.qty) || 0;
        const price = field === 'unitPrice' ? Number(value) || 0 : Number(target.unitPrice) || 0;
        target.qty = qty;
        target.unitPrice = price;
        target.total = qty * price;
      }

      copy[index] = target;
      return copy;
    });
  };

  const handleAddItem = () => {
    setLineItems(prev => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        description: '',
        qty: 1,
        unit: 'Pcs',
        unitPrice: 0,
        total: 0,
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (lineItems.length === 1) {
      setValidationError('Minimal harus ada 1 baris item perincian.');
      return;
    }
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!purpose.trim()) {
      setValidationError('Harap isi Keperluan / Perincian Pengeluaran.');
      return;
    }

    if (totalAmount <= 0) {
      setValidationError('Total nilai pengajuan harus lebih dari Rp 0.');
      return;
    }

    setIsSaving(true);
    try {
      const updatedDoc: FormDocument = {
        ...doc,
        formType,
        date,
        targetDate: targetDate || undefined,
        settlementDate: formType === 'FPU' ? (settlementDate || undefined) : undefined,
        division,
        requesterName,
        requesterRole,
        purpose: purpose.trim(),
        notes: notes.trim(),
        paymentMethod,
        bankName: paymentMethod === 'Cash' ? undefined : bankName,
        bankAccountNo: paymentMethod === 'Cash' ? undefined : bankAccountNo,
        bankAccountName: paymentMethod === 'Cash' ? undefined : bankAccountName,
        items: lineItems,
        totalAmount,
        terbilang: liveTerbilang,
        updatedAt: new Date().toISOString(),
      };

      // Save to context (which automatically pushes to Google Sheet backend)
      updateForm(updatedDoc);

      if (onSaved) onSaved(updatedDoc);
      onClose();
    } catch (err: any) {
      setValidationError(err?.message || 'Gagal menyimpan perubahan formulir.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-300 flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Edit Formulir Pengajuan
                </h2>
                <span className="font-mono text-xs font-bold bg-blue-600/60 px-2 py-0.5 rounded text-blue-200">
                  {doc.docNumber}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Perubahan data otomatis tersimpan dan terupdate di Google Sheet backend
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Tutup modal edit"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-900 rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* 1. Header Information Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label htmlFor="edit-form-type" className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Jenis Formulir
              </label>
              <select
                id="edit-form-type"
                value={formType}
                onChange={e => setFormType(e.target.value as FormType)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
              >
                <option value="FPU">FPU (Permohonan Uang)</option>
                <option value="FPP">FPP (Permohonan Pembayaran)</option>
                <option value="FPPB">FPPB (Pembelian Barang)</option>
              </select>
            </div>

            <div>
              <label htmlFor="edit-division" className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Divisi / Dept
              </label>
              <select
                id="edit-division"
                value={division}
                onChange={e => setDivision(e.target.value as Division)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
              >
                <option value="Project">Project</option>
                <option value="Operation">Operation</option>
                <option value="Services">Services</option>
                <option value="General">General</option>
                <option value="Finance">Finance</option>
              </select>
            </div>

            <div>
              <label htmlFor="edit-target-date" className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Tgl Dibutuhkan
              </label>
              <input
                id="edit-target-date"
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-800"
              />
            </div>
          </div>

          {/* 2. Keperluan / Deskripsi */}
          <div>
            <label htmlFor="edit-purpose" className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
              Keperluan / Perincian Pengeluaran <span className="text-red-500">*</span>
            </label>
            <textarea
              id="edit-purpose"
              rows={2}
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder="Jelaskan tujuan pengajuan secara lengkap..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* 3. Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Rincian Biaya / Barang ({lineItems.length} Item)
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[10px] uppercase font-bold">
                  <tr>
                    <th className="py-2 px-3 w-10">No</th>
                    <th className="py-2 px-3">Uraian / Deskripsi</th>
                    <th className="py-2 px-3 w-20 text-center">Qty</th>
                    <th className="py-2 px-3 w-24">Satuan</th>
                    <th className="py-2 px-3 w-32 text-right">Harga Satuan</th>
                    <th className="py-2 px-3 w-36 text-right">Subtotal</th>
                    <th className="py-2 px-3 w-12 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td className="py-2 px-3 font-bold text-slate-500 text-center">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          aria-label={`Deskripsi item ${idx + 1}`}
                          value={item.description}
                          onChange={e => handleItemChange(idx, 'description', e.target.value)}
                          placeholder="Deskripsi item..."
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-medium text-slate-800"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          aria-label={`Jumlah item ${idx + 1}`}
                          min="1"
                          value={item.qty}
                          onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-medium text-slate-800 text-center"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          aria-label={`Satuan item ${idx + 1}`}
                          value={item.unit}
                          onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-medium text-slate-800"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          aria-label={`Harga satuan item ${idx + 1}`}
                          min="0"
                          value={item.unitPrice}
                          onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-800 text-right"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-blue-900">
                        {formatRupiah(item.total)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          aria-label={`Hapus baris item ${idx + 1}`}
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Summary Row */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Terbilang</span>
                <span className="text-xs font-semibold text-slate-700 italic">
                  "{liveTerbilang}"
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Nilai Formulir</span>
                <span className="text-lg font-black text-blue-900 font-mono">
                  {formatRupiah(totalAmount)}
                </span>
                <span className="text-[10px] block mt-0.5 text-slate-500">
                  {needsCeo ? 'Level: Wajib CEO (> Rp 10 Juta)' : 'Level: Selesai di CFO (≤ Rp 10 Juta)'}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Payment Method & Bank Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label htmlFor="edit-payment-method" className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Metode Pembayaran
              </label>
              <select
                id="edit-payment-method"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash / Kas Tunai</option>
                <option value="Giro / Cheque">Giro / Cheque</option>
              </select>
            </div>

            {paymentMethod !== 'Cash' && (
              <>
                <div>
                  <label htmlFor="edit-bank-name" className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Nama Bank
                  </label>
                  <input
                    id="edit-bank-name"
                    type="text"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    placeholder="BCA / Mandiri / BRI..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label htmlFor="edit-bank-no" className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Nomor Rekening
                  </label>
                  <input
                    id="edit-bank-no"
                    type="text"
                    value={bankAccountNo}
                    onChange={e => setBankAccountNo(e.target.value)}
                    placeholder="8830192831..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label htmlFor="edit-bank-holder" className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Atas Nama (a.n)
                  </label>
                  <input
                    id="edit-bank-holder"
                    type="text"
                    value={bankAccountName}
                    onChange={e => setBankAccountName(e.target.value)}
                    placeholder="Nama pemilik rekening..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-800"
                  />
                </div>
              </>
            )}
          </div>

          {/* 5. Catatan Tambahan */}
          <div>
            <label htmlFor="edit-notes" className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
              Catatan / Keterangan
            </label>
            <input
              id="edit-notes"
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Catatan tambahan bila diperlukan..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium"
            />
          </div>

          {/* Modal Action Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={isSaving}
                className="inline-flex items-center space-x-1.5 px-3 py-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-bold rounded-xl transition"
                title="Hapus formulir ini dari web dan spreadsheet backend"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Formulir</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
                <span className="text-[11px] font-bold text-red-800">Yakin hapus permanen?</span>
                <button
                  type="button"
                  onClick={() => {
                    deleteForm(doc.id);
                    onClose();
                  }}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-lg transition"
                >
                  Ya, Hapus
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-semibold rounded-lg transition"
                >
                  Batal
                </button>
              </div>
            )}

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center space-x-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
