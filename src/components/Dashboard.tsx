import React, { useState, useMemo } from 'react';
import { useForms } from '../context/FormContext.tsx';
import { FormDocument, FormType, Division, ApprovalStatus } from '../types/index.ts';
import { formatRupiah, generateOfficialFormPdf, generateMergedPdf, downloadPdf } from '../utils/pdfGenerator.ts';
import { GOOGLE_SHEETS_TEMPLATE_URL, GOOGLE_DRIVE_PARENT_FOLDER_ID, SHEET_TAB_REKAPAN_FORM } from '../utils/googleIntegration.ts';
import { DashboardCharts } from './DashboardCharts.tsx';
import { 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  FileText, 
  Paperclip, 
  Eye, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  ExternalLink,
  PlusCircle,
  FileSpreadsheet,
  RotateCcw,
  BarChart2
} from 'lucide-react';

interface DashboardProps {
  onSelectDoc: (doc: FormDocument) => void;
  onCreateNew: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectDoc, onCreateNew }) => {
  const { forms, resetToDefault } = useForms();

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormType, setSelectedFormType] = useState<string>('ALL');
  const [selectedDivision, setSelectedDivision] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Filtered dataset
  const filteredForms = useMemo(() => {
    return forms.filter(doc => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDoc = doc.docNumber.toLowerCase().includes(q);
        const matchReq = doc.requesterName.toLowerCase().includes(q);
        const matchPur = doc.purpose.toLowerCase().includes(q);
        if (!matchDoc && !matchReq && !matchPur) return false;
      }

      // Form Type
      if (selectedFormType !== 'ALL' && doc.formType !== selectedFormType) {
        return false;
      }

      // Division
      if (selectedDivision !== 'ALL' && doc.division !== selectedDivision) {
        return false;
      }

      // Status
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'PENDING' && !doc.status.startsWith('Pending') && !doc.status.startsWith('Approved by')) {
          return false;
        } else if (selectedStatus !== 'PENDING' && doc.status !== selectedStatus) {
          return false;
        }
      }

      // Date Range: Start Date to End Date
      if (startDate && doc.date < startDate) {
        return false;
      }
      if (endDate && doc.date > endDate) {
        return false;
      }

      return true;
    });
  }, [forms, searchQuery, selectedFormType, selectedDivision, selectedStatus, startDate, endDate]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalDocs = forms.length;
    const totalVal = forms.reduce((acc, f) => acc + (f.totalAmount || 0), 0);
    const pendingCount = forms.filter(f => f.status !== 'Fully Approved' && f.status !== 'Rejected').length;
    const approvedCount = forms.filter(f => f.status === 'Fully Approved').length;
    const rejectedCount = forms.filter(f => f.status === 'Rejected').length;
    return { totalDocs, totalVal, pendingCount, approvedCount, rejectedCount };
  }, [forms]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedFormType('ALL');
    setSelectedDivision('ALL');
    setSelectedStatus('ALL');
    setStartDate('');
    setEndDate('');
  };

  const handleQuickDownloadMerged = async (e: React.MouseEvent, doc: FormDocument) => {
    e.stopPropagation();
    try {
      const bytes = await generateMergedPdf(doc);
      downloadPdf(bytes, `${doc.docNumber.replace(/[\/\\]/g, '_')}_merged.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Document Number',
      'Date',
      'Type',
      'Division',
      'Requester',
      'Purpose',
      'Total Amount (IDR)',
      'Status',
      'Drive Folder Path',
    ];
    const rows = filteredForms.map(f => [
      `"${f.docNumber}"`,
      `"${f.date}"`,
      `"${f.formType}"`,
      `"${f.division}"`,
      `"${f.requesterName}"`,
      `"${f.purpose.replace(/"/g, '""')}"`,
      f.totalAmount,
      `"${f.status}"`,
      `"${f.googleDrive?.folderPath || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CLX_Forms_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase">Total Dokumen</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{metrics.totalDocs}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">FPU, PFB, dan FPPB</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 lg:col-span-1">
          <div className="text-xs font-semibold text-slate-500 uppercase">Total Nilai Pengajuan</div>
          <div className="text-lg font-black text-blue-900 mt-1 truncate">
            {formatRupiah(metrics.totalVal)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Akumulasi Seluruh Divisi</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <div className="text-xs font-semibold text-amber-800 uppercase flex items-center justify-between">
            <span>Pending Approval</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-900 mt-1">{metrics.pendingCount}</div>
          <div className="text-[11px] text-amber-700/80 mt-0.5">Menunggu C-Level</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="text-xs font-semibold text-emerald-800 uppercase flex items-center justify-between">
            <span>Disetujui Penuh</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-1">{metrics.approvedCount}</div>
          <div className="text-[11px] text-emerald-700/80 mt-0.5">Siap Pencairan Kas</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-red-600 uppercase flex items-center justify-between">
            <span>Ditolak</span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div className="text-2xl font-black text-red-900 mt-1">{metrics.rejectedCount}</div>
          <div className="text-[11px] text-red-700/70 mt-0.5">Revisi Diperlukan</div>
        </div>
      </div>

      {/* Visual Analytics & Charts Section */}
      <DashboardCharts
        forms={forms}
        onFilterDivision={div => setSelectedDivision(div)}
        onFilterFormType={ft => setSelectedFormType(ft)}
        onFilterStatus={st => setSelectedStatus(st)}
      />

      {/* Filter and Period Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan nomor dokumen, pemohon, atau keperluan..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <a
              href={GOOGLE_SHEETS_TEMPLATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Google Sheets (Rekapan Form)</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>

            <button
              onClick={onCreateNew}
              className="inline-flex items-center space-x-1 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Buat Form Baru</span>
            </button>
          </div>
        </div>

        {/* Date Period & Dropdown Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1 border-t border-slate-100">
          {/* Date Period: Start Date to End Date */}
          <div className="flex items-center space-x-1.5 col-span-1 sm:col-span-2">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                Periode Awal (Start Date)
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-800"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                Periode Akhir (End Date)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-800"
              />
            </div>
          </div>

          {/* Form Type Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
              Jenis Form
            </label>
            <select
              value={selectedFormType}
              onChange={e => setSelectedFormType(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-800 font-medium"
            >
              <option value="ALL">Semua Jenis (ALL)</option>
              <option value="FPU">FPU (Permohonan Uang)</option>
              <option value="PFB">PFB (Faktur Biaya)</option>
              <option value="FPPB">FPPB (Pembelian Barang)</option>
            </select>
          </div>

          {/* Division Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
              Divisi
            </label>
            <select
              value={selectedDivision}
              onChange={e => setSelectedDivision(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-800 font-medium"
            >
              <option value="ALL">Semua Divisi (ALL)</option>
              <option value="Project">Project</option>
              <option value="Operation">Operation</option>
              <option value="Services">Services</option>
              <option value="General">General</option>
              <option value="Finance">Finance</option>
            </select>
          </div>

          {/* Status & Reset */}
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">
                Status
              </label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-800 font-medium"
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Pending (Dalam Proses)</option>
                <option value="Fully Approved">Fully Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <button
              onClick={handleResetFilters}
              title="Reset Filters"
              className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Forms Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Daftar Formulir Terdaftar ({filteredForms.length} Dokumen)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Klik baris untuk melihat pratinjau detail atau mengunduh PDF gabungan
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200 text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3">No. Dokumen</th>
                <th className="py-3 px-3">Tanggal</th>
                <th className="py-3 px-3">Divisi</th>
                <th className="py-3 px-3">Pemohon</th>
                <th className="py-3 px-3">Keperluan / Deskripsi</th>
                <th className="py-3 px-3 text-right">Nilai (Rp)</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Assignee</th>
                <th className="py-3 px-3 text-center">Drive & Sheets</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredForms.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 text-xs">
                    Tidak ada formulir yang sesuai dengan filter atau periode yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredForms.map(doc => {
                  let badgeBg = 'bg-slate-100 text-slate-700';
                  if (doc.status === 'Fully Approved') {
                    badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                  } else if (doc.status === 'Rejected') {
                    badgeBg = 'bg-red-100 text-red-800 border-red-300';
                  } else if (doc.status.startsWith('Approved by')) {
                    badgeBg = 'bg-blue-100 text-blue-800 border-blue-300';
                  } else if (doc.status === 'Pending Approval') {
                    badgeBg = 'bg-amber-100 text-amber-800 border-amber-300';
                  }

                  let typeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                  if (doc.formType === 'PFB') typeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
                  if (doc.formType === 'FPPB') typeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => onSelectDoc(doc)}
                      className="hover:bg-slate-50/80 cursor-pointer transition"
                    >
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        <div className="flex items-center space-x-1.5">
                          <span className={`px-1.5 py-0.5 text-[10px] font-black rounded border ${typeColor}`}>
                            {doc.formType}
                          </span>
                          <span className="truncate max-w-[170px]">{doc.docNumber}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium whitespace-nowrap">
                        {doc.date}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {doc.division}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-800">
                        {doc.requesterName}
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-[220px] truncate" title={doc.purpose}>
                        {doc.purpose}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatRupiah(doc.totalAmount)}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeBg}`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                          {doc.currentAssigneeRole}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1">
                          {/* Google Drive Status */}
                          <span
                            title={`Google Drive: ${doc.googleDrive?.folderPath || 'Synced'}`}
                            className="p-1 rounded text-blue-600 hover:bg-blue-50 cursor-pointer"
                          >
                            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block mr-1"></span>
                            <span className="text-[10px] font-bold">Drive</span>
                          </span>

                          {/* Google Sheets Status */}
                          <span
                            title={`Google Sheets Tab: ${doc.formType}`}
                            className="p-1 rounded text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block mr-1"></span>
                            <span className="text-[10px] font-bold">Sheets</span>
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onSelectDoc(doc);
                            }}
                            title="Lihat Detail Form"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={e => handleQuickDownloadMerged(e, doc)}
                            title="Download Merged PDF (Form + Lampiran)"
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
