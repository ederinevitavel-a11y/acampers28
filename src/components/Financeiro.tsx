import React from 'react';
import { 
  DollarSign, ArrowUpCircle, ArrowDownCircle, Wallet, 
  PieChart as PieIcon, Download, Filter, CheckCircle2, XCircle 
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useConsolidatedData } from '../hooks/useConsolidatedData';

const Financeiro: React.FC = () => {
  const { sabor, brasa, brilho, brilhoClients, brilhoExpenses, conecta, bencao, participants, loading, error } = useConsolidatedData();

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
          <PieIcon size={32} />
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

  const campFees = participants.map(p => {
    return { ...p, price: p.totalValue || 0 };
  });

  const consolidated = [
    { 
      name: 'Sabor Central', 
      revenue: sabor.reduce((acc, curr) => acc + curr.totalRevenue, 0), 
      received: sabor.filter(e => e.isPaid).reduce((acc, curr) => acc + curr.totalRevenue, 0),
      expense: sabor.reduce((acc, curr) => acc + curr.totalCost, 0),
      color: '#3b82f6' 
    },
    { 
      name: 'Brilho Celeste', 
      revenue: brilho.filter(w => !w.clientId).reduce((acc, curr) => acc + curr.packagePrice, 0) + 
               brilhoClients.reduce((acc, curr) => acc + curr.packagePrice, 0), 
      received: brilho.filter(w => !w.clientId && w.isPaid).reduce((acc, curr) => acc + curr.packagePrice, 0) + 
                brilhoClients.filter(c => c.isPaid).reduce((acc, curr) => acc + curr.packagePrice, 0),
      expense: brilhoExpenses.reduce((acc, curr) => acc + curr.amount, 0), 
      color: '#10b981' 
    },
    { 
      name: 'Conecta Central', 
      revenue: conecta.reduce((acc, curr) => acc + curr.totalRevenue, 0), 
      received: conecta.filter(e => e.isPaid).reduce((acc, curr) => acc + curr.totalRevenue, 0),
      expense: conecta.reduce((acc, curr) => acc + curr.totalExpense, 0),
      color: '#6366f1' 
    },
    { 
      name: 'Brasa & Graça', 
      revenue: brasa.reduce((acc, curr) => acc + curr.totalRevenue, 0), 
      received: brasa.filter(e => e.isPaid).reduce((acc, curr) => acc + curr.totalRevenue, 0),
      expense: brasa.reduce((acc, curr) => acc + curr.totalCost, 0),
      color: '#f59e0b' 
    },
    { 
      name: 'Receba sua Benção', 
      revenue: bencao.reduce((acc, curr) => acc + curr.totalRevenue, 0), 
      received: bencao.filter(e => e.isPaid).reduce((acc, curr) => acc + curr.totalRevenue, 0),
      expense: 0, 
      color: '#a855f7' 
    },
    { 
      name: 'Inscrições Acampers', 
      revenue: campFees.reduce((acc, curr) => acc + curr.price, 0), 
      received: campFees.filter(e => e.isPaid).reduce((acc, curr) => acc + curr.price, 0),
      expense: 0, 
      color: '#4f46e5' 
    },
  ].map(item => ({
    ...item,
    pending: item.revenue - item.received,
    profit: item.revenue - item.expense
  }));

  const totalRevenue = consolidated.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalReceived = consolidated.reduce((acc, curr) => acc + curr.received, 0);
  const totalPending = consolidated.reduce((acc, curr) => acc + curr.pending, 0);
  const totalExpense = consolidated.reduce((acc, curr) => acc + curr.expense, 0);
  const totalProfit = totalRevenue - totalExpense;
  const currentAvailableBalance = totalReceived - totalExpense;

  const pieData = consolidated.filter(i => i.profit > 0).map(item => ({
    name: item.name,
    value: item.profit
  }));

  const eventsConsolidated = consolidated.filter(i => i.name !== 'Inscrições Acampers');
  const registrationsConsolidated = consolidated.find(i => i.name === 'Inscrições Acampers');

  return (
    <div className="space-y-6 pb-20 md:pt-20 px-4">
      <header className="py-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <DollarSign className="text-amber-400" />
            Controle Financeiro
          </h1>
          <p className="text-slate-400 font-medium">Consolidado</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-slate-900 text-slate-400 p-2 rounded-xl border border-slate-800 hover:bg-slate-800 transition-all">
            <Filter size={20} />
          </button>
          <button className="bg-slate-900 text-slate-400 p-2 rounded-xl border border-slate-800 hover:bg-slate-800 transition-all">
            <Download size={20} />
          </button>
        </div>
      </header>

      {/* Main Balance Card */}
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <Wallet size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 font-medium leading-none">Saldo em Caixa (Recebido)</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Já subtraídas as despesas</p>
            </div>
          </div>
          
          <h2 className="text-4xl font-black">{formatCurrency(currentAvailableBalance)}</h2>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="text-green-500" size={16} />
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Previsto</p>
                <p className="text-xs sm:text-sm font-black text-slate-200">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-blue-500" size={16} />
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Recebido</p>
                <p className="text-xs sm:text-sm font-black text-blue-400">{formatCurrency(totalReceived)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="text-amber-500" size={16} />
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Pendente</p>
                <p className="text-xs sm:text-sm font-black text-amber-500">{formatCurrency(totalPending)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="text-red-500" size={16} />
              <div>
                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Despesas</p>
                <p className="text-xs sm:text-sm font-black text-red-500">{formatCurrency(totalExpense)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Registrations Spotlight Section */}
      {registrationsConsolidated && (
        <div className="bg-indigo-900/10 border border-indigo-500/20 rounded-3xl p-5 shadow-inner">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-indigo-400" />
              <h3 className="text-base font-bold text-indigo-300">Inscrições Acampers</h3>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-white">{formatCurrency(registrationsConsolidated.received)}</p>
              <p className="text-[10px] text-indigo-400 font-bold uppercase whitespace-nowrap">Total já em caixa</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/50 p-3 rounded-xl border border-indigo-500/10">
              <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Previsão Total (Meta)</p>
              <p className="text-sm font-bold text-slate-200">{formatCurrency(registrationsConsolidated.revenue)}</p>
            </div>
            <div className="bg-slate-900/50 p-3 rounded-xl border border-indigo-500/10">
              <p className="text-[9px] text-slate-500 font-bold uppercase mb-1">Restante a Receber</p>
              <p className="text-sm font-bold text-amber-500">{formatCurrency(registrationsConsolidated.pending)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Contribution Chart */}
      <div className="bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-800">
        <h3 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2">
          <PieIcon size={20} className="text-blue-500" />
          Composição do Lucro
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {consolidated.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', color: '#f1f5f9' }}
                itemStyle={{ color: '#f1f5f9' }}
                formatter={(value: number) => formatCurrency(value)} 
              />
              <Legend verticalAlign="bottom" align="center" iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdown List */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-100 flex justify-between items-center px-1">
          Resultados por Evento
          <span className="text-xs text-slate-500 font-normal uppercase tracking-wider">Maio/2026</span>
        </h3>
        
        <div className="space-y-3">
          {eventsConsolidated.sort((a, b) => b.profit - a.profit).map((item) => (
            <div key={item.name} className="bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-800">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]" style={{ backgroundColor: item.color }}></div>
                  <h4 className="font-bold text-slate-100">{item.name}</h4>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-slate-100 leading-none">{formatCurrency(item.profit)}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Lucro Gerado</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-[10px] font-bold uppercase mb-3 text-center">
                <div className="bg-green-950/20 p-2 rounded-lg text-green-400 ring-1 ring-green-900/30">
                  <p className="text-slate-500 text-[8px]">Recebido</p>
                  {formatCurrency(item.received)}
                </div>
                <div className="bg-amber-950/20 p-2 rounded-lg text-amber-500 ring-1 ring-amber-900/30">
                  <p className="text-slate-500 text-[8px]">A Receber</p>
                  {formatCurrency(item.pending)}
                </div>
                <div className="bg-red-950/20 p-2 rounded-lg text-red-500 ring-1 ring-red-900/30">
                  <p className="text-slate-500 text-[8px]">Despesas</p>
                  {formatCurrency(item.expense)}
                </div>
              </div>
              
              <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-1000" 
                  style={{ 
                    backgroundColor: item.color, 
                    width: `${(item.profit / totalProfit) * 100}%` 
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

  );
};

export default Financeiro;
