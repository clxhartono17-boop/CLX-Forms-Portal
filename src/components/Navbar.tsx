import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useForms } from '../context/FormContext.tsx';
import { UserRole } from '../types/index.ts';
import { SYSTEM_ROLES } from '../utils/authConfig.ts';
import { 
  FileText, 
  CheckCircle2, 
  PlusCircle, 
  Shield, 
  UserPlus
} from 'lucide-react';

interface NavbarProps {
  activeTab: 'dashboard' | 'create' | 'approvals' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'create' | 'approvals' | 'settings') => void;
  onOpenRegister?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenRegister }) => {
  const { currentUser, currentRole, switchRole, setShowAuthModal } = useAuth();
  const { pendingCountForUser } = useForms();

  const myPendingCount = pendingCountForUser(currentRole);

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-black text-xl tracking-wider text-white shadow-inner">
              CLX
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base tracking-tight text-white">
                  PT. CONNECTIVITY LEADS EXCELLENCE
                </span>
                {/* Diubah dari PFB ke FPP */}
                <span className="hidden sm:inline-block text-[11px] font-medium bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded">
                  FPU / FPP / FPPB Portal
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Financial, Operational & Purchase Requisition Control System
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'create'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Form</span>
            </button>

            {/* Pending Approvals (Dedicated C-Level Menu) */}
            <button
              onClick={() => setActiveTab('approvals')}
              className={`relative flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'approvals'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Pending Approvals</span>
              {myPendingCount > 0 && (
                <span className="ml-1.5 px-2 py-0.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-full animate-pulse shadow-sm">
                  {myPendingCount}
                </span>
              )}
            </button>
          </nav>

          {/* Quick RBAC Role Switcher & Registration */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => onOpenRegister ? onOpenRegister() : setShowAuthModal(true)}
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-bold text-blue-200 bg-blue-950/80 hover:bg-blue-900 border border-blue-800 rounded-lg transition"
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Registrasi User</span>
              <span className="sm:hidden">Daftar</span>
            </button>

            <div className="hidden xl:flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-200">{currentUser?.name || 'Guest'}</span>
              <span className="text-[11px] text-slate-400">{currentUser?.title || '-'}</span>
            </div>

            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-1">
              <Shield className="w-3.5 h-3.5 text-blue-400 ml-1.5 mr-1" />
              <select
                aria-label="Switch active role"
                value={currentRole}
                onChange={e => switchRole(e.target.value as UserRole)}
                className="bg-transparent text-xs font-bold text-blue-300 focus:outline-none cursor-pointer pr-1"
              >
                {SYSTEM_ROLES.map(r => (
                  <option key={r.role} value={r.role} className="bg-slate-900 text-white">
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
