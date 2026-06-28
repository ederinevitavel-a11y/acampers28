import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar as CalendarIcon, Ticket, Trophy, Users, DollarSign } from 'lucide-react';
import { RecebaSuabencaoRaffle } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ConfirmModal } from './ConfirmModal';

const RecebaSuabencao: React.FC = () => {
  const [raffles, setRaffles] = useState<RecebaSuabencaoRaffle[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    prize: '',
    participantsCount: 0,
    winnerName: '',
    ticketPrice: 2.00,
  });

  useEffect(() => {
    const q = query(collection(db, 'receba_bencao'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RecebaSuabencaoRaffle[];
      setRaffles(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'receba_bencao');
    });
    return unsubscribe;
  }, []);

  const handleAddRaffle = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalRevenue = formData.participantsCount * formData.ticketPrice;
    
    const newRaffle = {
      ...formData,
      totalRevenue,
      timestamp: Date.now(),
    };
    
    try {
      await addDoc(collection(db, 'receba_bencao'), newRaffle);
      setShowForm(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        prize: '',
        participantsCount: 0,
        winnerName: '',
        ticketPrice: 2.00,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'receba_bencao');
    }
  };


  const deleteRaffle = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'receba_bencao', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `receba_bencao/${id}`);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pt-20 px-4">
      <header className="py-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Ticket className="text-rose-400" />
            Receba sua Benção
          </h1>
          <p className="text-slate-400 font-medium">Sorteios Dominicais de Baixo Custo</p>
        </div>
        <button 
          onClick={() => setShowForm(true)}
          className="bg-purple-600 text-white p-3 rounded-full shadow-lg shadow-purple-900/30 active:scale-95 transition-all"
        >
          <Plus size={24} />
        </button>
      </header>

      {/* Raffle Card */}
      <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden ring-1 ring-white/10">
        <Ticket className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12" />
        <div className="relative z-10">
          <p className="text-purple-100 text-xs font-bold uppercase tracking-widest mb-1 opacity-80">Impacto dos Sorteios</p>
          <h2 className="text-4xl font-black mb-2">{formatCurrency(raffles.reduce((acc, curr) => acc + curr.totalRevenue, 0))}</h2>
          <p className="text-purple-100 text-sm font-medium">Arrecadados com a colaboração de todos</p>
          <div className="flex gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl ring-1 ring-white/20">
              <p className="text-[10px] uppercase font-bold text-purple-200">Participantes</p>
              <p className="text-lg font-bold">{raffles.reduce((acc, curr) => acc + curr.participantsCount, 0)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl ring-1 ring-white/20">
              <p className="text-[10px] uppercase font-bold text-purple-200">Ganhadores</p>
              <p className="text-lg font-bold">{raffles.length}</p>
            </div>
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
              <h2 className="text-lg font-bold text-slate-100">Novo Sorteio</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-400">
                Fechar
              </button>
            </div>
            <form onSubmit={handleAddRaffle} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">O que foi sorteado?</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Cesta de Café"
                  value={formData.prize}
                  onChange={e => setFormData({...formData, prize: e.target.value})}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium placeholder:text-slate-600"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Ganhador(a)</label>
                <div className="relative">
                  <Trophy className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" size={18} />
                  <input 
                    type="text" 
                    required
                    placeholder="Nome do vencedor"
                    value={formData.winnerName}
                    onChange={e => setFormData({...formData, winnerName: e.target.value})}
                    className="w-full p-3 pl-10 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Qtd Participantes</label>
                  <input 
                    type="number" 
                    required
                    value={formData.participantsCount || ''}
                    onChange={e => setFormData({...formData, participantsCount: Number(e.target.value)})}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Valor Ticket</label>
                  <input 
                    type="number" 
                    step="0.50"
                    required
                    value={formData.ticketPrice || ''}
                    onChange={e => setFormData({...formData, ticketPrice: Number(e.target.value)})}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                  />
                </div>
              </div>


              <button 
                type="submit"
                className="w-full bg-purple-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-900/30 mt-4 active:scale-95 transition-all uppercase tracking-widest text-sm"
              >
                Registrar Sorteio
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-100">Sorteios Realizados</h3>
        {raffles.length === 0 ? (
          <div className="bg-slate-900/50 p-8 rounded-2xl border border-dashed border-slate-800 text-center">
            <p className="text-slate-500 font-medium">Nenhum sorteio registrado.</p>
          </div>
        ) : (
          raffles.map((raffle) => (
            <div key={raffle.id} className="bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-800">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Ticket size={20} className="text-purple-500" />
                    {raffle.prize}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">{formatDate(raffle.date)}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setDeleteId(raffle.id); }} className="text-slate-700 hover:text-red-500 transition-colors">
                  <Trash2 size={20} />
                </button>
              </div>
              
                <div className="flex items-center gap-2 mt-4 p-3 bg-amber-950/20 rounded-xl border border-amber-900/30">
                  <Trophy size={20} className="text-amber-500" />
                  <div className="flex-1">
                    <p className="text-[10px] text-amber-600 font-bold uppercase leading-none">Ganhador</p>
                    <p className="font-bold text-slate-100">{raffle.winnerName}</p>
                  </div>
                </div>
              
              <div className="flex justify-between items-center text-sm mt-4">
                <div className="flex items-center gap-1 text-slate-500 font-medium">
                  <Users size={16} />
                  <span>{raffle.participantsCount} pessoas</span>
                </div>
                <div className="font-black text-green-400 text-lg">
                  {formatCurrency(raffle.totalRevenue)}
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
          if (deleteId) deleteRaffle(deleteId);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};

export default RecebaSuabencao;
