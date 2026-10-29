import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface GoogleConnectButtonProps {
  compact?: boolean;
}

export const GoogleConnectButton: React.FC<GoogleConnectButtonProps> = ({ compact = false }) => {
  const { isGoogleConnected, googleUser, connectGoogle, disconnectGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await connectGoogle();
    } catch (err: any) {
      setError(err?.message || 'Gagal menghubungkan Google Workspace.');
    } finally {
      setLoading(false);
    }
  };

  if (isGoogleConnected) {
    return (
      <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-950/80 border border-emerald-700/80 rounded-lg text-xs text-emerald-200">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="font-semibold truncate max-w-[150px] text-[11px]">
          {googleUser?.email || 'Google Terhubung'}
        </span>
        <button
          onClick={disconnectGoogle}
          title="Putus koneksi Google"
          className="text-emerald-400 hover:text-red-300 ml-1 text-[10px] underline"
        >
          Putus
        </button>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={handleConnect}
        disabled={loading}
        title="Hubungkan akun Google untuk menyimpan langsung ke Google Sheet & Drive"
        className={`inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg transition shadow-2xs font-bold text-xs disabled:opacity-50 ${
          compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5'
        }`}
      >
        {loading ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
        ) : (
          <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
        )}
        <span>{loading ? 'Menghubungkan...' : 'Hubungkan Google'}</span>
      </button>

      {error && (
        <div className="absolute right-0 top-full mt-1 w-64 p-2 bg-red-600 text-white text-[11px] rounded shadow-lg z-50 flex items-start space-x-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
