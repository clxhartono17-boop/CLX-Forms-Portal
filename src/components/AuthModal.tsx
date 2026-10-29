import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { UserRole, Division } from '../types/index.ts';
import { GOOGLE_SHEETS_TEMPLATE_URL, SHEET_TAB_MASTER_LOGIN } from '../utils/googleIntegration.ts';
import { 
  UserCheck, 
  UserPlus, 
  LogIn, 
  Lock, 
  Mail, 
  Phone, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  X
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'register',
}) => {
  const { registerUser, loginUser } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Staff');
  const [division, setDivision] = useState<Division>('Finance');
  const [phone, setPhone] = useState('');
  const [signatureFile, setSignatureFile] = useState<File | null>(null); // State untuk file tanda tangan
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!name.trim() || !email.trim()) {
      setFeedback({ message: 'Harap lengkapi nama dan email perusahaan.', type: 'error' });
      return;
    }

    if (!signatureFile) {
      setFeedback({ message: 'Tanda tangan digital wajib diunggah.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Catatan: Jika ingin menyimpan file, Anda bisa memproses 'signatureFile' menjadi Base64 
      // di sini atau meneruskannya ke fungsi registerUser untuk diupload ke Google Drive/Sheets.
      
      const res = await registerUser({
        name,
        email,
        password,
        role,
        division,
        phone,
      });

      setFeedback({ message: res.message, type: 'success' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setFeedback({ message: err?.message || 'Gagal mendaftar. Silakan coba lagi.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!email.trim()) {
      setFeedback({ message: 'Harap masukkan email Anda.', type: 'error' });
      return;
    }

    const res = loginUser(email, password);
    if (res.success) {
      setFeedback({ message: res.message, type: 'success' });
      setTimeout(() => {
        onClose();
      }, 1000);
    } else {
      setFeedback({ message: res.message, type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Banner */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-black text-lg text-white">
              CLX
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                PT. CONNECTIVITY LEADS EXCELLENCE
              </h2>
              <p className="text-[11px] text-slate-400">
                Portal Otentikasi & Registrasi Wajib Karyawan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice: Synced with Google Sheets "Master Login" */}
        <div className="bg-blue-50 border-b border-blue-200 px-5 py-2.5 flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Tersimpan otomatis ke Google Sheet: <strong>"{SHEET_TAB_MASTER_LOGIN}"</strong></span>
          </div>
          <a
            href={GOOGLE_SHEETS_TEMPLATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-blue-700 hover:underline flex items-center space-x-0.5 font-semibold"
          >
            <span>Buka Sheet</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 text-xs font-bold text-center">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setFeedback(null);
            }}
            className={`py-3 transition border-b-2 ${
              mode === 'register'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center justify-center space-x-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              <span>Registrasi Pengguna Baru</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('login');
              setFeedback(null);
            }}
            className={`py-3 transition border-b-2 ${
              mode === 'login'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center justify-center space-x-1.5">
              <LogIn className="w-3.5 h-3.5" />
              <span>Masuk (Login)</span>
            </div>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {feedback && (
            <div
              className={`flex items-center space-x-2 text-xs p-3 rounded-lg border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {mode === 'register' ? (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Contoh: Christine Natalia"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Perusahaan (@clx.co.id) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nama@clx.co.id"
                    className="w-full text-xs pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Divisi <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={division}
                    onChange={e => setDivision(e.target.value as Division)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium"
                  >
                    <option value="Project">Project</option>
                    <option value="Operation">Operation</option>
                    <option value="Services">Services</option>
                    <option value="General">General</option>
                    <option value="Finance">Finance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Peran / Otoritas <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as UserRole)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-bold"
                  >
                    <option value="Staff">Staff (Maker)</option>
                    <option value="CSO">CSO (Chief Strategy Officer)</option>
                    <option value="COO">COO (Chief Operating Officer)</option>
                    <option value="CFO">CFO (Chief Financial Officer)</option>
                    <option value="CEO">CEO (Chief Executive Officer)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kata Sandi (Password)
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    No. WhatsApp / HP
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="0812xxxxxxxx"
                      className="w-full text-xs pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Tambahan Form Tanda Tangan Digital */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Upload Tanda Tangan (Digital Sign) <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="image/png, image/jpeg"
                  required
                  onChange={e => setSignatureFile(e.target.files?.[0] || null)}
                  className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 
                  file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Format: PNG, JPG (Maks. 2MB). Disarankan menggunakan background transparan.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                <UserCheck className="w-4 h-4" />
                <span>{isSubmitting ? 'Mendaftarkan ke Master Login...' : 'Daftar Sekarang & Sinkron ke Sheets'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Perusahaan
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="nama@clx.co.id"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kata Sandi
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
              >
                Masuk ke Portal
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
