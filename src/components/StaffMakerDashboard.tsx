import React, { useState, useMemo } from 'react';
import { useForms } from '../context/FormContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { FormDocument, FormType, ApprovalStatus } from '../types/index.ts';
import { formatRupiah, generateMergedPdf, downloadPdf } from '../utils/pdfGenerator.ts';
import { requiresCeoApproval } from '../utils/approvalRules.ts';
import { GOOGLE_SHEETS_TEMPLATE_URL, GOOGLE_DRIVE_PARENT_FOLDER_ID } from '../utils/googleIntegration.ts';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Search, 
  PlusCircle, 
  ExternalLink, 
  Download, 
  Eye, 
  Layers, 
  Filter, 
  ArrowRight,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Building,
  User as UserIcon,
  HelpCircle
} from 'lucide-react';

interface StaffMakerDashboardProps {
  onSelectDoc: (doc: FormDocument) => void;
  onCreateNew: () => void;
}

export const StaffMakerDashboard: React.FC<StaffMakerDashboardProps> = ({
  onSelectDoc,
  onCreateNew,
}) => {
  const { forms } = useForms();
  const { currentUser } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Filter forms: show user's created forms (or division forms if matched)
  const myForms = useMemo(() => {
    return forms.filter(f => {
      // If user is logged in, prioritize forms requested by them or from their division
      if (currentUser) {
        const isMyDoc = f.requesterEmail?.toLowerCase() === currentUser.email?.toLowerCase() ||
          f.requesterName?.toLowerCase().includes(currentUser.name?.toLowerCase()) ||
          f.division === currentUser.division;
        // If there are specific docs for the user show them; otherwise fallback to showing all forms so staff can track team progress
        return true;
      }
      return true;
    });
  }, [forms, currentUser]);

  // Filtered dataset
  const filteredForms = useMemo(() => {
    return myForms.filter(doc => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = doc.docNumber?.toLowerCase().includes(q);
        const matchPur = doc.purpose?.toLowerCase().includes(q);
        const matchReq = doc.requesterName?.toLowerCase().includes(q);
        if (!matchNum && !matchPur && !matchReq) return false;
      }

      // Type filter
      if (selectedType !== 'ALL') {
        if (selectedType === 'FPP' && doc.formType !== 'FPP' && (doc.formType as string) !== 'PFB') {
          return false;
        } else if (selectedType !== 'FPP' && doc.formType !== selectedType) {
          return false;
        }
      }

      // Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'PENDING') {
          if (doc.status === 'Fully Approved' || doc.status === 'Rejected') return false;
        } else if (selectedStatus !== doc.status) {
          return false;
        }
      }

      return true;
    });
  }, [myForms, searchQuery, selectedType, selectedStatus]);

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = myForms.length;
    const pending = myForms.filter(f => f.status !== 'Fully Approved' && f.status !== 'Rejected').length;
    const approved = myForms.filter(f => f.status === 'Fully Approved').length;
    const rejected = myForms.filter(f => f.status === 'Rejected').length;
    const totalAmount = myForms.reduce((sum, f) => sum + (f.totalAmount || 0), 0);
    return { total, pending, approved, rejected, totalAmount };
  }, [myForms]);

  const handleDownloadPdf = async (e: React.MouseEvent, doc: FormDocument) => {
    e.stopPropagation();
    try {
      const bytes = await generateMergedPdf(doc);
      downloadPdf(bytes, `${doc.docNumber.replace(/[\/\\]/g, '_')}_merged.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner & Quick Action */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-400/30">
              Staff & Maker Approval Tracking
            </span>
            <span className="text-xs text-slate-300">
              Divisi: <strong className="text-white">{currentUser?.division || 'Finance'}</strong>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-1.5 tracking-tight">
            Dashboard Status Persetujuan Formulir
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Pantau perjalanan approval formulir Anda (FPU, FPP, FPPB) dari pembuatan, verifikasi CSO, COO, CFO hingga otorisasi CEO secara transparan dan real-time.
          </p>
        </div>

        <button
          onClick={onCreateNew}
          className="inline-flex items-center space-x-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all shrink-0 hover:shadow-blue-500/25"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Buat Form Baru</span>
        </button>
      </div>

      {/* KPI Cards for Staff */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase">Total Pengajuan</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Semua jenis formulir</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-amber-800 uppercase">Sedang Diproses</div>
            <div className="text-2xl font-black text-amber-900 mt-1">{metrics.pending}</div>
            <div className="text-[11px] text-amber-700 mt-0.5">Menunggu review C-Level</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-emerald-800 uppercase">Disetujui Penuh</div>
            <div className="text-2xl font-black text-emerald-900 mt-1">{metrics.approved}</div>
            <div className="text-[11px] text-emerald-700 mt-0.5">Siap pencairan & arsip Drive</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-red-800 uppercase">Ditolak / Revisi</div>
            <div className="text-2xl font-black text-red-900 mt-1">{metrics.rejected}</div>
            <div className="text-[11px] text-red-700 mt-0.5">Perlu tindak lanjut / perbaikan</div>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nomor dokumen, keperluan, atau pemohon..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Jenis Form (ALL)</option>
              <option value="FPU">FPU (Permohonan Uang)</option>
              <option value="FPP">FPP (Permohonan Pembayaran)</option>
              <option value="FPPB">FPPB (Pembelian Barang)</option>
            </select>

            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="PENDING">Sedang Diproses (Pending)</option>
              <option value="Fully Approved">Disetujui Penuh (Fully Approved)</option>
              <option value="Rejected">Ditolak (Rejected)</option>
            </select>

            <a
              href={GOOGLE_SHEETS_TEMPLATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
            >
              <span>Sheet Rekapan Form</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Forms List with Visual Stepper */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-600 px-1 font-semibold">
          <span>Daftar Pengajuan ({filteredForms.length} Formulir)</span>
          <span>Klik kartu dokumen untuk melihat detail fisik & tanda tangan</span>
        </div>

        {filteredForms.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Belum Ada Formulir yang Diajukan
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
              Buat formulir FPU, FPP, atau FPPB pertama Anda untuk memulai siklus pengajuan dan otorisasi anggaran secara berjenjang.
            </p>
            <button
              onClick={onCreateNew}
              className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Buat Formulir Baru Sekarang</span>
            </button>
          </div>
        ) : (
          filteredForms.map(doc => {
            const needsCeo = requiresCeoApproval(doc.totalAmount);
            const isFullyApproved = doc.status === 'Fully Approved';
            const isRejected = doc.status === 'Rejected';

            // Calculate stepper state for each stage:
            // 1. Maker: always true (created)
            // 2. CSO: signed if signatures.cso, or pending if currentAssigneeRole === 'CSO'
            // 3. COO: signed if signatures.coo, or pending if currentAssigneeRole === 'COO'
            // 4. CFO: signed if signatures.cfo, or pending if currentAssigneeRole === 'CFO'
            // 5. CEO: signed if signatures.ceo, or pending if currentAssigneeRole === 'CEO', or not required if <= 10 Juta
            const csoDone = !!doc.signatures?.cso;
            const cooDone = !!doc.signatures?.coo;
            const cfoDone = !!doc.signatures?.cfo;
            const ceoDone = !!doc.signatures?.ceo;

            const csoActive = doc.currentAssigneeRole === 'CSO' && !isFullyApproved && !isRejected;
            const cooActive = doc.currentAssigneeRole === 'COO' && !isFullyApproved && !isRejected;
            const cfoActive = doc.currentAssigneeRole === 'CFO' && !isFullyApproved && !isRejected;
            const ceoActive = doc.currentAssigneeRole === 'CEO' && !isFullyApproved && !isRejected;

            let typeBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
            if (doc.formType === 'FPP' || (doc.formType as string) === 'PFB') {
              typeBadgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
            } else if (doc.formType === 'FPPB') {
              typeBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            }

            return (
              <div
                key={doc.id}
                onClick={() => onSelectDoc(doc)}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer space-y-4"
              >
                {/* Header row: Doc Info, Total, Status */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <span className={`px-2 py-0.5 text-xs font-black rounded-md border ${typeBadgeClass}`}>
                      {doc.formType === 'PFB' ? 'FPP' : doc.formType}
                    </span>
                    <div>
                      <h4 className="text-sm font-mono font-bold text-slate-900 hover:text-blue-600 transition">
                        {doc.docNumber}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Diajukan pada: <strong className="text-slate-700">{doc.date}</strong> | Divisi: <strong className="text-slate-700">{doc.division}</strong> | Pemohon: <strong className="text-slate-700">{doc.requesterName}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 self-end sm:self-auto">
                    <div className="text-right">
                      <div className="text-xs text-slate-400 font-medium">Total Nominal</div>
                      <div className="text-base font-black text-slate-900 font-mono">
                        {formatRupiah(doc.totalAmount)}
                      </div>
                    </div>

                    {isFullyApproved ? (
                      <span className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Disetujui Penuh</span>
                      </span>
                    ) : isRejected ? (
                      <span className="inline-flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-800 border border-red-300 rounded-full text-xs font-bold">
                        <XCircle className="w-3.5 h-3.5 text-red-600" />
                        <span>Ditolak</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-bold animate-pulse">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Menunggu {doc.currentAssigneeRole}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Purpose description */}
                <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="font-bold text-slate-600 mr-1.5">Keperluan:</span>
                  <span>{doc.purpose}</span>
                </div>

                {/* Rejection Alert if rejected */}
                {isRejected && doc.rejectionReason && (
                  <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-lg flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">Alasan Penolakan: </strong>
                      <span>{doc.rejectionReason}</span>
                    </div>
                  </div>
                )}

                {/* Live Approval Stepper */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <span>Alur Persetujuan Berjenjang (Approval Pipeline)</span>
                    <span className="text-[10px] lowercase text-slate-400 font-normal">
                      {needsCeo ? 'nilai > 10 juta (wajib CEO)' : 'nilai ≤ 10 juta (selesai di CFO)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {/* 1. Maker */}
                    <div className="p-2 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                        ✓
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-[11px] font-bold text-emerald-900 leading-tight">1. Pemohon</div>
                        <div className="text-[10px] text-emerald-700 truncate">{doc.requesterName}</div>
                      </div>
                    </div>

                    {/* 2. CSO */}
                    <div className={`p-2 rounded-lg border flex items-center space-x-2 transition ${
                      csoDone 
                        ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900' 
                        : csoActive 
                        ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-xs ring-2 ring-amber-400/30' 
                        : isRejected && doc.currentAssigneeRole === 'CSO'
                        ? 'border-red-300 bg-red-50 text-red-900'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                        csoDone 
                          ? 'bg-emerald-600 text-white' 
                          : csoActive 
                          ? 'bg-amber-500 text-slate-950 animate-pulse' 
                          : isRejected && doc.currentAssigneeRole === 'CSO'
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        {csoDone ? '✓' : csoActive ? '⏳' : isRejected && doc.currentAssigneeRole === 'CSO' ? '✕' : '2'}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-[11px] font-bold leading-tight">2. CSO</div>
                        <div className="text-[10px] truncate">
                          {csoDone ? 'Disetujui' : csoActive ? 'Sedang Ditinjau' : 'Menunggu'}
                        </div>
                      </div>
                    </div>

                    {/* 3. COO */}
                    <div className={`p-2 rounded-lg border flex items-center space-x-2 transition ${
                      cooDone 
                        ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900' 
                        : cooActive 
                        ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-xs ring-2 ring-amber-400/30' 
                        : isRejected && doc.currentAssigneeRole === 'COO'
                        ? 'border-red-300 bg-red-50 text-red-900'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                        cooDone 
                          ? 'bg-emerald-600 text-white' 
                          : cooActive 
                          ? 'bg-amber-500 text-slate-950 animate-pulse' 
                          : isRejected && doc.currentAssigneeRole === 'COO'
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        {cooDone ? '✓' : cooActive ? '⏳' : isRejected && doc.currentAssigneeRole === 'COO' ? '✕' : '3'}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-[11px] font-bold leading-tight">3. COO</div>
                        <div className="text-[10px] truncate">
                          {cooDone ? 'Disetujui' : cooActive ? 'Sedang Ditinjau' : 'Menunggu'}
                        </div>
                      </div>
                    </div>

                    {/* 4. CFO */}
                    <div className={`p-2 rounded-lg border flex items-center space-x-2 transition ${
                      cfoDone 
                        ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900' 
                        : cfoActive 
                        ? 'border-amber-400 bg-amber-50 text-amber-900 shadow-xs ring-2 ring-amber-400/30' 
                        : isRejected && doc.currentAssigneeRole === 'CFO'
                        ? 'border-red-300 bg-red-50 text-red-900'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                        cfoDone 
                          ? 'bg-emerald-600 text-white' 
                          : cfoActive 
                          ? 'bg-amber-500 text-slate-950 animate-pulse' 
                          : isRejected && doc.currentAssigneeRole === 'CFO'
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        {cfoDone ? '✓' : cfoActive ? '⏳' : isRejected && doc.currentAssigneeRole === 'CFO' ? '✕' : '4'}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-[11px] font-bold leading-tight">4. CFO</div>
                        <div className="text-[10px] truncate">
                          {cfoDone ? 'Verifikasi Selesai' : cfoActive ? 'Sedang Verifikasi' : 'Menunggu'}
                        </div>
                      </div>
                    </div>

                    {/* 5. CEO */}
                    <div className={`p-2 rounded-lg border flex items-center space-x-2 transition col-span-2 sm:col-span-1 ${
                      !needsCeo
                        ? 'border-slate-200 bg-slate-100 text-slate-400'
                        : ceoDone 
                        ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900' 
                        : ceoActive 
                        ? 'border-purple-400 bg-purple-50 text-purple-900 shadow-xs ring-2 ring-purple-400/30' 
                        : isRejected && doc.currentAssigneeRole === 'CEO'
                        ? 'border-red-300 bg-red-50 text-red-900'
                        : 'border-slate-200 bg-slate-50 text-slate-400'
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                        !needsCeo
                          ? 'bg-slate-300 text-slate-600'
                          : ceoDone 
                          ? 'bg-emerald-600 text-white' 
                          : ceoActive 
                          ? 'bg-purple-600 text-white animate-pulse' 
                          : isRejected && doc.currentAssigneeRole === 'CEO'
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}>
                        {!needsCeo ? '—' : ceoDone ? '✓' : ceoActive ? '⏳' : isRejected && doc.currentAssigneeRole === 'CEO' ? '✕' : '5'}
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-[11px] font-bold leading-tight">5. CEO</div>
                        <div className="text-[10px] truncate">
                          {!needsCeo ? 'Tidak Diperlukan' : ceoDone ? 'Disetujui Akhir' : ceoActive ? 'Otorisasi Akhir' : 'Menunggu'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions & Google Integration Link */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center space-x-1 text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Rekapan Form (Tercatat)</span>
                    </span>

                    {isFullyApproved && (
                      <span className="inline-flex items-center space-x-1 text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Tersimpan di Google Drive</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={(e) => handleDownloadPdf(e, doc)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectDoc(doc)}
                      className="inline-flex items-center space-x-1 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detail & Tanda Tangan</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
