import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar as CalendarIcon, Flame, DollarSign, Package, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { BrasaGracaEntry } from '../types';
import { formatCurrency, cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ConfirmModal } from './ConfirmModal';

const BrasaGraca: React.FC = () => {
  const [entries, setEntries] = useState<BrasaGracaEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    item: '',
    quantitySold: 0,
    totalCost: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    const q = query(collection(db, 'brasa_graca'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as BrasaGracaEntry[];
      setEntries(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'brasa_graca');
    });
    return unsubscribe;
  }, []);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const profit = formData.totalRevenue - formData.totalCost;
    
    const newEntry = {
      ...formData,
      profit,
      timestamp: Date.now(),
    };
    
    try {
      await addDoc(collection(db, 'brasa_graca'), newEntry);
      setShowForm(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        item: '',
        quantitySold: 0,
        totalCost: 0,
        totalRevenue: 0,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'brasa_graca');
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'brasa_graca', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `brasa_graca/${id}`);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pt-20 px-4">
      <header className="py-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Flame className="text-orange-500" />
            Brasa & Graça
          </h1>
          <p className="text-slate-400 font-medium">Churrasco e Marmitex Mensal</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-orange-600 text-white p-3 rounded-full shadow-lg shadow-orange-900/30 hover:bg-orange-700 transition-all active:scale-95"
        >
          <Plus size={24} />
        </button>
      </header>

      <div className="bg-gradient-to-br from-orange-500 to-red-600 p-6 rounded-3xl text-white shadow-2xl space-y-4 ring-1 ring-white/10">
        <div className="flex justify-between items-center">
          <p className="text-orange-100 font-bold text-sm uppercase tracking-wider opacity-80">Resumo Brasa</p>
          <Flame size={24} className="text-orange-200" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-4xl font-black">{formatCurrency(entries.reduce((acc, curr) => acc + curr.totalRevenue, 0))}</p>
            <p className="text-orange-100 text-[10px] uppercase font-bold">Total Arrecadado</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-black text-orange-200">{formatCurrency(entries.reduce((acc, curr) => acc + curr.totalCost, 0))}</p>
            <p className="text-orange-100 text-[10px] uppercase font-bold">Total Investido</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 p-6 rounded-3xl shadow-2xl border border-slate-800 fixed inset-x-4 top-20 z-40 md:relative md:top-0"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-100">Novo Registro de Venda</h2>
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                className="text-slate-500 hover:text-slate-400"
              >
                Fechar
              </button>
            </div>
            <form onSubmit={handleAddEntry} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Data do Evento</label>
                <input 
                  type="date" 
                  required
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">O que foi vendido?</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Churrasco Completo e Bebidas"
                  value={formData.item}
                  onChange={e => setFormData({...formData, item: e.target.value})}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Valor Investido</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={formData.totalCost || ''}
                    onChange={e => setFormData({...formData, totalCost: Number(e.target.value)})}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Valor Arrecadado</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={formData.totalRevenue || ''}
                    onChange={e => setFormData({...formData, totalRevenue: Number(e.target.value)})}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Quantidade de Vendas</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  value={formData.quantitySold || ''}
                  onChange={e => setFormData({...formData, quantitySold: Number(e.target.value)})}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                  placeholder="Ex: 45"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-900/30 mt-4 active:scale-95 transition-all uppercase tracking-widest text-sm"
              >
                Salvar Registro
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-100 px-1">Registros de Vendas</h3>
        {entries.length === 0 ? (
          <div className="bg-slate-900/50 p-8 rounded-2xl border border-dashed border-slate-800 text-center">
            <p className="text-slate-500 font-medium">Nenhum registro encontrado.</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-800">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-950/30 flex items-center justify-center text-orange-500">
                    <Flame size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100">{entry.item}</h4>
                    <p className="text-xs text-slate-500 font-medium">{formatDate(entry.date)}</p>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setDeleteId(entry.id); }} className="text-slate-700 hover:text-red-500 transition-colors p-1">
                  <Trash2 size={18} />
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-4 border-t border-slate-800 pt-3">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Qtd Vendas</p>
                  <p className="text-sm font-bold text-slate-300">{entry.quantitySold || 0}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Investimento</p>
                  <p className="text-sm font-bold text-slate-300">{formatCurrency(entry.totalCost)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-bold uppercase transition-all">Arrecadação</p>
                  <p className="text-sm font-black text-green-400">{formatCurrency(entry.totalRevenue)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteId}
        message="Você realmente quer excluir esta ação?"
        onConfirm={() => {
          if (deleteId) deleteEntry(deleteId);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};

export default BrasaGraca;
