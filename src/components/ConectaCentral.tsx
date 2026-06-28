import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar as CalendarIcon, Info, TrendingUp, DollarSign, Pencil, BarChart3, Users } from 'lucide-react';
import { ConectaCentralEvent } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ConfirmModal } from './ConfirmModal';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, AreaChart, Area, Cell
} from 'recharts';

const PREDEFINED_EVENTS = [
  { date: '2026-08-15', name: 'Festival de Inverno' },
  { date: '2026-10-24', name: 'Cine Central' },
  { date: '2026-12-13', name: 'Almoço Tropical' },
];

const ConectaCentral: React.FC = () => {
  const [events, setEvents] = useState<ConectaCentralEvent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    date: '2026-08-15',
    name: '',
    totalRevenue: 0,
    totalExpense: 0,
    participantCount: 0,
  });

  useEffect(() => {
    const q = query(collection(db, 'conecta_central'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ConectaCentralEvent[];
      setEvents(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'conecta_central');
    });
    return unsubscribe;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const profit = formData.totalRevenue - formData.totalExpense;
    
    try {
      if (editingId) {
        await updateDoc(doc(db, 'conecta_central', editingId), {
          ...formData,
          profit,
        });
      } else {
        const newEvent = {
          ...formData,
          profit,
          timestamp: Date.now(),
        };
        await addDoc(collection(db, 'conecta_central'), newEvent);
      }
      setShowForm(false);
      setEditingId(null);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'conecta_central');
    }
  };

  const resetForm = () => {
    setFormData({
      date: '2026-08-15',
      name: '',
      totalRevenue: 0,
      totalExpense: 0,
      participantCount: 0,
    });
  };

  const handleEdit = (event: ConectaCentralEvent) => {
    setFormData({
      date: event.date,
      name: event.name,
      totalRevenue: event.totalRevenue,
      totalExpense: event.totalExpense,
      participantCount: event.participantCount || 0,
    });
    setEditingId(event.id);
    setShowForm(true);
  };

  const deleteEvent = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'conecta_central', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `conecta_central/${id}`);
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pt-20 px-4">
      <header className="py-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <CalendarIcon className="text-violet-400" />
            Conecta Central
          </h1>
          <p className="text-slate-400 font-medium">Grandes Eventos Bimestrais</p>
        </div>
        <button 
          onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}
          className="bg-blue-600 text-white p-3 rounded-full shadow-lg shadow-blue-900/30 hover:bg-blue-700 transition-all active:scale-95"
        >
          <Plus size={24} />
        </button>
      </header>

      {/* Predefined Events Highlight */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest pl-1">Próximos Grandes Eventos</h3>
        <div className="grid grid-cols-1 gap-3">
          {PREDEFINED_EVENTS.map((event, idx) => (
            <button 
              key={idx} 
              onClick={() => {
                setFormData({
                  date: event.date,
                  name: event.name,
                  totalRevenue: 0,
                  totalExpense: 0,
                  participantCount: 0
                });
                setEditingId(null);
                setShowForm(true);
              }}
              className="w-full text-left bg-gradient-to-r from-blue-600 to-indigo-700 p-4 rounded-2xl shadow-xl text-white ring-1 ring-white/10 active:scale-[0.98] transition-all group"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-blue-100 text-xs font-bold opacity-80">{formatDate(event.date)}</p>
                  <h4 className="text-lg font-bold group-hover:translate-x-1 transition-transform">{event.name}</h4>
                </div>
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm group-hover:bg-white/30 transition-all">
                  <Pencil size={18} className="text-white" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Analytics Section */}
      {events.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <BarChart3 size={16} className="text-blue-500" />
              Análise de Desempenho
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue vs Expenses Chart */}
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <TrendingUp size={18} className="text-blue-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">Receita vs Despesas</h4>
                  <p className="text-[10px] text-slate-500 font-medium">Comparativo financeiro por evento</p>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={events.slice().reverse()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fill: "#64748b" }}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `R$ ${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px" }}
                      itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
                      labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
                      formatter={(value: number) => [formatCurrency(value), ""]}
                    />
                    <Legend />
                    <Bar name="Receita" dataKey="totalRevenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar name="Despesa" dataKey="totalExpense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Profit Margin Chart */}
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-sm backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <DollarSign size={18} className="text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">Evolução do Lucro</h4>
                  <p className="text-[10px] text-slate-500 font-medium">Lucro líquido gerado por data</p>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={events.slice().reverse()}>
                    <defs>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `R$ ${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px" }}
                      formatter={(value: number) => [formatCurrency(value), "Lucro"]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey={(item) => item.totalRevenue - item.totalExpense} 
                      name="profit"
                      stroke="#10b981" 
                      fillOpacity={1} 
                      fill="url(#colorProfit)" 
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Participant Attendance Trend */}
            <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 shadow-sm backdrop-blur-sm lg:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-violet-500/10 rounded-lg">
                  <Users size={18} className="text-violet-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100">Participação de Público</h4>
                  <p className="text-[10px] text-slate-500 font-medium">Engajamento total por evento</p>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={events.slice().reverse()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "12px" }}
                      cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
                    />
                    <Bar name="Participantes" dataKey="participantCount" radius={[4, 4, 0, 0]}>
                      {events.slice().reverse().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#8b5cf6' : '#a78bfa'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 p-6 rounded-3xl shadow-2xl border border-slate-800 fixed inset-x-4 top-20 z-40 md:relative md:top-0 h-auto max-h-[80vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-slate-100">
                {editingId ? 'Editar Evento' : 'Registrar Evento'}
              </h2>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-slate-500 hover:text-slate-400">
                Fechar
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <label className="text-sm font-medium text-slate-400">Nome do Evento</label>
                <input 
                  type="text" 
                  required
                  placeholder="Ex: Festival de Inverno"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium placeholder:text-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Total Arrecadado</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={formData.totalRevenue || ''}
                    onChange={e => setFormData({...formData, totalRevenue: Number(e.target.value)})}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">Total Gasto</label>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    value={formData.totalExpense || ''}
                    onChange={e => setFormData({...formData, totalExpense: Number(e.target.value)})}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Quantidade de Participantes</label>
                <input 
                  type="number" 
                  required
                  value={formData.participantCount || ''}
                  onChange={e => setFormData({...formData, participantCount: Number(e.target.value)})}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                  placeholder="Ex: 50"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/30 mt-4 active:scale-95 transition-all uppercase tracking-widest text-sm"
              >
                {editingId ? 'Atualizar Evento' : 'Salvar Evento'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest pl-1">Histórico de Resultados</h3>
        {events.length === 0 ? (
          <div className="bg-slate-900/50 p-8 rounded-2xl border border-dashed border-slate-800 text-center">
            <p className="text-slate-500 font-medium">Nenhum evento registrado ainda.</p>
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-800 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 cursor-pointer" onClick={() => handleEdit(event)}>
                  <p className="text-xs text-slate-500 font-medium">{formatDate(event.date)}</p>
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-bold text-slate-100">{event.name}</h4>
                    <span className="bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ring-1 ring-violet-500/20">
                      {event.participantCount || 0} Partic.
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleEdit(event)}
                    className="flex flex-col items-center gap-1 text-blue-400 bg-blue-400/10 p-2 rounded-xl border border-blue-400/20 hover:bg-blue-400/20 transition-all"
                  >
                    <Pencil size={18} />
                    <span className="text-[8px] font-bold uppercase">Editar</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setDeleteId(event.id); }}
                    className="flex flex-col items-center gap-1 text-slate-500 hover:text-red-500 bg-slate-800 p-2 rounded-xl border border-slate-700 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 size={18} />
                    <span className="text-[8px] font-bold uppercase">Excluir</span>
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Entrada</p>
                  <p className="text-sm font-bold text-green-400">{formatCurrency(event.totalRevenue)}</p>
                </div>
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Saída</p>
                  <p className="text-sm font-bold text-red-400">{formatCurrency(event.totalExpense)}</p>
                </div>
                <div className={cn("p-2 rounded-xl border", event.profit >= 0 ? "bg-blue-950/20 border-blue-900/30" : "bg-red-950/20 border-red-900/30")}>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Lucro</p>
                  <p className={cn("text-sm font-black", event.profit >= 0 ? "text-blue-400" : "text-red-400")}>
                    {formatCurrency(event.profit)}
                  </p>
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
          if (deleteId) deleteEvent(deleteId);
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};

export default ConectaCentral;
