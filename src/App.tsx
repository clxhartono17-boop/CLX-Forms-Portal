import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { FormProvider, useForms } from './context/FormContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { FormCreator } from './components/FormCreator.tsx';
import { ApprovalQueue } from './components/ApprovalQueue.tsx';
import { GoogleCloudSettings } from './components/GoogleCloudSettings.tsx';
import { FormDetailsModal } from './components/FormDetailsModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { FormDocument } from './types/index.ts';

function MainApp() {
  const { showAuthModal, setShowAuthModal } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'approvals' | 'settings'>('dashboard');
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
          <Dashboard
            onSelectDoc={doc => setSelectedDoc(doc)}
            onCreateNew={() => setActiveTab('create')}
          />
        )}

        {activeTab === 'create' && (
          <FormCreator
            onSuccess={handleFormCreated}
            onCancel={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'approvals' && <ApprovalQueue />}

        {activeTab === 'settings' && <GoogleCloudSettings />}
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
