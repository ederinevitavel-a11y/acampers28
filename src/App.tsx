/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppTab } from './types.ts';
import Navigation from './components/Navigation.tsx';
import Dashboard from './components/Dashboard.tsx';
import Participantes from './components/Participantes.tsx';
import { motion, AnimatePresence } from 'motion/react';
import { FirebaseProvider, useFirebase } from './contexts/FirebaseContext.tsx';
import { LogIn, LogOut } from 'lucide-react';

const ALLOWED_EMAILS = ['ederlcs@hotmail.com', 'elaine.rsn@hotmail.com', 'rafa-cnunes@hotmail.com', 'ribeiro.fabio.1988@gmail.com'];

function AppContent() {
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const { user, loading, error, signIn, signOut } = useFirebase();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-black">
        <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl border border-slate-800 max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 bg-blue-950 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Acampa Central 2028</h1>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-lg text-left overflow-auto max-h-32">
              <strong>Erro:</strong> {error}
            </div>
          )}

          <button 
            onClick={() => signIn()}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  if (!ALLOWED_EMAILS.includes(user.email || '')) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-black">
        <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl border border-red-900/50 max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 bg-red-950 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Acesso Negado</h1>
          <p className="text-slate-200 text-sm font-bold">O e-mail <strong>{user.email}</strong> não possui permissão de administrador.</p>
          <button 
            onClick={() => signOut()}
            className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all"
          >
            Sair e usar outra conta
          </button>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'participantes':
        return <Participantes />;
      default:
        return <Dashboard stats={[]} />;
    }
  };

  return (
    <div className="min-h-screen bg-black font-sans text-slate-100 overflow-x-hidden">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 h-[72px] px-5 relative z-40 flex items-center justify-between shadow-sm">
        <h1 className="font-display font-black text-blue-500 tracking-tighter text-lg uppercase">Central 28</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-slate-800/50 border border-slate-700/50">
            <div className="w-8 h-8 rounded-full bg-blue-900/40 flex items-center justify-center text-blue-400 font-bold text-xs ring-1 ring-blue-500/20">
              {user.displayName?.charAt(0) || 'U'}
            </div>
            <button 
              onClick={() => signOut()}
              className="p-1.5 hover:bg-red-500/10 rounded-full text-slate-300 hover:text-red-400 transition-colors flex items-center gap-1 group"
              title="Sair do App"
            >
              <LogOut size={16} />
              <span className="text-[10px] font-bold uppercase hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <AppContent />
    </FirebaseProvider>
  );
}
