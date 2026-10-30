import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { FormProvider, useForms } from './context/FormContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { FormCreator } from './components/FormCreator.tsx';
import { ApprovalQueue } from './components/ApprovalQueue.tsx';
import { FormDetailsModal } from './components/FormDetailsModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { FormDocument } from './types/index.ts';
import { ShieldAlert, PlusCircle, LogIn } from 'lucide-react';

function MainApp() {
  const { showAuthModal, setShowAuthModal, currentUser, isCLevel } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'approvals'>('create');
  const [selectedDoc, setSelectedDoc] = useState<FormDocument | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Automatically switch tab based on role upon login
  React.useEffect(() => {
    if (isCLevel && activeTab === 'create') {
      setActiveTab('dashboard');
    } else if (!isCLevel && activeTab === 'dashboard') {
      setActiveTab('create');
    }
  }, [isCLevel]);

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleFormCreated = (createdDoc: FormDocument) => {
    showNotification(`Form ${createdDoc.docNumber} berhasil dibuat dan otomatis terinput ke "Rekapan Form"!`);
    if (isCLevel) {
      setActiveTab('dashboard');
    } else {
      setActiveTab('create');
    }
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 w-full">
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          isCLevel ? (
            <Dashboard
              onSelectDoc={doc => setSelectedDoc(doc)}
              onCreateNew={() => setActiveTab('create')}
            />
          ) : (
            <div className="max-w-xl mx-auto my-12 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden p-8 text-center animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200 shadow-xs">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <span className="inline-block px-3 py-1 bg-red-100 text-red-900 text-[11px] font-bold uppercase rounded-full mb-2">
                Hak Akses Dibatasi (C-Level Only)
              </span>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                Dashboard Hanya Untuk CSO, COO, CFO & CEO
              </h2>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed max-w-md mx-auto">
                Ringkasan metrik anggaran, statistik pengeluaran, dan analitik finansial perusahaan CLX hanya dapat diakses oleh jajaran Direksi & C-Level (CSO, COO, CFO, CEO).
              </p>

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => setActiveTab('create')}
                  className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center space-x-1.5"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Buka Form Pembuatan (Create Form)</span>
                </button>
                {!currentUser && (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition flex items-center justify-center space-x-1.5"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Masuk Akun Direksi</span>
                  </button>
                )}
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
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PT. Connectivity Leads eXcellence (CLX) &copy; 2026. All rights reserved.</span>
          <span className="font-mono text-[11px] text-slate-400">
            FPU • PFB • FPPB Corporate Voucher & Approval System
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
