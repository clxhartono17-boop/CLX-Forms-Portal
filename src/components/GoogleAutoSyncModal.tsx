import React, { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Code,
  ShieldCheck,
  FileSpreadsheet,
  Send
} from 'lucide-react';
import { 
  SPREADSHEET_URL, 
  APPS_SCRIPT_SAMPLE_CODE, 
  getAppsScriptUrl, 
  setAppsScriptUrl, 
  isAutoSyncConfigured,
  sendToAppsScriptWebhook,
  syncFormsToWebhook,
  copyFormsToClipboard
} from '../utils/googleWorkspace.ts';
import { useForms } from '../context/FormContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';

interface GoogleAutoSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const GoogleAutoSyncModal: React.FC<GoogleAutoSyncModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { forms } = useForms();
  const { registeredUsers } = useAuth();
  const [urlInput, setUrlInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncingExisting, setIsSyncingExisting] = useState(false);
  const [copiedExistingB9, setCopiedExistingB9] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeStep, setActiveStep] = useState<number>(1);

  useEffect(() => {
    if (isOpen) {
      setUrlInput(getAppsScriptUrl());
      setTestResult(null);
    }
  }, [isOpen]);

  const handleSyncExistingForms = async () => {
    if (!isAutoSyncConfigured()) {
      setTestResult({
        success: false,
        message: 'Simpan URL Webhook terlebih dahulu sebelum menyinkronkan data.',
      });
      return;
    }

    setIsSyncingExisting(true);
    try {
      const res = await syncFormsToWebhook(forms, registeredUsers);
      if (res.success) {
        setTestResult({
          success: true,
          message: `🎉 Berhasil! ${res.count} formulir yang ada di web sudah dikirim dan langsung masuk ke Google Sheet Rekap Form CLX!`,
        });
      } else {
        setTestResult({
          success: false,
          message: `Gagal mengirim: ${res.error || 'Periksa koneksi webhook'}`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Error: ${err?.message || 'Gagal sinkronisasi'}`,
      });
    } finally {
      setIsSyncingExisting(false);
    }
  };

  const handleCopyExistingB9 = async () => {
    const ok = await copyFormsToClipboard(forms);
    if (ok) {
      setCopiedExistingB9(true);
      setTimeout(() => setCopiedExistingB9(false), 4000);
      setTestResult({
        success: true,
        message: `📋 Data ${forms.length} formulir berhasil disalin ke clipboard! Langsung buka Google Sheet, klik B9, dan tekan Ctrl+V.`,
      });
    }
  };

  if (!isOpen) return null;

  const isConfigured = isAutoSyncConfigured();

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_SAMPLE_CODE);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 3000);
    } catch {
      // fallback
    }
  };

  const handleSaveAndTest = async () => {
    const cleanUrl = urlInput.trim();
    if (!cleanUrl) {
      setTestResult({
        success: false,
        message: 'Harap masukkan URL Web App Google Apps Script (berakhiran /exec).',
      });
      return;
    }

    if (!cleanUrl.startsWith('https://script.google.com/macros/s/') || !cleanUrl.endsWith('/exec')) {
      setTestResult({
        success: false,
        message: 'Format URL salah! URL harus berawal https://script.google.com/macros/s/ dan berakhiran /exec',
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    // Save URL to persistent storage
    setAppsScriptUrl(cleanUrl);

    try {
      // Send test ping payload
      const res = await sendToAppsScriptWebhook({
        action: 'ping',
        source: 'CLX Forms Portal Webhook Setup',
        timestamp: new Date().toISOString(),
      });

      if (res.success) {
        setTestResult({
          success: true,
          message: '🎉 Berhasil! Webhook aktif dan terhubung langsung ke spreadsheet Rekap Form CLX. Mulai sekarang semua form dari Vercel otomatis tersinkronisasi!',
        });
        if (onSuccess) onSuccess();
      } else {
        setTestResult({
          success: false,
          message: `Gagal menguji koneksi: ${res.error || 'Periksa apakah hak akses Web App sudah diatur ke "Anyone / Siapa saja"'}.`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Koneksi gagal: ${err?.message || 'Pastikan izin akses Web App disetel ke "Anyone"'}.`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRemove = () => {
    setAppsScriptUrl('');
    setUrlInput('');
    setTestResult({
      success: true,
      message: 'Konfigurasi Webhook telah dihapus.',
    });
    setTimeout(() => setTestResult(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-6 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white p-5 flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Auto-Sync Otomatis Google Sheets
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isConfigured 
                    ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40' 
                    : 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                }`}>
                  {isConfigured ? '🟢 Auto-Sync Aktif' : '⚪ Belum Aktif'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Formulir dari <strong>clx-forms-portal.vercel.app</strong> otomatis masuk langsung ke spreadsheet tanpa perlu login Google
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

        <div className="p-5 text-xs text-slate-700 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Explanation Banner: Private Backend & 2-Way Sync */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center space-x-2 text-blue-950 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Google Sheet Tetap 100% Privat (Database Backend Rahasia Milik Anda)</span>
            </div>
            <p className="text-[11px] text-slate-700 leading-relaxed">
              Anda <strong>TIDAK PERLU</strong> membagikan (share) file Google Sheet di Google Drive kepada staf atau publik. Hak akses file di Google Drive tetap <strong>Restricted / Hanya Anda (clx.hartono17@gmail.com)</strong>.
            </p>
            <div className="bg-white/80 border border-blue-200/80 rounded-lg p-2.5 text-[11px] text-slate-800 space-y-1">
              <p><strong>🔄 Cara Kerja Sinkronisasi 2 Arah:</strong></p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                <li><strong>Web &rarr; Sheet:</strong> Setiap form yang dibuat atau di-approve di web otomatis tercatat ke baris 9+ Google Sheet.</li>
                <li><strong>Sheet &rarr; Web:</strong> Web portal otomatis menarik data dari baris 9+ Google Sheet sehingga tampilan web selalu sama dengan spreadsheet.</li>
                <li><strong>Privasi Aman:</strong> Staf & Maker hanya melihat data melalui antarmuka web sesuai hak akses masing-masing tanpa pernah bisa membuka link file Google Sheet Anda.</li>
              </ul>
            </div>
          </div>

          {/* Step 1 to 4 Wizard */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3.5">
            <span className="font-bold text-slate-900 text-xs block">
              Cara Pasang (Hanya butuh 2-3 Menit):
            </span>

            {/* Step 1 */}
            <div className="flex items-start space-x-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                1
              </span>
              <div className="flex-1">
                <span className="font-bold text-slate-900 text-[11px]">
                  Buka Spreadsheet Template Rekap Form CLX
                </span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Buka spreadsheet target di tab baru:
                </p>
                <a
                  href={SPREADSHEET_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-bold text-[11px] mt-1 underline"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Buka Spreadsheet: Rekap Form CLX (gid=0)</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start space-x-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                2
              </span>
              <div className="flex-1">
                <span className="font-bold text-slate-900 text-[11px]">
                  Buka Menu Ekstensi &gt; Apps Script
                </span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Di Google Sheets, klik menu bar atas: <strong>Ekstensi (Extensions)</strong> &gt; pilih <strong>Apps Script</strong>.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-start space-x-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                3
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-[11px]">
                    Salin &amp; Tempel Kode Script Berikut
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[10px] transition"
                  >
                    {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Kode Tersalin!' : 'Salin Script (1-Klik)'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Hapus isi kode default <code>function myFunction() &#123;&#125;</code> di editor Apps Script, lalu paste kode ini dan tekan <strong>Ctrl + S</strong> (Simpan).
                </p>
                <div className="mt-1.5 p-2 bg-slate-900 text-slate-200 rounded-lg font-mono text-[10px] max-h-28 overflow-y-auto border border-slate-800">
                  <pre>{APPS_SCRIPT_SAMPLE_CODE.slice(0, 450)}... [Klik tombol Salin Script untuk menyalin lengkap]</pre>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-start space-x-2.5">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                4
              </span>
              <div className="flex-1">
                <span className="font-bold text-slate-900 text-[11px]">
                  Terapkan (Deploy) Sebagai Aplikasi Web
                </span>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                  Di kanan atas Apps Script, klik tombol biru <strong>Terapkan (Deploy)</strong> &gt; <strong>Penerapan baru (New deployment)</strong>:
                </p>
                <ul className="list-disc list-inside text-[11px] text-slate-700 mt-1 space-y-0.5">
                  <li>Pilih jenis (ikon roda gigi): <strong>Aplikasi Web (Web App)</strong></li>
                  <li>Jalankan sebagai (Execute as): <strong>Saya (clx.hartono17@gmail.com)</strong></li>
                  <li>Yang memiliki akses (Who has access): <strong className="text-emerald-700">Siapa saja (Anyone)</strong> <em>(Wajib dipilih agar Vercel dapat mengirim data)</em></li>
                  <li>Klik <strong>Terapkan (Deploy)</strong>, setujui izin akun Google Anda, lalu salin <strong>URL Aplikasi Web</strong> yang muncul.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* URL Input & Activation Box */}
          <div className="border-2 border-blue-600/60 bg-blue-50/30 rounded-xl p-4 space-y-3">
            <label className="block text-xs font-bold text-slate-900">
              Tempelkan URL Aplikasi Web Apps Script di Sini:
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
              />
              <button
                onClick={handleSaveAndTest}
                disabled={isTesting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs transition shrink-0 flex items-center justify-center space-x-1.5 disabled:opacity-50"
              >
                {isTesting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                <span>{isTesting ? 'Menguji...' : '⚡ Simpan & Tes Koneksi'}</span>
              </button>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg text-xs font-medium flex items-start space-x-2 animate-in fade-in ${
                testResult.success
                  ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                  : 'bg-red-100 text-red-950 border border-red-300'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{testResult.message}</span>
              </div>
            )}

            {/* Quick Bulk Sync Actions for Existing Forms */}
            {forms.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-slate-800">
                    Kirim {forms.length} Formulir yang Ada di Web ke Spreadsheet:
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Total: {forms.length} dokumen terdaftar
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <button
                    onClick={handleSyncExistingForms}
                    disabled={isSyncingExisting || !urlInput.trim()}
                    className="w-full sm:flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  >
                    {isSyncingExisting ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{isSyncingExisting ? 'Mengirim Data...' : `⚡ Kirim Semua (${forms.length} Data) via Webhook`}</span>
                  </button>

                  <button
                    onClick={handleCopyExistingB9}
                    className="w-full sm:w-auto py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center justify-center space-x-1.5"
                  >
                    {copiedExistingB9 ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedExistingB9 ? 'Tersalin ke Clipboard!' : '📋 Salin Format (Paste B9)'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <div>
            {isConfigured && (
              <button
                onClick={handleRemove}
                className="text-[11px] text-red-600 hover:text-red-800 font-semibold underline"
              >
                Hapus Konfigurasi Webhook
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-lg transition"
          >
            Selesai / Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
