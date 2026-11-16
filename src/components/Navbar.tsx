import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useForms } from '../context/FormContext.tsx';
import { UserRole } from '../types/index.ts';
import { 
  FileText, 
  CheckCircle2, 
  PlusCircle, 
  Shield, 
  UserPlus, 
  LogOut, 
  LogIn,
  Zap,
  Users
} from 'lucide-react';
import { GoogleAutoSyncModal } from './GoogleAutoSyncModal.tsx';
import { UserRoleManagementModal } from './UserRoleManagementModal.tsx';
import { isAutoSyncConfigured } from '../utils/googleWorkspace.ts';

interface NavbarProps {
  activeTab: 'dashboard' | 'create' | 'approvals';
  setActiveTab: (tab: 'dashboard' | 'create' | 'approvals') => void;
  onOpenRegister?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenRegister }) => {
  const {
    currentUser,
    currentRole,
    switchRegisteredUser,
    registeredUsers,
    logout,
    setShowAuthModal,
    setAuthModalMode,
    isCLevel,
    isAdmin,
  } = useAuth();
  const { pendingCountForUser } = useForms();

  const myPendingCount = currentRole ? pendingCountForUser(currentRole) : 0;
  const [showAutoSyncModal, setShowAutoSyncModal] = React.useState(false);
  const [showRoleModal, setShowRoleModal] = React.useState(false);
  const autoSyncOn = isAutoSyncConfigured();

  // Format clean role and title without repetition
  const getCleanUserSubtitle = () => {
    if (!currentUser) return '';
    if (currentUser.role === 'Staff') {
      return `Staff • Divisi ${currentUser.division || 'Finance'}`;
    }
    const title = currentUser.title || currentUser.role;
    // Prevent repetitive strings like "CSO (Services) (Services)"
    if (title.toLowerCase().includes(currentUser.division?.toLowerCase() || '')) {
      return title;
    }
    return `${title} • ${currentUser.division || 'CLX'}`;
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-lg w-full">
      <div className="w-full max-w-[1720px] 2xl:max-w-[1850px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-center justify-between min-h-[64px] py-2.5 gap-3">
          {/* Brand Logo & Title with official CLX launcher icon */}
          <div 
            className="flex items-center space-x-2.5 cursor-pointer select-none shrink-0" 
            onClick={() => setActiveTab('dashboard')}
          >
            <img 
              src="/clx_launcher_icon.png" 
              alt="Logo CLX" 
              className="w-9 h-9 object-contain rounded-xl shadow-md bg-white p-0.5 border border-slate-700 hover:scale-105 transition-transform" 
            />
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-sm tracking-tight text-white uppercase whitespace-nowrap">
                  PT. CONNECTIVITY LEADS EXCELLENCE
                </span>
                <span className="hidden 2xl:inline-block text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800/80 px-2 py-0.5 rounded-full whitespace-nowrap">
                  FPU • FPP • FPPB
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden lg:block leading-tight mt-0.5">
                Financial, Operational & Purchase Control System
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            {/* Dashboard: Available to all users (Staff gets Maker Tracking, C-Level gets Executive Overview) */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'create'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Form</span>
            </button>

            {/* Pending Approvals: For C-Level users */}
            {isCLevel && (
              <button
                onClick={() => setActiveTab('approvals')}
                className={`relative flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'approvals'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Pending Approvals</span>
                {myPendingCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] font-black bg-amber-500 text-slate-950 rounded-full animate-pulse shadow-xs">
                    {myPendingCount}
                  </span>
                )}
              </button>
            )}
          </nav>

          {/* User Account / Role & Registration */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Auto-Sync & Role Management: Admin Only (clx.hartono17@gmail.com) */}
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowRoleModal(true)}
                  data-testid="manage-roles-btn"
                  title="Kelola Role Pengguna (Tetapkan CEO, COO, CFO - Khusus Admin)"
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs border whitespace-nowrap bg-indigo-950/90 border-indigo-600/80 text-indigo-200 hover:bg-indigo-900"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Kelola Role</span>
                </button>

                <button
                  onClick={() => setShowAutoSyncModal(true)}
                  title="Status Sinkronisasi Otomatis Google Sheets Backend (Khusus Admin)"
                  className={`inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs border whitespace-nowrap ${
                    autoSyncOn
                      ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300 hover:bg-emerald-900'
                      : 'bg-blue-950/80 border-blue-600/70 text-blue-300 hover:bg-blue-900'
                  }`}
                >
                  <Zap className={`w-3.5 h-3.5 ${autoSyncOn ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <span className="hidden sm:inline">
                    {autoSyncOn ? 'Auto-Sync Aktif' : 'Auto-Sync Sheet'}
                  </span>
                </button>

                <GoogleAutoSyncModal
                  isOpen={showAutoSyncModal}
                  onClose={() => setShowAutoSyncModal(false)}
                />

                <UserRoleManagementModal
                  isOpen={showRoleModal}
                  onClose={() => setShowRoleModal(false)}
                  onOpenRegisterNewUser={() => {
                    setAuthModalMode('register');
                    setShowAuthModal(true);
                  }}
                />
              </>
            )}

            {currentUser ? (
              <>
                <button
                  onClick={() => {
                    setAuthModalMode('register');
                    if (onOpenRegister) onOpenRegister();
                    else setShowAuthModal(true);
                  }}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-bold text-blue-200 bg-blue-950/80 hover:bg-blue-900 border border-blue-800 rounded-lg transition whitespace-nowrap"
                >
                  <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Daftar User</span>
                </button>

                <div className="hidden 2xl:flex flex-col text-right leading-tight">
                  <span className="text-xs font-bold text-slate-200 max-w-[140px] truncate">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-slate-400 max-w-[140px] truncate">
                    {getCleanUserSubtitle()}
                  </span>
                </div>

                {isAdmin ? (
                  <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 max-w-[190px]">
                    <Shield className="w-3.5 h-3.5 text-blue-400 mr-1.5 shrink-0" />
                    <select
                      aria-label="Akun terdaftar"
                      value={currentUser.id}
                      onChange={e => switchRegisteredUser(e.target.value)}
                      className="bg-transparent text-xs font-bold text-blue-300 focus:outline-none cursor-pointer pr-1 w-full truncate"
                    >
                      {registeredUsers.map(u => (
                        <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div
                    data-testid="active-user-badge"
                    className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 max-w-[200px]"
                  >
                    <Shield className="w-3.5 h-3.5 text-blue-400 mr-1.5 shrink-0" />
                    <span className="text-xs font-bold text-blue-200 truncate">
                      {currentUser.name} ({currentUser.role})
                    </span>
                  </div>
                )}

                <button
                  onClick={logout}
                  title="Keluar dari akun"
                  aria-label="Keluar dari akun"
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setAuthModalMode('login');
                    setShowAuthModal(true);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Masuk / Login</span>
                </button>
                <button
                  onClick={() => {
                    setAuthModalMode('register');
                    if (onOpenRegister) onOpenRegister();
                    else setShowAuthModal(true);
                  }}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-blue-200 bg-blue-950/80 hover:bg-blue-900 border border-blue-800 rounded-lg transition"
                >
                  <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                  <span>Daftar Akun</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
