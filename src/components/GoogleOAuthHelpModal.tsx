import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  AlertTriangle, 
  ShieldAlert, 
  Sparkles, 
  Key, 
  FileSpreadsheet,
  Download,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { useForms } from '../context/FormContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { 
  copyFormsToClipboard, 
  downloadFormsCsv, 
  SPREADSHEET_URL, 
  setGoogleAccessToken 
} from '../utils/googleWorkspace.ts';

interface GoogleOAuthHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorMessage?: string | null;
  onRetryConnect?: () => Promise<void>;
}

export const GoogleOAuthHelpModal: React.FC<GoogleOAuthHelpModalProps> = ({
  isOpen,
  onClose,
  errorMessage,
  onRetryConnect,
}) => {
  const { forms } = useForms();
  const { connectGoogle } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'origin' | 'instant_copy' | 'manual_token'>('origin');
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [copiedData, setCopiedData] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [tokenFeedback, setTokenFeedback] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const gcpConsoleUrl = 'https://console.cloud.google.com/apis/credentials/oauthclient/106119243607-g0jrt5ee6eg8639fe06unqmo1ps52mes.apps.googleusercontent.com?project=gen-lang-client-0070600289';
  const firebaseConsoleUrl = 'https://console.firebase.google.com/project/gen-lang-client-0070600289/authentication/settings';

  const handleCopyOrigin = async () => {
    try {
      await navigator.clipboard.writeText(currentOrigin);
      setCopiedOrigin(true);
      setTimeout(() => setCopiedOrigin(false), 3000);
    } catch {
      // fallback
    }
  };

  const handleCopySheetData = async () => {
    const success = await copyFormsToClipboard(forms);
    if (success) {
      setCopiedData(true);
      setTimeout(() => setCopiedData(false), 4000);
    }
  };

  const handleApplyManualToken = () => {
    if (!manualToken.trim()) return;
    setGoogleAccessToken(manualToken.trim());
    setTokenFeedback('✅ Access token diterapkan! Anda dapat langsung melakukan sinkronisasi.');
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      if (onRetryConnect) {
        await onRetryConnect();
      } else {
        await connectGoogle();
      }
      onClose();
    } catch (err: any) {
      // keep modal open with latest error
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-6 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-5 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Panduan Koneksi Google Workspace & Sheet
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Solusi Error 400: origin_mismatch & Cara Mengisi Sheet Secara Instan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Notification Alert */}
        {errorMessage && (
          <div className="bg-red-50 border-b border-red-200 p-3.5 flex items-start space-x-2.5 text-xs text-red-900">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Pesan Error Google:</span> {errorMessage}
              <div className="text-[11px] text-red-700 mt-0.5">
                Penyebab: Google OAuth mengharuskan domain asal aplikasi didaftarkan di Google Cloud Console demi alasan keamanan.
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            onClick={() => setActiveTab('origin')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'origin'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Solusi 1: Setup GCP (1 Menit)</span>
          </button>

          <button
            onClick={() => setActiveTab('instant_copy')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'instant_copy'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Solusi 2: 1-Klik Salin ke B9 (Instan)</span>
          </button>

          <button
            onClick={() => setActiveTab('manual_token')}
            className={`py-3 px-4 text-center border-b-2 transition hidden sm:flex items-center justify-center space-x-1.5 ${
              activeTab === 'manual_token'
                ? 'border-purple-600 text-purple-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-purple-600" />
            <span>Token Manual</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 text-xs text-slate-700 space-y-4">
          {activeTab === 'origin' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5">
                <h3 className="font-bold text-blue-900 text-xs">
                  Kenapa terjadi "Error 400: origin_mismatch"?
                </h3>
                <p className="text-[11px] text-blue-800/90 mt-1 leading-relaxed">
                  Google memproteksi kredensial OAuth Anda. Karena server preview AI Studio berjalan di URL dinamis Google Cloud Run, domain ini perlu didaftarkan di daftar <strong>Authorized JavaScript origins</strong> di Google Cloud Console project <code>gen-lang-client-0070600289</code>.
                </p>
              </div>

              {/* Step 1: Copy Domain */}
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">
                    Langkah 1: Salin Domain Asal Aplikasi Ini
                  </span>
                  {copiedOrigin && (
                    <span className="text-[11px] text-emerald-600 font-bold flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Tersalin ke Clipboard!</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={currentOrigin}
                    className="flex-1 px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg font-mono text-[11px] text-slate-800 select-all"
                  />
                  <button
                    onClick={handleCopyOrigin}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition shrink-0 flex items-center space-x-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedOrigin ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Open GCP Console */}
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                <span className="font-bold text-slate-900 text-xs">
                  Langkah 2: Tambahkan ke Google Cloud Console
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Buka halaman OAuth Client ID, scroll ke bagian <strong>Authorized JavaScript origins</strong> (Asal JavaScript yang diizinkan), klik <strong>+ ADD URI</strong>, tempel (Paste) URL yang baru Anda salin di atas, lalu klik <strong>SAVE (SIMPAN)</strong>.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={gcpConsoleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-lg transition"
                  >
                    <span>1. Buka GCP OAuth Client ID</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <a
                    href={firebaseConsoleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition"
                  >
                    <span>2. Buka Firebase Authorized Domains</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Step 3: Retry Button */}
              <div className="border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 text-xs">
                    Langkah 3: Coba Hubungkan Ulang
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Setelah klik Save di GCP Console, tunggu ~30 detik lalu hubungkan ulang.
                  </p>
                </div>
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs transition disabled:opacity-50"
                >
                  {isRetrying ? 'Menghubungkan...' : 'Hubungkan Sekarang'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'instant_copy' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                <h3 className="font-bold text-emerald-900 text-xs">
                  Solusi Instan: Salin Data Langsung ke Spreadsheet (Tanpa Perlu Login Google!)
                </h3>
                <p className="text-[11px] text-emerald-800/90 mt-1 leading-relaxed">
                  Semua data pengajuan ({forms.length} formulir) diformat otomatis dan telah disesuaikan 100% dengan template sheet <strong>"Rekap Form CLX"</strong> (19 kolom: mulai dari <strong>Kolom B = No</strong> sampai <strong>Kolom T = Link Dokumen</strong>). Kolom A sengaja dibiarkan kosong sebagai margin template.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <span className="font-bold text-slate-900 text-xs block">
                  Cara Pakai (Hanya 3 Langkah Mudah):
                </span>
                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 leading-relaxed">
                  <li>
                    Klik tombol hijau <strong>"📋 Salin Data Baris 9"</strong> di bawah.
                  </li>
                  <li>
                    Buka spreadsheet Anda di tab baru.
                  </li>
                  <li>
                    Klik sel <strong>B9</strong> (di bawah header baris 8 kolom <em>No</em>), lalu tekan <strong>Ctrl + V</strong> (Paste).
                  </li>
                </ol>

                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    onClick={handleCopySheetData}
                    className="flex-1 inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition"
                  >
                    {copiedData ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedData ? '✅ Berhasil Disalin! Buka Sheet & Paste di B9' : '📋 Salin Data Baris 9 (Paste ke B9)'}</span>
                  </button>

                  <a
                    href={SPREADSHEET_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold rounded-xl transition"
                  >
                    <span>Buka Sheet</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={() => downloadFormsCsv(forms)}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh CSV</span>
                  </button>
                </div>

                {copiedData && (
                  <div className="p-2.5 bg-emerald-100 text-emerald-900 rounded-lg text-xs font-bold text-center animate-in fade-in">
                    🎉 Data {forms.length} formulir siap dipaste ke sel B9 di Google Sheets Anda!
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'manual_token' && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-600">
                Jika Anda memiliki Access Token Google OAuth dari Google OAuth Playground atau CLI, Anda dapat memasukkannya di sini untuk mengaktifkan sinkronisasi otomatis langsung ke API Sheets & Drive:
              </p>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Google OAuth Access Token (ya29...):
                </label>
                <textarea
                  rows={3}
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Paste access token Google OAuth di sini..."
                  className="w-full p-2.5 font-mono text-[11px] bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {tokenFeedback && (
                <div className="p-2 bg-emerald-100 text-emerald-900 rounded text-[11px] font-bold">
                  {tokenFeedback}
                </div>
              )}

              <button
                onClick={handleApplyManualToken}
                disabled={!manualToken.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition disabled:opacity-50"
              >
                Terapkan Token Ini
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Target Spreadsheet: <strong>Rekap Form CLX</strong> (gid=0)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-lg transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
