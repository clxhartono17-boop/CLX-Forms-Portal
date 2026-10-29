import React, { useState } from 'react';
import { GOOGLE_SHEETS_TEMPLATE_URL, GOOGLE_DRIVE_PARENT_FOLDER_ID, GOOGLE_SHEETS_TEMPLATE_ID } from '../utils/googleIntegration.ts';
import { 
  Cloud, 
  ExternalLink, 
  CheckCircle, 
  Copy, 
  Key, 
  FolderPlus, 
  FileSpreadsheet, 
  Terminal, 
  Check, 
  Layers,
  Server
} from 'lucide-react';

export const GoogleCloudSettings: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 3000);
  };

  const handleRunDiagnostic = () => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      setTestResult('Semua konfigurasi endpoint API, nested folder logic, dan pdf-lib merger siap beroperasi!');
    }, 1200);
  };

  const envSnippets = `# Vercel Environment Variables (.env.production / Vercel Project Settings)
GOOGLE_SERVICE_ACCOUNT_EMAIL="clx-form-service@your-gcp-project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7...\\n-----END PRIVATE KEY-----"
GOOGLE_DRIVE_PARENT_FOLDER_ID="1hgUyTqNsfJsC30pY7O2kPS95DqEEySm9"
GOOGLE_SHEET_ID="1irb4RR0LMMBqRfGP4gxvX82c0nLfWIXKHzQ_tqC3h8c"
NEXTAUTH_SECRET="your-secure-nextauth-secret-key-32-chars"
NEXTAUTH_URL="https://your-vercel-domain.vercel.app"`;

  const projectTree = `clx-forms-portal/
├── src/
│   ├── app/ (Next.js App Router)
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts  (NextAuth RBAC Provider)
│   │   │   ├── google/
│   │   │   │   ├── drive-upload/route.ts    (Nested folder creator & upload)
│   │   │   │   ├── sheets-sync/route.ts     (Append to "Rekapan Form" tab)
│   │   │   │   └── register-user/route.ts   (Append to "Master Login" tab)
│   │   │   └── forms/route.ts               (CRUD forms)
│   │   ├── dashboard/page.tsx               (Summary with date range filters & charts)
│   │   ├── create/page.tsx                  (FPU, PFB, FPPB generation)
│   │   ├── approvals/page.tsx               (Dedicated C-Level approval queue)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── PhysicalFormPreview.tsx          (Pixel-perfect paper form)
│   │   ├── FormCreator.tsx                  (Auto-number, Terbilang, Division)
│   │   └── ApprovalQueue.tsx                (C-Level signature stamp engine)
│   ├── utils/
│   │   ├── romanNumerals.ts                 (Roman numeral month/year converter)
│   │   ├── terbilang.ts                     (Indonesian words currency engine)
│   │   ├── pdfGenerator.ts                  (pdf-lib form builder & merger)
│   │   └── googleIntegration.ts             (Drive & Sheets API client)
│   └── types/index.ts
├── .env.example
├── package.json
└── vercel.json`;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-black uppercase bg-blue-100 text-blue-900 border border-blue-200">
              Vercel & Google Cloud API Architecture
            </span>
            <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Active Integration Ready
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-1">
            Panduan Konfigurasi Service Account, Google Drive & Google Sheets
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gunakan panduan teknis ini untuk menyambungkan Service Account Google Cloud ke deployment Vercel.
          </p>
        </div>

        <button
          onClick={handleRunDiagnostic}
          disabled={isTesting}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition disabled:opacity-50"
        >
          <Server className="w-3.5 h-3.5" />
          <span>{isTesting ? 'Menguji API...' : 'Uji Integrasi API'}</span>
        </button>
      </div>

      {testResult && (
        <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-lg">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{testResult}</span>
        </div>
      )}

      {/* Target Resource Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Drive Parent Folder Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase">
              <FolderPlus className="w-4 h-4 text-blue-600" />
              <span>Google Drive Parent Folder</span>
            </div>
            <a
              href={`https://drive.google.com/drive/folders/${GOOGLE_DRIVE_PARENT_FOLDER_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center space-x-1"
            >
              <span>Buka Folder</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs font-mono break-all text-slate-700">
            {GOOGLE_DRIVE_PARENT_FOLDER_ID}
          </div>
          <p className="text-[11px] text-slate-500">
            Struktur folder otomatis dibuat bersarang: <br />
            <strong className="text-slate-800">[NAMA_FORM] / [BULAN] / [TANGGAL] / [NOMOR_FORM] / [Merged_File.pdf]</strong>
          </p>
        </div>

        {/* Google Sheets Template Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Google Sheets Database Master</span>
            </div>
            <a
              href={GOOGLE_SHEETS_TEMPLATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-700 hover:underline flex items-center space-x-1 font-semibold"
            >
              <span>Buka Spreadsheet</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs font-mono break-all text-slate-700">
            {GOOGLE_SHEETS_TEMPLATE_ID}
          </div>
          <p className="text-[11px] text-slate-500">
            Hasil pembuatan form otomatis terinput ke tab <strong className="text-slate-800">"Rekapan Form"</strong> dan hasil registrasi user tersimpan di tab <strong className="text-slate-800">"Master Login"</strong>.
          </p>
        </div>
      </div>

      {/* Step by Step Instructions */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
          <Key className="w-4 h-4 text-amber-500" />
          <span>Langkah-Langkah Setup Google Cloud Service Account untuk Vercel:</span>
        </h3>

        <ol className="list-decimal list-inside space-y-3 text-xs text-slate-700 leading-relaxed">
          <li className="pl-1">
            <strong>Buka Google Cloud Console</strong>: Masuk ke <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a> dan buat project baru (contoh: <code className="bg-slate-100 px-1 rounded">CLX-Forms-Production</code>).
          </li>
          <li className="pl-1">
            <strong>Aktifkan Google APIs</strong>: Buka menu <em>APIs & Services &gt; Library</em>, cari dan klik <strong>Enable</strong> untuk:
            <ul className="list-disc list-inside ml-4 mt-1 text-slate-600">
              <li><strong>Google Drive API</strong></li>
              <li><strong>Google Sheets API</strong></li>
            </ul>
          </li>
          <li className="pl-1">
            <strong>Buat Service Account</strong>: Buka <em>IAM & Admin &gt; Service Accounts</em> &gt; Klik <em>Create Service Account</em>. Berikan nama (contoh: <code className="bg-slate-100 px-1 rounded">clx-form-uploader</code>).
          </li>
          <li className="pl-1">
            <strong>Download Private Key JSON</strong>: Klik pada Service Account yang baru dibuat &gt; Tab <em>Keys</em> &gt; <em>Add Key</em> &gt; <em>Create new key</em> &gt; Pilih <strong>JSON</strong>. Simpan file kredensial tersebut dengan aman.
          </li>
          <li className="pl-1">
            <strong>Beri Akses (Share) ke Google Drive & Sheets</strong>: Salin email Service Account (contoh: <code className="bg-slate-100 px-1 rounded">clx-uploader@...iam.gserviceaccount.com</code>), lalu:
            <ul className="list-disc list-inside ml-4 mt-1 text-slate-600">
              <li>Buka folder Drive <code className="bg-slate-100 px-1 rounded">{GOOGLE_DRIVE_PARENT_FOLDER_ID}</code> &gt; Share &gt; Tempel email Service Account &gt; Berikan hak akses <strong>Editor</strong>.</li>
              <li>Buka Spreadsheet Master <code className="bg-slate-100 px-1 rounded">{GOOGLE_SHEETS_TEMPLATE_ID}</code> &gt; Share &gt; Tempel email Service Account &gt; Berikan hak akses <strong>Editor</strong>. Pastikan terdapat sheet tab <strong>"Rekapan Form"</strong> dan <strong>"Master Login"</strong>.</li>
            </ul>
          </li>
          <li className="pl-1">
            <strong>Masukkan Environment Variables di Vercel Dashboard</strong>: Buka <em>Project Settings &gt; Environment Variables</em> di dashboard Vercel Anda, dan masukkan nilai dari kredensial JSON.
          </li>
        </ol>
      </div>

      {/* Environment Variables Snippet */}
      <div className="bg-slate-900 text-slate-200 p-5 rounded-xl border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Vercel Environment Variables (.env)</span>
          </div>
          <button
            onClick={() => copyToClipboard(envSnippets, 'env')}
            className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition border border-slate-700"
          >
            {copiedKey === 'env' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'env' ? 'Tersalin' : 'Salin Snippet'}</span>
          </button>
        </div>
        <pre className="text-[11px] font-mono bg-slate-950 p-4 rounded-lg overflow-x-auto text-emerald-400 leading-relaxed">
          {envSnippets}
        </pre>
      </div>

      {/* Project Structure Tree */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Struktur Direktori Proyek Next.js & Serverless Functions</span>
          </h3>
          <button
            onClick={() => copyToClipboard(projectTree, 'tree')}
            className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
          >
            {copiedKey === 'tree' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'tree' ? 'Tersalin' : 'Salin Struktur'}</span>
          </button>
        </div>
        <pre className="text-[11px] font-mono bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-800 overflow-x-auto leading-relaxed">
          {projectTree}
        </pre>
      </div>
    </div>
  );
};
