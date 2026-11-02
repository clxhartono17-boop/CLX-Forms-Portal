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
  LogIn 
} from 'lucide-react';
import { GoogleConnectButton } from './GoogleConnectButton.tsx';

interface NavbarProps {
  activeTab: 'dashboard' | 'create' | 'approvals';
  setActiveTab: (tab: 'dashboard' | 'create' | 'approvals') => void;
  onOpenRegister?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenRegister }) => {
  const { currentUser, currentRole, switchRegisteredUser, registeredUsers, logout, setShowAuthModal, isCLevel } = useAuth();
  const { pendingCountForUser } = useForms();

  const myPendingCount = currentRole ? pendingCountForUser(currentRole) : 0;

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
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-[64px] py-2.5 gap-3">
          {/* Brand Logo & Title with official CLX launcher icon */}
          <div 
            className="flex items-center space-x-3 cursor-pointer select-none shrink-0" 
            onClick={() => setActiveTab('dashboard')}
          >
            <img 
              src="/clx_launcher_icon.png" 
              alt="Logo CLX" 
              className="w-10 h-10 object-contain rounded-xl shadow-md bg-white p-0.5 border border-slate-700 hover:scale-105 transition-transform" 
            />
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-sm sm:text-base tracking-tight text-white uppercase">
                  PT. CONNECTIVITY LEADS EXCELLENCE
                </span>
                <span className="hidden sm:inline-block text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800/80 px-2 py-0.5 rounded-full">
                  FPU • FPP • FPPB
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block leading-tight mt-0.5">
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
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Google Workspace Connection Button */}
            <div className="hidden lg:block">
              <GoogleConnectButton compact={true} />
            </div>

            {currentUser ? (
              <>
                <button
                  onClick={() => onOpenRegister ? onOpenRegister() : setShowAuthModal(true)}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-blue-200 bg-blue-950/80 hover:bg-blue-900 border border-blue-800 rounded-lg transition"
                >
                  <UserPlus className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">+ Daftar User</span>
                </button>

                <div className="hidden xl:flex flex-col text-right leading-tight">
                  <span className="text-xs font-bold text-slate-200 max-w-[150px] truncate">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] text-slate-400 max-w-[150px] truncate">
                    {getCleanUserSubtitle()}
                  </span>
                </div>

                {/* Account Switcher - Only from Master Login registered accounts */}
                <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-2 py-1">
                  <Shield className="w-3.5 h-3.5 text-blue-400 mr-1.5 shrink-0" />
                  <select
                    aria-label="Akun terdaftar"
                    value={currentUser.id}
                    onChange={e => switchRegisteredUser(e.target.value)}
                    className="bg-transparent text-xs font-bold text-blue-300 focus:outline-none cursor-pointer pr-1"
                  >
                    {registeredUsers.map(u => (
                      <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={logout}
                  title="Keluar dari akun"
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Masuk / Login</span>
                </button>
                <button
                  onClick={() => onOpenRegister ? onOpenRegister() : setShowAuthModal(true)}
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
