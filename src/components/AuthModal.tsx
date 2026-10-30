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
  Building, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  X,
  Sparkles,
  PenTool,
  Upload,
  Image as ImageIcon
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
  const { 
    registerUser, 
    loginUser, 
    registeredUsers, 
    isGoogleConnected, 
    connectGoogle, 
    googleUser 
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Staff');
  const [division, setDivision] = useState<Division>('Finance');
  const [phone, setPhone] = useState('');
  const [signatureUrl, setSignatureUrl] = useState<string>('');
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  if (!isOpen) return null;

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ message: 'Harap upload file gambar (PNG / JPG / JPEG) untuk tanda tangan.', type: 'error' });
      return;
    }

    // Limit size to max 2MB
    if (file.size > 2 * 1024 * 1024) {
      setFeedback({ message: 'Ukuran file tanda tangan maksimal 2MB.', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
      setSignatureUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!name.trim() || !email.trim()) {
      setFeedback({ message: 'Harap lengkapi nama dan email perusahaan.', type: 'error' });
      return;
    }

    if (!password.trim() || password.length < 4) {
      setFeedback({ message: 'Kata sandi minimal 4 karakter.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerUser({
        name,
        email,
        password,
        role,
        division,
        phone,
        signatureUrl: signatureUrl || undefined,
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

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setFeedback({ message: 'Harap masukkan alamat email Anda.', type: 'error' });
      return;
    }

    if (!password.trim()) {
      setFeedback({ message: 'Harap masukkan kata sandi akun Anda.', type: 'error' });
      return;
    }

    const res = loginUser(cleanEmail, password);
    if (res.success) {
      setFeedback({ message: res.message, type: 'success' });
      setTimeout(() => {
        onClose();
      }, 900);
    } else {
      setFeedback({ message: res.message, type: 'error' });
    }
  };

  const handleConnectGoogleClick = async () => {
    setIsConnectingGoogle(true);
    try {
      await connectGoogle();
      setFeedback({ message: 'Akun Google berhasil dihubungkan ke Google Sheets & Drive!', type: 'success' });
    } catch (err: any) {
      setFeedback({ message: err?.message || 'Gagal menghubungkan Google Workspace.', type: 'error' });
    } finally {
      setIsConnectingGoogle(false);
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
            <span>Tersinkronisasi ke Sheet: <strong>"{SHEET_TAB_MASTER_LOGIN}"</strong></span>
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

        {/* Google Workspace Connection Banner */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isGoogleConnected ? 'bg-emerald-500' : 'bg-amber-400'}`}></div>
            <span className="font-medium text-slate-700">
              {isGoogleConnected ? (
                <span>Google Terhubung: <strong>{googleUser?.email}</strong></span>
              ) : (
                <span>Google Sheets: Belum terhubung</span>
              )}
            </span>
          </div>

          {!isGoogleConnected && (
            <button
              type="button"
              onClick={handleConnectGoogleClick}
              disabled={isConnectingGoogle}
              className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded shadow-2xs transition"
            >
              <span>{isConnectingGoogle ? 'Menghubungkan...' : 'Hubungkan Google'}</span>
            </button>
          )}
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
                  placeholder="Contoh: Christine Natalia / Budi Santoso"
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
                    Kata Sandi (Password) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Minimal 4 karakter"
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

              {/* Digital Signature / Paraf Upload */}
              <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-blue-950 flex items-center space-x-1.5">
                    <PenTool className="w-3.5 h-3.5 text-blue-600" />
                    <span>Upload Tanda Tangan Digital / Signdigital</span>
                  </label>
                  <span className="text-[10px] text-blue-700 bg-blue-100 font-semibold px-2 py-0.5 rounded">
                    Paraf Dokumen
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">
                  Upload file gambar (PNG transparan atau JPG) untuk membubuhi paraf / tanda tangan pada matriks persetujuan formulir.
                </p>

                {signatureUrl ? (
                  <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2.5">
                    <div className="flex items-center space-x-3">
                      <div className="w-16 h-10 border border-slate-200 rounded bg-slate-50 flex items-center justify-center p-1 overflow-hidden">
                        <img 
                          src={signatureUrl} 
                          alt="Tanda Tangan Digital" 
                          className="max-h-full max-w-full object-contain" 
                        />
                      </div>
                      <div className="text-[11px]">
                        <span className="font-semibold text-emerald-700 flex items-center space-x-1">
                          <CheckCircle className="w-3 h-3 inline mr-1" />
                          Signdigital siap digunakan
                        </span>
                        <p className="text-slate-400 text-[10px]">Tersimpan bersama profil akun</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSignatureUrl('')}
                      className="text-xs text-red-600 hover:text-red-700 hover:underline font-medium px-2 py-1"
                    >
                      Hapus / Ganti
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center space-x-2 border-2 border-dashed border-blue-300 hover:border-blue-500 bg-white rounded-lg p-3 cursor-pointer transition text-blue-700 hover:bg-blue-50/50">
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold">Pilih File Tanda Tangan (PNG / JPG)</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                <UserCheck className="w-4 h-4" />
                <span>{isSubmitting ? 'Mendaftarkan ke Master Login...' : 'Daftar Sekarang & Simpan ke Sheets'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Perusahaan Terdaftar <span className="text-red-500">*</span>
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kata Sandi <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi akun Anda"
                    className="w-full text-xs pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
              >
                Masuk ke Portal
              </button>

              <div className="text-center pt-2">
                <span className="text-xs text-slate-500">
                  Belum memiliki akun terdaftar?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setFeedback(null);
                    }}
                    className="font-bold text-blue-600 hover:underline"
                  >
                    Daftar di sini
                  </button>
                </span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
