/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppTab } from './types.ts';
import Navigation from './components/Navigation.tsx';
import Dashboard from './components/Dashboard.tsx';
import SaborCentral from './components/SaborCentral.tsx';
import BrilhoCeleste from './components/BrilhoCeleste.tsx';
import ConectaCentral from './components/ConectaCentral.tsx';
import BrasaGraca from './components/BrasaGraca.tsx';
import RecebaSuabencao from './components/RecebaSuabencao.tsx';
import Financeiro from './components/Financeiro.tsx';
import Participantes from './components/Participantes.tsx';
import { motion, AnimatePresence } from 'motion/react';
import { FirebaseProvider, useFirebase } from './contexts/FirebaseContext.tsx';
import { LogIn, LogOut } from 'lucide-react';

const ALLOWED_EMAILS = ['ederlcs@hotmail.com', 'elaine.rsn@hotmail.com', 'rafa-cnunes@hotmail.com'];

function AppContent() {
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const { user, loading, error, signIn, signOut } = useFirebase();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950">
        <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl border border-slate-800 max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 bg-blue-950 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Acampa Central 2028</h1>
          <p className="text-slate-400 text-sm">Acesse com sua conta Google para gerenciar as arrecadações.</p>
          
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

          <div className="pt-4 border-t border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Dica para Celular</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Se estiver no celular, abra o link diretamente no navegador (Chrome/Safari) para evitar bloqueio de popups.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!ALLOWED_EMAILS.includes(user.email || '')) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950">
        <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl border border-red-900/50 max-w-sm w-full text-center space-y-6">
          <div className="w-16 h-16 bg-red-950 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Acesso Negado</h1>
          <p className="text-slate-400 text-sm">O e-mail <strong>{user.email}</strong> não possui permissão de administrador.</p>
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
      case 'sabor':
        return <SaborCentral />;
      case 'brilho':
        return <BrilhoCeleste />;
      case 'conecta':
        return <ConectaCentral />;
      case 'brasa':
        return <BrasaGraca />;
      case 'bencao':
        return <RecebaSuabencao />;
      case 'financeiro':
        return <Financeiro />;
      default:
        return <Dashboard stats={[]} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200 overflow-x-hidden">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 h-[72px] px-5 sticky top-0 z-40 flex items-center justify-between shadow-sm">
        <h1 className="font-display font-black text-blue-500 tracking-tighter text-lg uppercase">Central 28</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-slate-800/50 border border-slate-700/50">
            <div className="w-8 h-8 rounded-full bg-blue-900/40 flex items-center justify-center text-blue-400 font-bold text-xs ring-1 ring-blue-500/20">
              {user.displayName?.charAt(0) || 'U'}
            </div>
            <button 
              onClick={() => signOut()}
              className="p-1.5 hover:bg-red-500/10 rounded-full text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1 group"
              title="Sair do App"
            >
              <LogOut size={16} />
              <span className="text-[10px] font-bold uppercase hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 md:pb-8 pt-4 md:pt-40">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
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
