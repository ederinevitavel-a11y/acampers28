import React, { useMemo, useState, useEffect } from 'react';
import { formatCurrency, cn, formatDate } from '../lib/utils';
import { 
  DollarSign, Bell, Rocket, Home, Users, 
  Car, TrendingUp, AlertTriangle, CheckCircle2,
  ChevronRight, BarChart3, Target, AlertCircle,
  Sparkles, Plus, Trash2, Calendar, Edit3, PiggyBank,
  CreditCard, ArrowUpRight, Activity, ClipboardList, Info
} from 'lucide-react';
import { useConsolidatedData } from '../hooks/useConsolidatedData';
import { motion } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const Dashboard: React.FC = () => {
  const { installments, participants, campExpenses = [], loading, error } = useConsolidatedData();

  // Camp Date: Jan 29, 2028
  const CAMP_DATE = new Date('2028-01-29T00:00:00');
  const DEPARTURE_DATE = new Date('2028-01-28T19:00:00');
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const diffTime = CAMP_DATE.getTime() - today.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  // States for Radar de Contas a Pagar
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ dueDate: '', amount: 0, observation: '' });
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({
    installmentNumber: 0,
    dueDate: '',
    amount: 0,
    observation: ''
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Seeding logic for camp expenses matching the uploaded image exactly
  useEffect(() => {
    if (!loading && campExpenses.length === 0) {
      const DEFAULT_EXPENSES = [
        { installmentNumber: 1, dueDate: '2026-07-10', amount: 3500, isPaid: false },
        { installmentNumber: 2, dueDate: '2027-01-10', amount: 5000, isPaid: false },
        { installmentNumber: 3, dueDate: '2027-02-10', amount: 5000, isPaid: false },
        { installmentNumber: 4, dueDate: '2027-03-10', amount: 5000, isPaid: false },
        { installmentNumber: 5, dueDate: '2027-04-10', amount: 5000, isPaid: false },
        { installmentNumber: 6, dueDate: '2027-05-10', amount: 5000, isPaid: false },
        { installmentNumber: 7, dueDate: '2027-06-10', amount: 5000, isPaid: false },
        { installmentNumber: 8, dueDate: '2027-07-10', amount: 5000, isPaid: false },
        { installmentNumber: 9, dueDate: '2027-08-10', amount: 5000, isPaid: false },
        { installmentNumber: 10, dueDate: '2027-09-10', amount: 5000, isPaid: false },
        { installmentNumber: 11, dueDate: '2027-10-10', amount: 5000, isPaid: false },
        { installmentNumber: 12, dueDate: '2027-11-10', amount: 10000, isPaid: false },
        { installmentNumber: 13, dueDate: '2027-12-10', amount: 10000, isPaid: false },
        { installmentNumber: 14, dueDate: '2028-01-10', amount: 15000, isPaid: false },
      ];

      const colRef = collection(db, 'camp_expenses');
      DEFAULT_EXPENSES.forEach(async (exp) => {
        try {
          await addDoc(colRef, {
            ...exp,
            timestamp: Date.now() - (15 - exp.installmentNumber) * 1000 // preserve order
          });
        } catch (e) {
          console.error("Erro ao inicializar despesa:", e);
        }
      });
    }
  }, [campExpenses, loading]);

  const handleToggleExpense = async (id: string, currentStatus: boolean) => {
    try {
      const docRef = doc(db, 'camp_expenses', id);
      await updateDoc(docRef, {
        isPaid: !currentStatus,
        paymentDate: !currentStatus ? new Date().toISOString().split('T')[0] : null
      });
    } catch (e) {
      console.error("Erro ao atualizar status do vencimento:", e);
    }
  };

  const startEditExpense = (exp: any) => {
    setEditingExpenseId(exp.id);
    setEditForm({
      dueDate: exp.dueDate,
      amount: exp.amount,
      observation: exp.observation || ''
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      const docRef = doc(db, 'camp_expenses', id);
      await updateDoc(docRef, {
        dueDate: editForm.dueDate,
        amount: Number(editForm.amount),
        observation: editForm.observation
      });
      setEditingExpenseId(null);
    } catch (e) {
      console.error("Erro ao salvar alterações no vencimento:", e);
    }
  };

  const handleAddCustomExpense = async () => {
    if (!newExpense.dueDate || !newExpense.amount) return;
    try {
      const colRef = collection(db, 'camp_expenses');
      await addDoc(colRef, {
        installmentNumber: Number(newExpense.installmentNumber) || (campExpenses.length + 1),
        dueDate: newExpense.dueDate,
        amount: Number(newExpense.amount),
        isPaid: false,
        observation: newExpense.observation,
        timestamp: Date.now()
      });
      setShowAddExpense(false);
      setNewExpense({ installmentNumber: 0, dueDate: '', amount: 0, observation: '' });
    } catch (e) {
      console.error("Erro ao adicionar vencimento:", e);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'camp_expenses', id));
      setDeleteConfirmId(null);
    } catch (e) {
      console.error("Erro ao excluir vencimento:", e);
    }
  };

  const calculateAge = (birthDateStr: string) => {
    if (!birthDateStr) return 0;
    const birthDate = new Date(birthDateStr);
    let age = CAMP_DATE.getFullYear() - birthDate.getFullYear();
    const monthDiff = CAMP_DATE.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && CAMP_DATE.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getType = (age: number) => {
    if (age <= 5) return 'Isento';
    if (age <= 10) return 'Meia';
    return 'Inteira';
  };

  // Data Processing
  const analytics = useMemo(() => {
    const breakdown = {
      inteira: 0,
      meia: 0,
      isento: 0,
      onibus: 0,
      carro: 0,
      numCarros: 0
    };

    participants.forEach(p => {
      // Use stored paymentType if available, fallback to age calculation
      const type = p.paymentType || getType(calculateAge(p.birthDate));
      if (type === 'Inteira') breakdown.inteira++;
      else if (type === 'Meia') breakdown.meia++;
      else breakdown.isento++;

      if (p.transport === 'Ônibus') breakdown.onibus++;
      else if (p.transport === 'Carro') {
        breakdown.carro++;
        breakdown.numCarros++;
      }

      p.dependents?.forEach(d => {
        const dType = d.paymentType || getType(calculateAge(d.birthDate));
        if (dType === 'Inteira') breakdown.inteira++;
        else if (dType === 'Meia') breakdown.meia++;
        else breakdown.isento++;

        if (p.transport === 'Ônibus') breakdown.onibus++;
        else if (p.transport === 'Carro') breakdown.carro++;
      });
    });

    const totalCollected = installments.reduce((acc, curr) => acc + (curr.paidAmount || (curr.isPaid ? curr.amount : 0)), 0);
    const totalExpected = installments.reduce((acc, curr) => acc + curr.amount, 0);
    const collectionProgress = (totalCollected / (totalExpected || 1)) * 100;

    const monthlyData: { [key: string]: { month: string, collected: number, expected: number } } = {};
    installments.forEach(inst => {
      if (!monthlyData[inst.month]) {
        monthlyData[inst.month] = { month: inst.month, collected: 0, expected: 0 };
      }
      monthlyData[inst.month].expected += inst.amount;
      if (inst.isPaid) {
        monthlyData[inst.month].collected += inst.amount;
      } else {
        monthlyData[inst.month].collected += (inst.paidAmount || 0);
      }
    });

    const flowChartData = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

    const ageData = [
      { name: 'Inteira', value: breakdown.inteira, color: '#A855F7' },
      { name: 'Meia', value: breakdown.meia, color: '#38BDF8' },
      { name: 'Isento', value: breakdown.isento, color: '#10B981' }
    ];

    const todayStart = new Date(today);
    todayStart.setHours(0,0,0,0);

    const paidCount = participants.filter(p => p.isPaid || (p.totalValue === 0)).length;
    
    const overdueCount = participants.filter(p => {
      if (p.isPaid || p.totalValue === 0) return false;
      return installments.some(inst => 
        inst.participantId === p.id && 
        !inst.isPaid && 
        new Date(inst.dueDate + 'T12:00:00') < todayStart
      );
    }).length;

    return {
      breakdown,
      totalCollected,
      totalExpected,
      collectionProgress,
      flowChartData,
      ageData,
      overdueCount,
      paidCount,
      totalInscritos: participants.length + participants.reduce((acc, curr) => acc + (curr.dependents?.length || 0), 0)
    };
  }, [participants, installments, today]);

  const expensesAnalytics = useMemo(() => {
    const sortedExpenses = [...campExpenses].sort((a, b) => {
      if (a.installmentNumber !== b.installmentNumber) {
        return a.installmentNumber - b.installmentNumber;
      }
      return a.dueDate.localeCompare(b.dueDate);
    });

    const totalToPay = sortedExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const totalPaid = sortedExpenses.filter(e => e.isPaid).reduce((acc, curr) => acc + curr.amount, 0);
    const totalPending = totalToPay - totalPaid;
    const paidPercentage = totalToPay > 0 ? (totalPaid / totalToPay) * 100 : 0;

    const upcomingUnpaid = sortedExpenses
      .filter(e => !e.isPaid)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] || null;

    return {
      sortedExpenses,
      totalToPay,
      totalPaid,
      totalPending,
      paidPercentage,
      upcomingUnpaid
    };
  }, [campExpenses]);

  const BUS_CAPACITY = 46;
  const busesNeeded = Math.ceil(analytics.breakdown.onibus / BUS_CAPACITY);
  const busOccupancyRate = (analytics.breakdown.onibus / (busesNeeded * BUS_CAPACITY || 1)) * 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black p-4 text-center">
        <div className="w-16 h-16 bg-red-950 text-red-400 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Erro de Conexão</h2>
        <p className="text-slate-400 max-w-md mb-6">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-xl transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const pendingCollections = installments.filter(inst => {
    if (inst.isPaid) return false;
    const dueDate = new Date(inst.dueDate + 'T12:00:00');
    return dueDate <= nextWeek;
  }).map(inst => ({
    id: inst.id,
    name: inst.participantName,
    amount: inst.amount,
    dueDate: inst.dueDate,
    label: `Parcela ${inst.month}`,
    project: 'Acampamento'
  })).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <div className="space-y-4 sm:space-y-6 pb-24 md:pt-10 max-w-7xl mx-auto overflow-hidden px-1 sm:px-0">
      {/* Header */}
      <header className="px-4 sm:px-6 py-4 sm:py-8 flex flex-col md:flex-row justify-between items-center md:items-center gap-6">
        <div className="w-full text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <TrendingUp className="text-white" size={24} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-normal uppercase">Intelligence</h1>
          </div>
          <p className="text-[10px] sm:text-sm font-bold text-slate-400 ml-1 uppercase tracking-widest">Painel Analítico</p>
        </div>
        
        <div className="flex items-center justify-between w-full md:w-auto gap-4 bg-slate-900/50 p-4 rounded-3xl border border-slate-800 backdrop-blur-md">
          <div className="flex flex-col items-center md:items-start flex-1 md:flex-none px-4">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Acampa 28</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1.5">Faltam</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-black text-blue-500 tracking-tight leading-none">{daysRemaining}</span>
              <span className="text-[10px] font-bold text-slate-300 uppercase">Dias</span>
            </div>
          </div>
        </div>
      </header>

      {/* New Stats Bento Section */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 px-4 sm:px-6 mb-8">
        <div className="md:col-span-3 bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl flex flex-row md:flex-col items-center md:items-start justify-between min-h-[100px] md:min-h-0">
          <div className="flex flex-col md:items-start">
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] block leading-normal mb-1">Acampers</span>
            <p className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">{analytics.totalInscritos}</p>
          </div>
          <div className="flex flex-col items-end md:items-start md:mt-4">
            <Users size={20} className="text-indigo-400/50 mb-1" />
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">Base de Dados Total</p>
          </div>
        </div>

        <div className="md:col-span-6 bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl overflow-hidden">
           <div className="flex items-center justify-between mb-4">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Financeiro</span>
             <Target className="text-blue-400" size={14} />
           </div>
           <div className="grid grid-cols-3 gap-2 sm:gap-3">
             <div className="bg-black/30 p-3 sm:p-4 rounded-2xl border border-slate-800/50 text-center">
               <p className="text-xl sm:text-2xl font-black text-fuchsia-500">{analytics.breakdown.inteira}</p>
               <p className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase mt-1">Inteiras</p>
             </div>
             <div className="bg-black/30 p-3 sm:p-4 rounded-2xl border border-slate-800/50 text-center">
               <p className="text-xl sm:text-2xl font-black text-sky-500">{analytics.breakdown.meia}</p>
               <p className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase mt-1">Meias</p>
             </div>
             <div className="bg-black/30 p-3 sm:p-4 rounded-2xl border border-slate-800/50 text-center">
               <p className="text-xl sm:text-2xl font-black text-emerald-500">{analytics.breakdown.isento}</p>
               <p className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase mt-1">Isentos</p>
             </div>
           </div>
        </div>

        <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-1 gap-4 sm:gap-6">
          <div className="bg-emerald-950/20 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-emerald-900/30 flex items-center justify-between">
            <div className="overflow-hidden">
              <p className="text-[9px] sm:text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 truncate">Pagos</p>
              <p className="text-2xl sm:text-3xl font-black text-white leading-none">{analytics.paidCount}</p>
            </div>
            <CheckCircle2 size={18} className="text-emerald-500 shrink-0 ml-2" />
          </div>
          <div className="bg-rose-950/20 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-rose-900/30 flex items-center justify-between">
            <div className="overflow-hidden">
              <p className="text-[9px] sm:text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1 truncate">Atrasos</p>
              <p className="text-2xl sm:text-3xl font-black text-white leading-none">{analytics.overdueCount}</p>
            </div>
            <AlertCircle size={18} className="text-rose-500 shrink-0 ml-2" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 px-4 sm:px-6">
        
        {/* Collection Progress */}
        <div className="lg:col-span-2 bg-slate-900 rounded-3xl sm:rounded-[32px] p-5 sm:p-8 border border-slate-800 shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[250px] sm:min-h-[300px]">
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Target className="text-emerald-400" size={20} />
                  Financeiro
                </h3>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Progresso de Arrecadação</p>
              </div>
              <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-xl font-black text-xs border border-emerald-500/10">
                {analytics.collectionProgress.toFixed(1)}%
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 flex-1">
              <div className="relative w-28 h-28 sm:w-40 sm:h-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { value: analytics.totalCollected },
                        { value: Math.max(0, analytics.totalExpected - analytics.totalCollected) }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={55}
                      startAngle={90}
                      endAngle={450}
                      paddingAngle={0}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="#10B981" />
                      <Cell fill="#1E293B" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-black text-slate-500 uppercase">Meta</span>
                  <span className="text-base sm:text-lg font-black text-white">{formatCurrency(analytics.totalExpected)}</span>
                </div>
              </div>

              <div className="flex-1 space-y-3 w-full">
                <div className="bg-black/40 p-4 rounded-2xl border border-slate-800/50">
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Arrecadado</p>
                  <p className="text-xl sm:text-2xl font-black text-white leading-tight">{formatCurrency(analytics.totalCollected)}</p>
                </div>
                <div className="bg-black/40 p-4 rounded-2xl border border-slate-800/50">
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Restante</p>
                  <p className="text-xl sm:text-2xl font-black text-slate-300 leading-tight">{formatCurrency(analytics.totalExpected - analytics.totalCollected)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Flow Chart */}
        <div className="lg:col-span-2 bg-slate-900 rounded-3xl sm:rounded-[32px] p-5 sm:p-8 border border-slate-800 shadow-xl flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <BarChart3 className="text-indigo-400" size={20} />
                Fluxo de Caixa
              </h3>
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Expectativa Mensal</p>
            </div>
            <div className="flex gap-4">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-indigo-500"></div>
                 <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-tighter">Projetado</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-emerald-500"></div>
                 <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-tighter">Recebido</span>
               </div>
            </div>
          </div>

          <div className="flex-1 min-h-[250px] sm:min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.flowChartData} margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false}
                  minTickGap={10}
                  tick={{ fill: '#64748B', fontSize: 9, fontWeight: 700 }}
                  tickFormatter={(val) => {
                    const [y, m] = val.split('-');
                    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                    return months[parseInt(m) - 1];
                  }}
                />
                <YAxis 
                  tick={{ fill: '#64748B', fontSize: 9, fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                  tickFormatter={(val) => `R$${val/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid #1E293B', borderRadius: '16px', padding: '10px' }}
                  itemStyle={{ fontWeight: 800, fontSize: '11px' }}
                  labelStyle={{ color: '#94A3B8', fontSize: '9px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 900 }}
                />
                <Area type="monotone" dataKey="expected" stroke="#6366F1" strokeWidth={2} fillOpacity={1} fill="url(#colorExpected)" name="Projetado" />
                <Area type="monotone" dataKey="collected" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorCollected)" name="Recebido" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pending Collections Week */}
        <div className="lg:col-span-4 bg-slate-900 rounded-[32px] p-8 border border-slate-800 shadow-xl overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              <Bell className="text-amber-400" />
              Pendências da Semana
            </h3>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{pendingCollections.length} Previstos</span>
          </div>

          <div className="flex flex-col gap-4">
            {pendingCollections.length === 0 ? (
              <div className="bg-black/30 p-8 rounded-3xl border border-dashed border-slate-800 text-center">
                <CheckCircle2 className="mx-auto text-emerald-500 mb-2 opacity-20" size={32} />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Tudo em ordem para os próximos 7 dias</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {pendingCollections.slice(0, 4).map(pending => (
                  <div key={pending.id} className="bg-black/30 p-5 rounded-3xl border border-slate-800 hover:border-slate-700 transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-amber-500/10 group-hover:text-amber-500 transition-all">
                        <DollarSign size={20} />
                      </div>
                      <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/10">
                        Vence {formatDate(pending.dueDate)}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-white mb-1 truncate">{pending.name}</h4>
                    <p className="text-lg font-black text-amber-500">{formatCurrency(pending.amount)}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">{pending.label}</p>
                  </div>
                ))}
              </div>
            )}
            {pendingCollections.length > 4 && (
              <p className="text-center text-[10px] font-bold text-slate-600 uppercase tracking-widest">+ {pendingCollections.length - 4} outras pendências para esta semana</p>
            )}
          </div>
        </div>

        {/* Radar de Inteligência Financeira: Contas a Pagar */}
        <div className="lg:col-span-4 bg-slate-900 rounded-[32px] p-6 sm:p-8 border border-slate-800 shadow-xl overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Sparkles className="text-blue-400 animate-pulse" size={22} />
                Radar de Vencimentos (Contas a Pagar)
              </h3>
              <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Controle Financeiro da Organização</p>
            </div>
            <button
              onClick={() => setShowAddExpense(!showAddExpense)}
              className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border border-blue-500/20 flex items-center gap-2 transition-all"
            >
              <Plus size={14} />
              Adicionar Vencimento
            </button>
          </div>

          {/* Form to add custom expense */}
          {showAddExpense && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/40 p-5 rounded-2xl border border-slate-800 mb-6 space-y-4"
            >
              <h4 className="text-xs font-black text-white uppercase tracking-widest">Novo Vencimento</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Nº Parcela</label>
                  <input
                    type="number"
                    value={newExpense.installmentNumber || ''}
                    onChange={e => setNewExpense(prev => ({ ...prev, installmentNumber: Number(e.target.value) }))}
                    className="w-full bg-slate-800 border border-slate-700/50 rounded-lg p-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                    placeholder="Ex: 15"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Data de Vencimento</label>
                  <input
                    type="date"
                    value={newExpense.dueDate}
                    onChange={e => setNewExpense(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700/50 rounded-lg p-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    value={newExpense.amount || ''}
                    onChange={e => setNewExpense(prev => ({ ...prev, amount: Number(e.target.value) }))}
                    className="w-full bg-slate-800 border border-slate-700/50 rounded-lg p-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                    placeholder="Ex: 5000"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Observação</label>
                  <input
                    type="text"
                    value={newExpense.observation}
                    onChange={e => setNewExpense(prev => ({ ...prev, observation: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700/50 rounded-lg p-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                    placeholder="Ex: Aluguel do Sítio"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowAddExpense(false)}
                  className="bg-transparent hover:bg-slate-800 text-slate-400 px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddCustomExpense}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          )}

          {/* Intelligence Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
            <div className="md:col-span-8 bg-black/40 p-6 rounded-3xl border border-slate-800/50 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Activity size={12} className="text-blue-400 animate-pulse" />
                  Saúde Financeira do Projeto
                </span>
                <p className="text-[10px] text-slate-400 mt-1 uppercase">Relação Arrecadado vs Compromissos Pendentes</p>
              </div>

              {/* Dynamic Health Analysis message */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/30 text-xs text-slate-300 leading-relaxed font-bold">
                {expensesAnalytics.upcomingUnpaid ? (
                  (() => {
                    const nextExpense = expensesAnalytics.upcomingUnpaid;
                    const deficit = (expensesAnalytics.totalPaid + nextExpense.amount) - analytics.totalCollected;
                    
                    if (deficit <= 0) {
                      return (
                        <div className="flex gap-2">
                          <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={16} />
                          <div>
                            <p className="text-white uppercase font-black tracking-wider text-[10px] mb-1 text-emerald-400">Fluxo de Caixa Seguro</p>
                            O caixa arrecadado total até o momento (<span className="text-emerald-400 font-extrabold">{formatCurrency(analytics.totalCollected)}</span>) é suficiente para cobrir com segurança a próxima parcela de <span className="text-white font-extrabold">{formatCurrency(nextExpense.amount)}</span> com vencimento em <span className="text-white font-extrabold">{formatDate(nextExpense.dueDate)}</span>!
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex gap-2">
                          <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                          <div>
                            <p className="text-white uppercase font-black tracking-wider text-[10px] mb-1 text-amber-400">Atenção ao Fluxo de Caixa</p>
                            Você precisa arrecadar mais <span className="text-amber-400 font-extrabold">{formatCurrency(deficit)}</span> para cobrir a próxima parcela de <span className="text-white font-extrabold">{formatCurrency(nextExpense.amount)}</span> com vencimento em <span className="text-white font-extrabold">{formatDate(nextExpense.dueDate)}</span>. 
                            <span className="block mt-1.5 text-slate-400 font-normal">Temos atualmente <span className="text-white font-semibold">{formatCurrency(analytics.totalExpected - analytics.totalCollected)}</span> a receber de parcelas dos Acampers para cobrir esta e as demais despesas.</span>
                          </div>
                        </div>
                      );
                    }
                  })()
                ) : (
                  <div className="flex gap-2 text-emerald-400">
                    <CheckCircle2 size={16} />
                    <span>Todas as parcelas de custos do acampamento foram pagas! Parabéns!</span>
                  </div>
                )}
              </div>

              {/* Progress Bar of Payments */}
              <div>
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 mb-2">
                  <span>Progresso de Pagamento das Despesas</span>
                  <span className="text-white">{expensesAnalytics.paidPercentage.toFixed(0)}%</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/30">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${expensesAnalytics.paidPercentage}%` }}
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full"
                  />
                </div>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="md:col-span-4 grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 gap-4">
              <div className="bg-black/40 p-4 rounded-3xl border border-slate-800/50 flex flex-col justify-between min-h-[100px] sm:min-h-0 md:min-h-[100px]">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Custos</span>
                <div>
                  <p className="text-xl sm:text-lg md:text-2xl font-black text-white">{formatCurrency(expensesAnalytics.totalToPay)}</p>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">{expensesAnalytics.sortedExpenses.length} parcelas</span>
                </div>
              </div>
              <div className="bg-emerald-950/10 p-4 rounded-3xl border border-emerald-900/20 flex flex-col justify-between min-h-[100px] sm:min-h-0 md:min-h-[100px]">
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Total Pago</span>
                <div>
                  <p className="text-xl sm:text-lg md:text-2xl font-black text-emerald-400">{formatCurrency(expensesAnalytics.totalPaid)}</p>
                  <span className="text-[8px] font-bold text-emerald-500 uppercase">Honrado até agora</span>
                </div>
              </div>
              <div className="bg-amber-950/10 p-4 rounded-3xl border border-amber-900/20 flex flex-col justify-between min-h-[100px] sm:min-h-0 md:min-h-[100px]">
                <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Saldo Restante</span>
                <div>
                  <p className="text-xl sm:text-lg md:text-2xl font-black text-amber-400">{formatCurrency(expensesAnalytics.totalPending)}</p>
                  <span className="text-[8px] font-bold text-amber-500 uppercase">A vencer</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Ledger of installments */}
          {/* Desktop view (visible on md and up) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs font-bold text-slate-300 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="py-3 px-4">Parcela</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Valor (R$)</th>
                  <th className="py-3 px-4">Observação</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {expensesAnalytics.sortedExpenses.map(exp => (
                  <tr key={exp.id} className={cn(
                    "hover:bg-slate-800/20 transition-colors group",
                    exp.isPaid ? "opacity-75" : ""
                  )}>
                    <td className="py-3 px-4 font-black text-white">
                      {exp.installmentNumber}
                    </td>

                    {editingExpenseId === exp.id ? (
                      <>
                        <td className="py-3 px-4">
                          <input
                            type="date"
                            value={editForm.dueDate}
                            onChange={e => setEditForm(prev => ({ ...prev, dueDate: e.target.value }))}
                            className="bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1 text-xs font-bold text-white focus:outline-none w-32"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            value={editForm.amount}
                            onChange={e => setEditForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                            className="bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1 text-xs font-bold text-white focus:outline-none w-24"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={editForm.observation}
                            onChange={e => setEditForm(prev => ({ ...prev, observation: e.target.value }))}
                            className="bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1 text-xs font-bold text-white focus:outline-none w-full"
                            placeholder="Adicione observações..."
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-4 text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-slate-500" />
                            {formatDate(exp.dueDate)}
                          </div>
                        </td>
                        <td className={cn(
                          "py-3 px-4 text-sm font-extrabold",
                          exp.isPaid ? "text-slate-400 line-through" : "text-white"
                        )}>
                          {formatCurrency(exp.amount)}
                        </td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate font-medium">
                          {exp.observation || <span className="text-slate-600 italic">Nenhuma</span>}
                        </td>
                      </>
                    )}

                    {/* Status Toggle Box */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleExpense(exp.id, exp.isPaid)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 inline-flex items-center gap-1.5 border",
                          exp.isPaid 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" 
                            : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                        )}
                      >
                        <CheckCircle2 size={12} className={exp.isPaid ? "opacity-100" : "opacity-30"} />
                        {exp.isPaid ? 'Pago' : 'A pagar'}
                      </button>
                    </td>

                    {/* Edit / Delete Buttons */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2 items-center opacity-70 group-hover:opacity-100 transition-opacity">
                        {editingExpenseId === exp.id ? (
                          <>
                            <button
                              onClick={() => setEditingExpenseId(null)}
                              className="text-xs font-bold text-slate-400 hover:text-white px-2 py-1 rounded"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleSaveEdit(exp.id)}
                              className="text-xs font-black text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-500/10"
                            >
                              Salvar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditExpense(exp)}
                              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                              title="Editar vencimento"
                            >
                              <Edit3 size={14} />
                            </button>

                            {deleteConfirmId === exp.id ? (
                              <button
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="px-2 py-0.5 bg-red-600 text-white rounded text-[9px] font-black uppercase tracking-wider animate-pulse"
                              >
                                Excluir?
                              </button>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(exp.id)}
                                className="p-1 hover:bg-red-500/10 rounded text-slate-400 hover:text-red-400 transition-colors"
                                title="Excluir vencimento"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile view (visible below md) */}
          <div className="md:hidden space-y-4">
            {expensesAnalytics.sortedExpenses.map(exp => (
              <div
                key={exp.id}
                className={cn(
                  "bg-black/30 rounded-2xl p-4 border border-slate-800/80 space-y-3 relative transition-all",
                  exp.isPaid ? "opacity-75 border-slate-900" : "border-slate-800"
                )}
              >
                {/* Header info */}
                <div className="flex justify-between items-center border-b border-slate-800/60 pb-2">
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    Parcela {exp.installmentNumber}
                  </span>
                  
                  {/* Status Toggle Button */}
                  <button
                    onClick={() => handleToggleExpense(exp.id, exp.isPaid)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 inline-flex items-center gap-1.5 border",
                      exp.isPaid 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" 
                        : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                    )}
                  >
                    <CheckCircle2 size={10} className={exp.isPaid ? "opacity-100" : "opacity-30"} />
                    {exp.isPaid ? 'Pago' : 'A pagar'}
                  </button>
                </div>

                {/* Content section */}
                {editingExpenseId === exp.id ? (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[8px] font-black text-slate-500 uppercase mb-1">Vencimento</label>
                      <input
                        type="date"
                        value={editForm.dueDate}
                        onChange={e => setEditForm(prev => ({ ...prev, dueDate: e.target.value }))}
                        className="bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs font-bold text-white focus:outline-none w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-500 uppercase mb-1">Valor (R$)</label>
                      <input
                        type="number"
                        value={editForm.amount}
                        onChange={e => setEditForm(prev => ({ ...prev, amount: Number(e.target.value) }))}
                        className="bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs font-bold text-white focus:outline-none w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-black text-slate-500 uppercase mb-1">Observação</label>
                      <input
                        type="text"
                        value={editForm.observation}
                        onChange={e => setEditForm(prev => ({ ...prev, observation: e.target.value }))}
                        className="bg-slate-800 border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs font-bold text-white focus:outline-none w-full"
                        placeholder="Adicione observações..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="block text-[8px] font-black text-slate-500 uppercase">Vencimento</span>
                      <div className="flex items-center gap-1.5 mt-1 text-slate-300">
                        <Calendar size={12} className="text-slate-500" />
                        {formatDate(exp.dueDate)}
                      </div>
                    </div>
                    <div>
                      <span className="block text-[8px] font-black text-slate-500 uppercase">Valor</span>
                      <span className={cn(
                        "block mt-1 font-extrabold text-sm",
                        exp.isPaid ? "text-slate-400 line-through" : "text-white"
                      )}>
                        {formatCurrency(exp.amount)}
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-800/30">
                      <span className="block text-[8px] font-black text-slate-500 uppercase">Observação</span>
                      <p className="text-slate-400 font-medium mt-1">
                        {exp.observation || <span className="text-slate-600 italic">Nenhuma</span>}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions row */}
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/40">
                  {editingExpenseId === exp.id ? (
                    <>
                      <button
                        onClick={() => setEditingExpenseId(null)}
                        className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleSaveEdit(exp.id)}
                        className="text-xs font-black text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-all"
                      >
                        Salvar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEditExpense(exp)}
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-[11px]"
                      >
                        <Edit3 size={12} />
                        Editar
                      </button>

                      {deleteConfirmId === exp.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse"
                          >
                            Confirmar Exclusão
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 text-[10px] text-slate-400 hover:text-white font-bold"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(exp.id)}
                          className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1.5 text-[11px]"
                        >
                          <Trash2 size={12} />
                          Excluir
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logistics Operations */}
        <div className="lg:col-span-4 bg-slate-900 rounded-[40px] p-6 sm:p-8 border border-slate-800 shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-8 mb-8 md:mb-10">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                <Rocket className="text-indigo-400" size={28} />
                Gestão Logística
              </h3>
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Monitoramento de Capacidade</p>
            </div>
            
            <div className="flex gap-4 w-full md:w-auto">
              <div className="flex-1 md:flex-none bg-slate-800/40 px-6 py-4 rounded-3xl border border-slate-700/50 flex flex-col items-center">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Veículos</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{analytics.breakdown.numCarros}</span>
                  <span className="text-[10px] font-bold text-slate-500">Un</span>
                </div>
              </div>
              <div className="flex-1 md:flex-none bg-slate-800/40 px-6 py-4 rounded-3xl border border-slate-700/50 flex flex-col items-center">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Passageiros</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white">{analytics.breakdown.onibus + analytics.breakdown.carro}</span>
                  <span className="text-[10px] font-bold text-slate-500">Total</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8 bg-black/40 rounded-3xl p-8 border border-slate-800/50">
              <div className="flex justify-between items-center mb-8">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Frota de Ônibus</span>
                <span className="text-xs font-black text-white bg-indigo-500/20 px-4 py-1.5 rounded-full">{busOccupancyRate.toFixed(1)}% Taxa de Uso</span>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-10 items-center">
                 <div className="flex-1 w-full space-y-6">
                    <div className="h-6 w-full bg-slate-800/50 rounded-full overflow-hidden p-1.5 border border-slate-700/30 shadow-inner">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(busOccupancyRate, 100)}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-400 rounded-full"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                       <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Escalados</p>
                          <p className="text-3xl font-black text-white">{busesNeeded} <span className="text-xs font-bold text-slate-600">Bus</span></p>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Vagas Livres</p>
                          <p className="text-3xl font-black text-indigo-400">{Math.max(0, (busesNeeded * BUS_CAPACITY) - analytics.breakdown.onibus)} <span className="text-xs font-bold text-slate-600">Sits</span></p>
                       </div>
                    </div>
                 </div>

                 <div className="shrink-0 w-32 h-32 flex items-center justify-center relative">
                    <div className="absolute inset-0 rounded-full border-8 border-slate-800/50"></div>
                    <div className="text-center">
                       <p className="text-2xl font-black text-white leading-none">{analytics.breakdown.onibus}</p>
                       <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Assentos</p>
                    </div>
                 </div>
              </div>
            </div>

            <div className="lg:col-span-4 bg-emerald-950/10 rounded-3xl p-8 border border-emerald-900/20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-[32px] bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-6 border border-emerald-500/10 shadow-lg shadow-emerald-900/10">
                <Car size={40} />
              </div>
              <p className="text-5xl font-black text-white mb-2">{analytics.breakdown.numCarros}</p>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Carros Próprios</p>
              <p className="text-xs font-bold text-slate-400 mt-4 uppercase">Total de <span className="text-emerald-400">{analytics.breakdown.carro} passageiros</span> via terrestre privada.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

