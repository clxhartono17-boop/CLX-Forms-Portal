import React, { useState, useId } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useForms } from '../context/FormContext.tsx';
import { FormType, Division, FormItem, FormAttachment, FormDocument } from '../types/index.ts';
import { generateDocNumber } from '../utils/romanNumerals.ts';
import { terbilangRupiah } from '../utils/terbilang.ts';
import { PhysicalFormPreview } from './PhysicalFormPreview.tsx';
import { 
  Plus, 
  Trash2, 
  Upload, 
  Paperclip, 
  CheckCircle, 
  Eye, 
  FileEdit, 
  AlertCircle,
  Save
} from 'lucide-react';

interface FormCreatorProps {
  onSuccess: (createdDoc: FormDocument) => void;
  onCancel: () => void;
}

export const FormCreator: React.FC<FormCreatorProps> = ({ onSuccess, onCancel }) => {
  const { currentUser } = useAuth();
  const { getNextSequence, addForm } = useForms();
  const fileInputId = useId();

  const [formType, setFormType] = useState<FormType>('FPU');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [division, setDivision] = useState<Division>(currentUser?.division || 'Finance');
  const [requesterName, setRequesterName] = useState(currentUser?.name || '');
  const [requesterRole, setRequesterRole] = useState(currentUser?.title || '');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'Cash' | 'Giro / Cheque'>('Bank Transfer');
  const [bankName, setBankName] = useState('BCA (Bank Central Asia)');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountName, setBankAccountName] = useState(currentUser?.name || '');

  // Line items state (Diperbaiki dari syntax error sebelumnya)
  const [items, setItems] = useState<FormItem[]>([
    {
      id: 'item-1',
      description: '',
      qty: 1,
      unit: 'Lot',
      unitPrice: 0,
      total: 0,
    },
  ]);

  // Attachments
  const [attachments, setAttachments] = useState<FormAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

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
        const q = field === 'qty' ? parseFloat(val) || 0 : target.qty;
        const p = field === 'unitPrice' ? parseFloat(val) || 0 : target.unitPrice;
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

  const currentDraftDoc: FormDocument = {
    id: 'draft-temp',
    docNumber: autoDocNumber,
    formType,
    sequenceNumber: sequence,
    date: selectedDate,
    division,
    requesterName,
    requesterRole,
    requesterEmail: currentUser?.email || 'user@clx.co.id',
    purpose: purpose || '(Belum mengisi keperluan)',
    notes,
    paymentMethod,
    bankName,
    bankAccountNo,
    bankAccountName,
    items,
    totalAmount,
    terbilang: liveTerbilang,
    status: 'Pending Approval',
    currentAssigneeRole: 'CSO',
    signatures: {
      maker: {
        role: 'Staff',
        userName: requesterName,
        userTitle: requesterRole,
        signedAt: new Date().toISOString(),
        digitalHash: `SHA256-CLX-MKR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      },
    },
    attachments,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!purpose.trim()) {
      setValidationError('Harap isi Keperluan / Deskripsi Pengajuan.');
      return;
    }

    if (totalAmount <= 0) {
      setValidationError('Total pengajuan harus lebih dari Rp 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newDoc: FormDocument = {
        ...currentDraftDoc,
        id: `${formType.toLowerCase()}-${Date.now()}`,
      };

      const savedDoc = await addForm(newDoc);
      onSuccess(savedDoc);
    } catch (err: any) {
      setValidationError(err?.message || 'Gagal menyimpan dokumen. Silakan periksa kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

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

        <div className="flex items-center space-x-2">
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

      {validationError && (
        <div className="flex items-center space-x-2 bg-red-50 border border-red-200 text-red-800 text-xs px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {showLivePreview ? (
        <PhysicalFormPreview doc={currentDraftDoc} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Form Type Selector (PFB Diubah menjadi FPP) */}
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
                  type: 'FPP' as FormType, // Diubah dari PFB ke FPP
                  title: 'FPP',
                  subtitle: 'Form Permohonan Pembayaran',
                  desc: 'BBM Solar, Biaya Toll, Port Handling, Faktur Pajak',
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

          {/* 4. Line Items Table */}
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
                          min="1"
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
                          min="0"
                          step="1000"
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

          {/* 5. Attachments Section */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  5. Lampiran Dokumen & Integrasi Google Drive
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  File pendukung (PDF, JPG, PNG) akan digabungkan otomatis ke dalam satu single PDF dan diupload ke Google Drive.
                </p>
              </div>

              <div className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                Target Parent: 1hgUyTqNsfJsC30pY7O2kPS95DqEEySm9
              </div>
            </div>

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

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Batal
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
              <span>{isSubmitting ? 'Memproses & Sync Drive...' : 'Simpan & Ajukan Form'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
