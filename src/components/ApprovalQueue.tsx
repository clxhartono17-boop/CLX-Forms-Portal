import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useForms } from '../context/FormContext.tsx';
import { FormDocument, UserRole } from '../types/index.ts';
import { formatRupiah, generateMergedPdf, downloadPdf } from '../utils/pdfGenerator.ts';
import { requiresCeoApproval, CEO_APPROVAL_THRESHOLD } from '../utils/approvalRules.ts';
import { PhysicalFormPreview } from './PhysicalFormPreview.tsx';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  ShieldCheck, 
  Download, 
  AlertCircle,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react';

export const ApprovalQueue: React.FC = () => {
  const { currentUser, currentRole, switchRegisteredUser, registeredUsers } = useAuth();
  const { forms, approveForm, rejectForm, getPendingApprovalsForRole } = useForms();

  const [activeTab, setActiveTab] = useState<'my_pending' | 'all_pending'>('my_pending');
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<FormDocument | null>(null);
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isStaff = currentRole === 'Staff';
  const myPendingList = currentRole ? getPendingApprovalsForRole(currentRole) : [];
  const allPendingList = forms.filter(f => f.status !== 'Fully Approved' && f.status !== 'Rejected');

  const displayedList = activeTab === 'my_pending' ? myPendingList : allPendingList;

  const handleApprove = async (doc: FormDocument) => {
    setActionError(null);
    if (!currentUser) return;
    try {
      await approveForm(doc.id, {
        role: currentUser.role,
        name: currentUser.name,
        title: currentUser.title,
      });
      setActionSuccess(`Dokumen ${doc.docNumber} berhasil disetujui & stempel digital resmi dibubuhkan.`);
      setTimeout(() => setActionSuccess(null), 4000);
      if (selectedDocForPreview?.id === doc.id) {
        setSelectedDocForPreview(null);
      }
    } catch (err: any) {
      setActionError(err.message || 'Gagal menyetujui dokumen.');
      setTimeout(() => setActionError(null), 5000);
    }
  };

  const handleConfirmReject = async (docId: string) => {
    setActionError(null);
    if (!rejectionReason.trim() || !currentUser) return;
    try {
      await rejectForm(docId, rejectionReason, {
        role: currentUser.role,
        name: currentUser.name,
      });
      setRejectingDocId(null);
      setRejectionReason('');
      setActionSuccess('Pengajuan berhasil ditolak dan status diperbarui di Google Sheets "Rekapan Form".');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || 'Gagal menolak dokumen.');
    }
  };

  const handleDownloadMerged = async (doc: FormDocument) => {
    try {
      const bytes = await generateMergedPdf(doc);
      downloadPdf(bytes, `${doc.docNumber.replace(/[\/\\]/g, '_')}_merged.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner & Active User Info */}
      <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-blue-600 text-white">
              C-Level Executive Approval Portal
            </span>
            <span className="text-xs text-slate-400">
              Akun Login: <strong className="text-white">{currentUser?.name || '-'} ({currentUser?.role || '-'})</strong>
            </span>
          </div>
          <h2 className="text-base font-bold text-white mt-1">
            Menu Persetujuan Dokumen & Pembubuhan Tanda Tangan Digital
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Sesuai SOP CLX: Dokumen &le; Rp 10 Juta cukup disetujui s/d CFO. Nilai di atas Rp 10 Juta wajib otorisasi akhir CEO.
          </p>
        </div>

        {/* Quick Switch between Registered Accounts from Master Login */}
        <div className="flex items-center space-x-2 bg-slate-800 p-2 rounded-lg border border-slate-700 text-xs">
          <Shield className="w-4 h-4 text-blue-400" />
          <span className="text-slate-300 font-semibold hidden sm:inline">Ganti Akun:</span>
          <select
            value={currentUser?.id || ''}
            onChange={e => switchRegisteredUser(e.target.value)}
            className="bg-slate-900 text-blue-300 font-bold px-2 py-1 rounded border border-slate-700 focus:outline-none"
          >
            {registeredUsers.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionSuccess && (
        <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-lg">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="flex items-center space-x-2 bg-red-50 border border-red-200 text-red-800 text-xs px-4 py-3 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {isStaff ? (
        <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
          <h3 className="text-sm font-bold text-amber-900">
            Peran Anda saat ini adalah Staff (Maker)
          </h3>
          <p className="text-xs text-amber-700 max-w-lg mx-auto">
            Menu "Pending Approvals" dikhususkan untuk akun eksekutif C-Level (CSO, COO, CFO, CEO) untuk memvalidasi dan membubuhkan stempel digital.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-2">
            {registeredUsers
              .filter(u => u.role !== 'Staff')
              .map(u => (
                <button
                  key={u.id}
                  onClick={() => switchRegisteredUser(u.id)}
                  className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-lg transition"
                >
                  Beralih ke akun {u.name} ({u.role})
                </button>
              ))}
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setActiveTab('my_pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'my_pending'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Menunggu Persetujuan Saya ({myPendingList.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('all_pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'all_pending'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Semua Antrean Dokumen ({allPendingList.length})</span>
            </button>
          </div>

          {/* Pending Items List */}
          {displayedList.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
              <div className="text-sm font-bold text-slate-800">
                Tidak ada dokumen yang menunggu persetujuan
              </div>
              <p className="text-xs text-slate-500">
                Semua pengajuan yang dialihkan ke peran {currentRole} telah selesai diproses.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedList.map(doc => {
                const canCurrentRoleApprove = doc.currentAssigneeRole === currentRole;
                const needsCeo = requiresCeoApproval(doc.totalAmount);

                return (
                  <div
                    key={doc.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-100 text-blue-900 border border-blue-200">
                              {doc.formType}
                            </span>
                            <h3 className="font-mono font-bold text-slate-900 text-sm">
                              {doc.docNumber}
                            </h3>
                            <span className="text-xs text-slate-400">|</span>
                            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                              Divisi: {doc.division}
                            </span>

                            {/* Limit Approval Badge */}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                needsCeo
                                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}
                            >
                              {needsCeo ? 'Nilai > 10 Jt (Wajib Otorisasi CEO)' : 'Nilai \u2264 10 Jt (Otorisasi Maks. s/d CFO)'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Diajukan oleh: <strong className="text-slate-800">{doc.requesterName}</strong> ({doc.requesterRole}) pada {doc.date}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[11px] font-semibold text-slate-400 uppercase">
                            Total Nilai
                          </div>
                          <div className="text-base font-black text-blue-950 font-mono">
                            {formatRupiah(doc.totalAmount)}
                          </div>
                        </div>
                      </div>

                      {/* Purpose & Terbilang */}
                      <div className="my-3 space-y-1">
                        <div className="text-xs font-medium text-slate-800">
                          <span className="font-bold text-slate-600">Keperluan: </span>
                          {doc.purpose}
                        </div>
                        <div className="text-[11px] italic text-blue-900 bg-blue-50/60 px-2.5 py-1 rounded border border-blue-100">
                          Terbilang: # {doc.terbilang} #
                        </div>
                      </div>

                      {/* Approval Pipeline Progression Visual */}
                      <div className="my-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center justify-between">
                          <span>Tahapan Persetujuan Eksekutif:</span>
                          <span className="text-slate-400 font-normal">
                            {needsCeo ? 'Alur 5 Tingkat (s/d CEO)' : 'Alur 4 Tingkat (s/d CFO Selesai)'}
                          </span>
                        </div>
                        <div className={`grid ${needsCeo ? 'grid-cols-5' : 'grid-cols-4'} gap-2 text-center text-[10px]`}>
                          {[
                            { role: 'Maker', name: doc.requesterName, done: !!doc.signatures.maker },
                            { role: 'CSO', name: 'CSO Strategy', done: !!doc.signatures.cso },
                            { role: 'COO', name: 'COO Operation', done: !!doc.signatures.coo },
                            { role: 'CFO', name: 'CFO Finance', done: !!doc.signatures.cfo },
                            ...(needsCeo
                              ? [{ role: 'CEO', name: 'CEO Approval', done: !!doc.signatures.ceo }]
                              : []),
                          ].map((step, idx) => (
                            <div
                              key={idx}
                              className={`p-1.5 rounded border ${
                                step.done
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                                  : doc.currentAssigneeRole === step.role
                                  ? 'bg-amber-50 border-amber-300 text-amber-800 font-bold ring-1 ring-amber-400'
                                  : 'bg-white border-slate-200 text-slate-400'
                              }`}
                            >
                              <div className="flex items-center justify-center space-x-1">
                                {step.done ? (
                                  <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                                ) : (
                                  <Clock className="w-2.5 h-2.5 text-slate-400" />
                                )}
                                <span>{step.role}</span>
                              </div>
                              <div className="text-[8px] truncate mt-0.5 font-normal">
                                {step.done ? 'Signed' : doc.currentAssigneeRole === step.role ? 'Waiting' : '-'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() =>
                              setSelectedDocForPreview(
                                selectedDocForPreview?.id === doc.id ? null : doc
                              )
                            }
                            className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>
                              {selectedDocForPreview?.id === doc.id
                                ? 'Tutup Preview Form'
                                : 'Pratinjau Form Fisik'}
                            </span>
                          </button>

                          <button
                            onClick={() => handleDownloadMerged(doc)}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Merged PDF</span>
                          </button>
                        </div>

                        {canCurrentRoleApprove ? (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setRejectingDocId(doc.id)}
                              className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Tolak Pengajuan</span>
                            </button>

                            <button
                              onClick={() => handleApprove(doc)}
                              className="inline-flex items-center space-x-1 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>
                                {currentRole === 'CFO' && !needsCeo
                                  ? 'Setujui & Finalisasi Pencairan (CFO - Selesai)'
                                  : `Setujui & Bubuhkan Stempel (${currentRole})`}
                              </span>
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic">
                            Menunggu otorisasi peran <strong className="text-slate-600">{doc.currentAssigneeRole}</strong>
                          </div>
                        )}
                      </div>

                      {/* Rejection Reason Form */}
                      {rejectingDocId === doc.id && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg space-y-2">
                          <label className="block text-xs font-bold text-red-800">
                            Alasan Penolakan Dokumen:
                          </label>
                          <textarea
                            rows={2}
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            placeholder="Tuliskan catatan revisi atau alasan pengajuan ditolak..."
                            className="w-full text-xs p-2 bg-white border border-red-300 rounded focus:ring-1 focus:ring-red-500"
                          />
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => {
                                setRejectingDocId(null);
                                setRejectionReason('');
                              }}
                              className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded"
                            >
                              Batal
                            </button>
                            <button
                              onClick={() => handleConfirmReject(doc.id)}
                              className="px-3 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded"
                            >
                              Konfirmasi Tolak
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Collapsible Physical Form Preview */}
                    {selectedDocForPreview?.id === doc.id && (
                      <div className="border-t border-slate-200 bg-slate-50 p-6">
                        <PhysicalFormPreview doc={doc} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
