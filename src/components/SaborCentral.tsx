import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar as CalendarIcon, Utensils, DollarSign, Package, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { SaborCentralEntry } from '../types';
import { formatCurrency, cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ConfirmModal } from './ConfirmModal';

const SaborCentral: React.FC = () => {
  const [entries, setEntries] = useState<SaborCentralEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    item: '',
    totalCost: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    const q = query(collection(db, 'sabor_central'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SaborCentralEntry[];
      setEntries(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sabor_central');
    });
    return unsubscribe;
  }, []);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const profit = formData.totalRevenue - formData.totalCost;
    
    const newEntry = {
      ...formData,
      quantitySold: 1, // backwards comp
      unitCost: formData.totalCost, // backwards comp
      profit,
      isPaid: true, // remove ui but keep DB schema happy
      timestamp: Date.now(),
    };
    
    try {
      await addDoc(collection(db, 'sabor_central'), newEntry);
      setShowForm(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        item: '',
        totalCost: 0,
        totalRevenue: 0,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sabor_central');
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sabor_central', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sabor_central/${id}`);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pt-20 px-4">
      <header className="py-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
            <Utensils className="text-emerald-400" size={24} />
            Sabor Central
          </h1>
          <p className="text-[10px] sm:text-slate-400 font-bold text-slate-500 uppercase tracking-widest">Cantina Dominical Pós Culto</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-emerald-600 text-white p-3 rounded-xl sm:rounded-full shadow-lg shadow-emerald-900/30 active:scale-95 transition-all"
        >
          <Plus size={20} />
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800 shadow-sm text-center">
          <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Arrecadado</p>
          <p className="text-base sm:text-xl font-black text-slate-100 truncate">{formatCurrency(entries.reduce((acc, curr) => acc + curr.totalRevenue, 0))}</p>
        </div>
        <div className="bg-slate-900/50 p-3 rounded-2xl border border-slate-800 shadow-sm text-center">
          <p className="text-[9px] text-amber-500 font-black uppercase tracking-widest mb-1">Investido</p>
          <p className="text-base sm:text-xl font-black text-amber-400 truncate">{formatCurrency(entries.reduce((acc, curr) => acc + curr.totalCost, 0))}</p>
        </div>
        <div className="bg-green-500/5 p-3 rounded-2xl border border-green-500/10 shadow-sm text-center col-span-2 md:col-span-1">
          <p className="text-[9px] text-green-500 font-black uppercase tracking-widest mb-1">Lucro Líquido</p>
          <p className="text-lg sm:text-xl font-black text-green-400 truncate">{formatCurrency(entries.reduce((acc, curr) => acc + curr.profit, 0))}</p>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="bg-slate-900 p-6 rounded-t-3xl shadow-2xl border-t border-slate-800 fixed inset-x-0 bottom-0 top-10 z-50 md:relative md:top-0 md:rounded-3xl md:border md:inset-x-0 md:bottom-auto overflow-y-auto no-scrollbar"
          >
            <div className="w-12 h-1 bg-slate-800 rounded-full mx-auto mb-6 md:hidden" />
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
                <Plus className="text-emerald-500" />
                Novo Registro
              </h2>
              <button 
                onClick={() => setShowForm(false)} 
                className="bg-slate-800 text-slate-400 p-2 rounded-full hover:text-slate-200 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleAddEntry} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <CalendarIcon size={16} /> Data
                </label>
                <input 
                  type="date" 
                  required
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-100 transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Utensils size={16} /> O que foi vendido?
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Pastel de Carne"
                  value={formData.item}
                  onChange={e => setFormData({...formData, item: e.target.value})}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-100 transition-all font-medium placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <DollarSign size={16} /> Quanto foi investido na ação?
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={formData.totalCost || ''}
                  onChange={e => setFormData({...formData, totalCost: Number(e.target.value)})}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <TrendingUp size={16} /> Valor Arrecadado Total
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={formData.totalRevenue || ''}
                  onChange={e => setFormData({...formData, totalRevenue: Number(e.target.value)})}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/30 mt-4 active:scale-95 transition-all uppercase text-sm tracking-widest"
              >
                Salvar Registro
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-100">Registros Recentes</h3>
        {entries.length === 0 ? (
          <div className="bg-slate-900/50 p-8 rounded-2xl border border-dashed border-slate-800 text-center">
            <p className="text-slate-500">Nenhum registro ainda. Comece adicionando um!</p>
          </div>
        ) : (
          entries.map((entry) => (
            <motion.div 
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              key={entry.id} 
              className="bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-800 flex justify-between items-start"
            >
              <div className="space-y-1">
                <p className="text-xs text-slate-500 font-medium">{formatDate(entry.date)}</p>
                <p className="text-lg font-bold text-slate-100">{entry.item}</p>
                <div className="flex gap-4 text-sm text-slate-400 font-medium">
                  <span>Investimento: {formatCurrency(entry.totalCost)}</span>
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-3">
                <div className="bg-slate-900/50 p-2 rounded-xl mt-1 border border-slate-700">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center">Arrecadado</p>
                  <div className="font-bold text-slate-100 text-lg">
                    {formatCurrency(entry.totalRevenue)}
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setDeleteId(entry.id); }}
                  className="text-slate-700 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
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

export default SaborCentral;
