import React, { useState } from 'react';
import { FormDocument } from '../types/index.ts';
import { formatRupiah, generateOfficialFormPdf, generateMergedPdf, downloadPdf } from '../utils/pdfGenerator.ts';
import { Printer, Download, ExternalLink, CheckCircle, FileText, Paperclip, Loader2 } from 'lucide-react';

interface PhysicalFormPreviewProps {
  doc: FormDocument;
  showHeaderActions?: boolean;
}

export const PhysicalFormPreview: React.FC<PhysicalFormPreviewProps> = ({
  doc,
  showHeaderActions = true,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownloadSinglePdf = async () => {
    setIsGenerating(true);
    try {
      const pdf = await generateOfficialFormPdf(doc);
      const bytes = await pdf.save();
      const filename = `${doc.docNumber.replace(/[\/\\]/g, '_')}_form.pdf`;
      downloadPdf(bytes, filename);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadMergedPdf = async () => {
    setIsGenerating(true);
    try {
      const bytes = await generateMergedPdf(doc);
      const filename = `${doc.docNumber.replace(/[\/\\]/g, '_')}_merged.pdf`;
      downloadPdf(bytes, filename);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  let formTitle = 'FORM PERMOHONAN UANG (FPU)';
  if (doc.formType === 'PFB') {
    formTitle = 'PERMOHONAN FAKTUR BIAYA & OPERASIONAL (PFB)';
  } else if (doc.formType === 'FPPB') {
    formTitle = 'FORM PERMOHONAN PEMBELIAN BARANG (FPPB)';
  }

  const sigBoxes = [
    { title: 'PEMOHON', role: 'Staff', stamp: doc.signatures.maker, defaultName: doc.requesterName },
    { title: 'DIPERIKSA', role: 'CSO', stamp: doc.signatures.cso, defaultName: 'Chief Strategy Officer' },
    { title: 'DISETUJUI', role: 'COO', stamp: doc.signatures.coo, defaultName: 'Chief Operating Officer' },
    { title: 'DIVERIFIKASI', role: 'CFO', stamp: doc.signatures.cfo, defaultName: 'Chief Financial Officer' },
    { title: 'DISETUJUI AKHIR', role: 'CEO', stamp: doc.signatures.ceo, defaultName: 'Chief Executive Officer' },
  ];

  return (
    <div className="flex flex-col space-y-4">
      {showHeaderActions && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm print:hidden">
          <div className="flex items-center space-x-2 text-sm text-slate-700 font-medium">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Dokumen Fisik Standar CLX ({doc.docNumber})</span>
            {doc.attachments && doc.attachments.length > 0 && (
              <span className="flex items-center text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                <Paperclip className="w-3 h-3 mr-1" />
                {doc.attachments.length} Lampiran
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Form</span>
            </button>

            <button
              onClick={handleDownloadSinglePdf}
              disabled={isGenerating}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm transition disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Save / PDF Form</span>
            </button>

            <button
              onClick={handleDownloadMergedPdf}
              disabled={isGenerating}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-sm transition disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
              <span>Download Merged PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* PAPER CANVAS - Pixel-Perfect Physical Sheet (A4 Ratio Styling) */}
      <div 
        id="printable-form"
        className="w-full max-w-[820px] mx-auto bg-white border border-slate-300 rounded shadow-md p-8 text-slate-900 font-sans print:border-none print:shadow-none print:p-0 print:m-0"
      >
        {/* Top Header */}
        <div className="border-b-2 border-slate-900 pb-3 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 bg-blue-900 text-white font-black flex items-center justify-center rounded text-sm tracking-wider">
                  CLX
                </div>
                <h1 className="text-base font-black tracking-tight text-blue-950 uppercase">
                  PT. CONNECTIVITY LEADS EXCELLENCE
                </h1>
              </div>
              <p className="text-[10px] text-slate-500 font-medium tracking-wide mt-0.5">
                Internal Financial, Operational & Purchase Requisition Control System
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-300 inline-block">
                No: {doc.docNumber}
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Tanggal: <span className="font-semibold">{doc.date}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Form Title Banner */}
        <div className="bg-slate-100 border border-slate-300 text-center py-2 mb-4 rounded-sm">
          <h2 className="text-sm font-bold text-blue-950 tracking-wide uppercase">
            {formTitle}
          </h2>
        </div>

        {/* Two Column Document Information */}
        <div className="grid grid-cols-2 gap-4 border border-slate-300 p-3 mb-4 text-xs bg-slate-50/50 rounded-sm">
          {/* Left Column */}
          <div className="space-y-1.5">
            <div className="flex">
              <span className="w-28 font-bold text-slate-600">DIVISI</span>
              <span className="font-semibold text-blue-900 uppercase">: {doc.division}</span>
            </div>
            <div className="flex">
              <span className="w-28 font-bold text-slate-600">PEMOHON</span>
              <span className="font-semibold text-slate-800">: {doc.requesterName}</span>
            </div>
            <div className="flex">
              <span className="w-28 font-bold text-slate-600">JABATAN</span>
              <span className="text-slate-800">: {doc.requesterRole}</span>
            </div>
            <div className="flex">
              <span className="w-28 font-bold text-slate-600">METODE BAYAR</span>
              <span className="font-semibold text-slate-800">: {doc.paymentMethod}</span>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-1.5 border-l border-slate-200 pl-4">
            <div className="flex">
              <span className="w-28 font-bold text-slate-600">BANK TUJUAN</span>
              <span className="font-semibold text-slate-800">: {doc.bankName || 'KAS / TUNAI'}</span>
            </div>
            <div className="flex">
              <span className="w-28 font-bold text-slate-600">NO. REKENING</span>
              <span className="font-mono font-medium text-slate-800">: {doc.bankAccountNo || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-28 font-bold text-slate-600">A.N REKENING</span>
              <span className="font-semibold text-slate-800">: {doc.bankAccountName || '-'}</span>
            </div>
            <div className="flex">
              <span className="w-28 font-bold text-slate-600">STATUS</span>
              <span className="font-bold text-emerald-700 uppercase">: {doc.status}</span>
            </div>
          </div>
        </div>

        {/* Keperluan / Purpose Description */}
        <div className="border border-slate-300 p-3 mb-4 bg-white rounded-sm">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            Keperluan / Deskripsi Pengajuan:
          </div>
          <div className="text-xs text-slate-900 leading-relaxed font-medium">
            {doc.purpose}
          </div>
        </div>

        {/* Items Table */}
        <div className="border border-slate-300 rounded-sm overflow-hidden mb-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-blue-950 text-white font-bold text-[11px]">
                <th className="py-2 px-2.5 w-10 text-center border-r border-blue-900">NO</th>
                <th className="py-2 px-3 border-r border-blue-900">URAIAN / RINCIAN BIAYA ATAU BARANG</th>
                <th className="py-2 px-2.5 w-16 text-center border-r border-blue-900">QTY</th>
                <th className="py-2 px-2.5 w-20 text-center border-r border-blue-900">SATUAN</th>
                <th className="py-2 px-3 w-32 text-right border-r border-blue-900">HARGA SATUAN (RP)</th>
                <th className="py-2 px-3 w-36 text-right">TOTAL (RP)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {doc.items.map((item, idx) => (
                <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                  <td className="py-2 px-2.5 text-center font-medium border-r border-slate-200">{idx + 1}</td>
                  <td className="py-2 px-3 font-medium text-slate-800 border-r border-slate-200">{item.description}</td>
                  <td className="py-2 px-2.5 text-center border-r border-slate-200">{item.qty}</td>
                  <td className="py-2 px-2.5 text-center text-slate-600 border-r border-slate-200">{item.unit || 'Unit'}</td>
                  <td className="py-2 px-3 text-right font-mono border-r border-slate-200">
                    {(item.unitPrice || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                    {(item.total || 0).toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
              {/* Fill minimum blank rows for authentic voucher look if items < 4 */}
              {Array.from({ length: Math.max(0, 4 - doc.items.length) }).map((_, bIdx) => (
                <tr key={`blank-${bIdx}`} className="bg-white">
                  <td className="py-2 px-2.5 text-center text-slate-300 border-r border-slate-200">
                    {doc.items.length + bIdx + 1}
                  </td>
                  <td className="py-2 px-3 text-slate-300 border-r border-slate-200">-</td>
                  <td className="py-2 px-2.5 text-center text-slate-300 border-r border-slate-200">-</td>
                  <td className="py-2 px-2.5 text-center text-slate-300 border-r border-slate-200">-</td>
                  <td className="py-2 px-3 text-right text-slate-300 border-r border-slate-200">-</td>
                  <td className="py-2 px-3 text-right text-slate-300">-</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-400 font-bold text-xs">
                <td colSpan={5} className="py-2.5 px-3 text-right text-slate-700 uppercase tracking-wide">
                  TOTAL PEMBAYARAN / TOTAL AMOUNT :
                </td>
                <td className="py-2.5 px-3 text-right text-blue-950 font-black text-sm">
                  {formatRupiah(doc.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Terbilang Section */}
        <div className="border border-blue-200 bg-blue-50/40 p-3 rounded-sm mb-4">
          <div className="text-[10px] font-bold text-blue-900 uppercase tracking-wider mb-0.5">
            Terbilang (Number to Words):
          </div>
          <div className="text-xs font-semibold italic text-blue-950">
            # {doc.terbilang || 'Nol Rupiah'} #
          </div>
        </div>

        {/* Notes & Drive Storage Structure */}
        <div className="flex justify-between items-center text-[10px] text-slate-500 mb-4 px-1">
          <div>
            <span className="font-semibold text-slate-700">Catatan: </span>
            {doc.notes || 'Pengajuan biaya internal diverifikasi dan diproses sesuai SOP Perusahaan CLX.'}
          </div>
          <div className="font-mono text-slate-400">
            Drive Path: {doc.googleDrive?.folderPath || `${doc.formType} / October / ${doc.docNumber}`}
          </div>
        </div>

        {/* 5-Box Approval Matrix with Digital Stamps */}
        <div className="border border-slate-300 rounded-sm overflow-hidden mb-4">
          <div className="bg-slate-200 px-3 py-1 text-[11px] font-bold text-slate-800 uppercase tracking-wide border-b border-slate-300">
            Matriks Persetujuan & Tanda Tangan Elektronik (Approval Matrix)
          </div>
          <div className="grid grid-cols-5 divide-x divide-slate-300 text-center">
            {sigBoxes.map((box, i) => (
              <div key={i} className="flex flex-col justify-between min-h-[110px] p-2 bg-white">
                <div className="text-[10px] font-bold text-blue-950 uppercase border-b border-slate-100 pb-1">
                  {box.title}
                </div>

                {/* Digital Stamp or Waiting Placeholder */}
                <div className="my-auto py-1">
                  {box.stamp ? (
                    <div className="inline-block border border-emerald-600 bg-emerald-50 text-emerald-800 p-1 rounded text-center w-full shadow-xs">
                      <div className="flex items-center justify-center space-x-1 text-[9px] font-black text-emerald-700">
                        <CheckCircle className="w-2.5 h-2.5" />
                        <span>DIGITALLY SIGNED</span>
                      </div>
                      <div className="text-[9px] font-bold text-slate-900 truncate">
                        {box.stamp.userName}
                      </div>
                      <div className="text-[8px] text-slate-500">
                        {box.stamp.signedAt?.split('T')[0]}
                      </div>
                      <div className="text-[7px] text-slate-400 font-mono">
                        {box.stamp.digitalHash?.slice(0, 10)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] italic text-slate-300">
                      (Menunggu)
                    </div>
                  )}
                </div>

                <div className="text-[9px] font-medium text-slate-700 border-t border-slate-100 pt-1 truncate">
                  {box.stamp?.userName || box.defaultName}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Document Watermark */}
        <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-[9px] text-slate-400">
          <span>PT. Connectivity Leads eXcellence (CLX) | Internal ERP Voucher System</span>
          <span>Security Verified | Form A4 Standard</span>
        </div>
      </div>
    </div>
  );
};
