import React, { useState } from 'react';
import { FormDocument } from '../types/index.ts';
import { formatRupiah, generateMergedPdf, downloadPdf } from '../utils/pdfGenerator.ts';
import { PhysicalFormPreview } from './PhysicalFormPreview.tsx';
import { GOOGLE_SHEETS_TEMPLATE_URL, GOOGLE_DRIVE_PARENT_FOLDER_ID } from '../utils/googleIntegration.ts';
import { 
  X, 
  Download, 
  ExternalLink, 
  FolderCheck, 
  FileSpreadsheet, 
  CheckCircle, 
  Clock, 
  Paperclip,
  Shield,
  Layers,
  ArrowRight
} from 'lucide-react';

interface FormDetailsModalProps {
  doc: FormDocument;
  onClose: () => void;
}

export const FormDetailsModal: React.FC<FormDetailsModalProps> = ({ doc, onClose }) => {
  const [activeTab, setActiveTab] = useState<'paper' | 'drive_sheets' | 'attachments'>('paper');

  const handleDownloadMerged = async () => {
    try {
      const bytes = await generateMergedPdf(doc);
      downloadPdf(bytes, `${doc.docNumber.replace(/[\/\\]/g, '_')}_merged.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <span className="px-2 py-0.5 rounded text-xs font-black uppercase bg-blue-600 text-white">
              {doc.formType}
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-mono font-bold text-white">
                {doc.docNumber}
              </h2>
              <p className="text-xs text-slate-400">
                Divisi: <strong className="text-slate-200">{doc.division}</strong> | Pemohon: <strong className="text-slate-200">{doc.requesterName}</strong> ({doc.date})
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadMerged}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Merged PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigator */}
        <div className="bg-slate-100 px-6 py-2 border-b border-slate-200 flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('paper')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'paper'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pratinjau Formulir Standar Fisik
          </button>

          <button
            onClick={() => setActiveTab('drive_sheets')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'drive_sheets'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Integrasi Google Drive & Sheets
          </button>

          <button
            onClick={() => setActiveTab('attachments')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
              activeTab === 'attachments'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Paperclip className="w-3 h-3" />
            <span>Lampiran Dokumen ({doc.attachments?.length || 0})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
          {activeTab === 'paper' && (
            <PhysicalFormPreview doc={doc} showHeaderActions={false} />
          )}

          {activeTab === 'drive_sheets' && (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Google Drive Status */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <FolderCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase">
                        Google Drive Storage Integration
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Penyimpanan otomatis file PDF gabungan (Form + Dokumen Pendukung)
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Auto-Synced
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 text-xs">
                  <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-slate-200">
                    <span className="font-semibold text-slate-600">Parent Folder ID:</span>
                    <span className="font-mono text-slate-900">{GOOGLE_DRIVE_PARENT_FOLDER_ID}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-slate-200">
                    <span className="font-semibold text-slate-600">Nested Folder Path:</span>
                    <span className="font-mono font-bold text-blue-700">
                      {doc.googleDrive?.folderPath || `${doc.formType} / October / 29 / ${doc.docNumber.split('/')[0]}`}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-slate-200">
                    <span className="font-semibold text-slate-600">Merged PDF File:</span>
                    <span className="font-mono text-slate-900">
                      {doc.docNumber.replace(/[\/\\]/g, '_')}_merged.pdf
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:justify-between py-1">
                    <span className="font-semibold text-slate-600">Drive Direct Link:</span>
                    <a
                      href={doc.googleDrive?.fileUrl || `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_PARENT_FOLDER_ID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center space-x-1"
                    >
                      <span>Buka Folder di Google Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Google Sheets Status */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase">
                        Google Sheets Database Sync
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Append data formulir secara otomatis ke tab spreadsheet
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Synced Row #{doc.googleSheets?.rowNumber || doc.sequenceNumber + 1}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="font-semibold text-slate-600">Target Sheet / Tab:</span>
                    <span className="font-bold text-emerald-800">{doc.formType}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="font-semibold text-slate-600">Status Sync:</span>
                    <span className="text-slate-800 font-medium">Terhubung & Tersinkronisasi</span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="font-semibold text-slate-600">Tautan Dokumen Sheets:</span>
                    <a
                      href={GOOGLE_SHEETS_TEMPLATE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:underline flex items-center space-x-1 font-semibold"
                    >
                      <span>Buka Google Sheets CLX Master</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attachments' && (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="text-xs font-bold text-slate-700">
                Dokumen Pendukung yang Digabungkan ({doc.attachments?.length || 0}):
              </div>

              {!doc.attachments || doc.attachments.length === 0 ? (
                <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-400 text-xs">
                  Tidak ada file lampiran pendukung untuk dokumen ini.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {doc.attachments.map(att => (
                    <div
                      key={att.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <Paperclip className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-xs text-slate-800 truncate">
                          {att.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Tipe: {att.type} | Ukuran: {(att.size / 1024).toFixed(1)} KB
                      </div>
                      {att.dataUrl && att.type.startsWith('image/') && (
                        <div className="border border-slate-100 rounded overflow-hidden max-h-40 bg-slate-50 flex items-center justify-center">
                          <img
                            src={att.dataUrl}
                            alt={att.name}
                            className="max-h-36 object-contain"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white px-6 py-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
          <span>ID Sistem: {doc.id}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
