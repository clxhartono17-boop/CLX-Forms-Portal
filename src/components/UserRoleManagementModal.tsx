import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { UserRole } from '../types/index.ts';
import { ALL_ROLES, ADMIN_EMAIL, isAdminOnlyRole } from '../utils/adminAuth.ts';
import {
  ShieldCheck,
  Search,
  X,
  UserPlus,
  CheckCircle,
  AlertCircle,
  PenTool,
  RefreshCw,
} from 'lucide-react';

interface UserRoleManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRegisterNewUser: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  Staff: 'Staff (Maker)',
  CSO: 'CSO (Chief Strategy Officer)',
  COO: 'COO (Chief Operating Officer)',
  CFO: 'CFO (Chief Financial Officer)',
  CEO: 'CEO (Chief Executive Officer)',
};

export const UserRoleManagementModal: React.FC<UserRoleManagementModalProps> = ({
  isOpen,
  onClose,
  onOpenRegisterNewUser,
}) => {
  const {
    registeredUsers,
    updateUserRole,
    refreshRegisteredUsers,
    isAdmin,
  } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  if (!isOpen || !isAdmin) return null;

  const filteredUsers = registeredUsers.filter(u => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.division || '').toLowerCase().includes(q)
    );
  });

  const handleRoleChange = async (userId: string, userName: string, newRole: UserRole) => {
    setFeedback(null);
    setSavingUserId(userId);
    try {
      await updateUserRole(userId, newRole);
      setFeedback({
        message: `Role untuk ${userName} berhasil diperbarui menjadi ${newRole} dan disinkronkan ke Master Login.`,
        type: 'success',
      });
    } catch (err: any) {
      setFeedback({
        message: err?.message || 'Gagal memperbarui role pengguna.',
        type: 'error',
      });
    } finally {
      setSavingUserId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wide text-white">
                Kelola Role & Otoritas Eksekutif (Khusus Admin)
              </h2>
              <p className="text-[11px] text-slate-400">
                Hanya Admin ({ADMIN_EMAIL}) yang berhak menetapkan role CEO, COO, dan CFO.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup kelola role"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nama, email, divisi, atau role..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-800"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refreshRegisteredUsers()}
              className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Muat Ulang</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRegisterNewUser();
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Daftarkan User Baru</span>
            </button>
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className="px-4 pt-3">
            <div
              data-testid="role-update-feedback"
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
          </div>
        )}

        {/* User List */}
        <div className="p-4 max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
          {filteredUsers.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Tidak ada akun yang sesuai dengan pencarian "{searchQuery}".
            </div>
          ) : (
            filteredUsers.map(u => {
              const isPrimaryAdminAccount = u.email.trim().toLowerCase() === ADMIN_EMAIL;
              const isExecutive = isAdminOnlyRole(u.role);
              return (
                <div
                  key={u.id}
                  data-testid={`manage-user-row-${u.email}`}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-xs font-bold text-slate-900">{u.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isExecutive
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {u.role}
                      </span>
                      {u.signatureUrl && (
                        <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          <PenTool className="w-2.5 h-2.5" />
                          <span>Sign Digital</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {u.email} • Divisi {u.division || 'General'}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <label className="text-[11px] font-semibold text-slate-500 hidden md:inline">
                      Tetapkan Role:
                    </label>
                    <select
                      aria-label={`Ubah role untuk ${u.email}`}
                      value={u.role}
                      disabled={savingUserId === u.id || isPrimaryAdminAccount}
                      onChange={e => handleRoleChange(u.id, u.name, e.target.value as UserRole)}
                      className="text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    >
                      {ALL_ROLES.map(r => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
