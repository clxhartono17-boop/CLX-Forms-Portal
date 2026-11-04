import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { FormProvider, useForms } from './context/FormContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { StaffMakerDashboard } from './components/StaffMakerDashboard.tsx';
import { FormCreator } from './components/FormCreator.tsx';
import { ApprovalQueue } from './components/ApprovalQueue.tsx';
import { FormDetailsModal } from './components/FormDetailsModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { FormDocument } from './types/index.ts';
import { ShieldCheck, PlusCircle, LogIn, Lock } from 'lucide-react';

function MainApp() {
  const { showAuthModal, setShowAuthModal, currentUser, isCLevel } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'approvals'>('dashboard');
  const [selectedDoc, setSelectedDoc] = useState<FormDocument | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleFormCreated = (createdDoc: FormDocument) => {
    showNotification(`Form ${createdDoc.docNumber} berhasil dibuat dan otomatis terinput ke "Rekapan Form"!`);
    setActiveTab('dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Top Navigation */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onOpenRegister={() => setShowAuthModal(true)}
      />

      {/* Notification Toast */}
      {notification && (
        <div className="w-full max-w-[1720px] 2xl:max-w-[1850px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 pt-4">
          <div className="bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-md flex items-center justify-between">
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="text-white hover:text-emerald-200 ml-4"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1720px] 2xl:max-w-[1850px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-6">
        {activeTab === 'dashboard' && (
          currentUser ? (
            isCLevel ? (
              <Dashboard
                onSelectDoc={doc => setSelectedDoc(doc)}
                onCreateNew={() => setActiveTab('create')}
              />
            ) : (
              <StaffMakerDashboard
                onSelectDoc={doc => setSelectedDoc(doc)}
                onCreateNew={() => setActiveTab('create')}
              />
            )
          ) : (
            <div className="max-w-xl mx-auto my-12 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden p-8 text-center animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-200 shadow-xs">
                <Lock className="w-8 h-8" />
              </div>
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-900 text-[11px] font-bold uppercase rounded-full mb-2">
                Portal Otentikasi Karyawan
              </span>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                Silakan Masuk Untuk Mengakses Dashboard
              </h2>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed max-w-md mx-auto">
                Masuk dengan akun terdaftar di <em>Master Login</em> untuk memantau status approval pengajuan formulir Anda (Staff/Maker) atau melihat analitik eksekutif (C-Level).
              </p>

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center space-x-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Masuk / Login Akun</span>
                </button>
                <button
                  onClick={() => setActiveTab('create')}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition flex items-center justify-center space-x-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Buat Form Baru</span>
                </button>
              </div>
            </div>
          )
        )}

        {activeTab === 'create' && (
          <FormCreator
            onSuccess={handleFormCreated}
            onCancel={() => setActiveTab(isCLevel ? 'dashboard' : 'create')}
          />
        )}

        {activeTab === 'approvals' && <ApprovalQueue />}
      </main>

      {/* Document Details Modal */}
      {selectedDoc && (
        <FormDetailsModal
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
        />
      )}

      {/* Registration & Login Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="w-full max-w-[1720px] 2xl:max-w-[1850px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PT. Connectivity Leads eXcellence (CLX) &copy; 2026. All rights reserved.</span>
          <span className="font-mono text-[11px] text-slate-400">
            FPU • FPP • FPPB Corporate Voucher & Approval System
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FormProvider>
        <MainApp />
      </FormProvider>
    </AuthProvider>
  );
}
