import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, AreaChart, Area, PieChart, Pie, Cell, ComposedChart, Line, ReferenceLine
} from 'recharts';
import { formatCurrency, cn, formatDate } from '../lib/utils';
import { TrendingUp, DollarSign, Calendar as CalendarIcon, Bell, Target, Rocket, Clock, Filter, CreditCard, Flame, Droplets, Ticket, Home } from 'lucide-react';
import { useConsolidatedData } from '../hooks/useConsolidatedData';
import { motion } from 'motion/react';

const Dashboard: React.FC = () => {
  const { sabor, brasa, brilho, brilhoClients, brilhoExpenses, conecta, bencao, installments, loading } = useConsolidatedData();
  const [selectedProject, setSelectedProject] = useState<string>('Todos');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Calculate project totals
  const totalInstallments = installments.reduce((acc, curr) => acc + (curr.paidAmount || (curr.isPaid ? curr.amount : 0)), 0);
  
  // Refined Brilho Celeste calculation
  const totalBrilhoRevenue = brilho.filter(w => !w.clientId).reduce((acc, curr) => acc + curr.packagePrice, 0) + 
                             brilhoClients.reduce((acc, curr) => acc + curr.packagePrice, 0);
  const totalBrilhoReceived = brilho.filter(w => !w.clientId && w.isPaid).reduce((acc, curr) => acc + curr.packagePrice, 0) + 
                              brilhoClients.filter(c => c.isPaid).reduce((acc, curr) => acc + curr.packagePrice, 0);
  const totalBrilhoExpense = brilhoExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  const globalProjectTotals = [
    { name: 'Sabor', value: sabor.reduce((acc, curr) => acc + curr.totalRevenue, 0), expense: sabor.reduce((acc, curr) => acc + curr.totalCost, 0), color: '#3b82f6', count: sabor.length },
    { name: 'Brilho', value: totalBrilhoRevenue, expense: totalBrilhoExpense, color: '#10b981', count: brilho.length + brilhoClients.length },
    { name: 'Conecta', value: conecta.reduce((acc, curr) => acc + curr.totalRevenue, 0), expense: conecta.reduce((acc, curr) => acc + curr.totalExpense, 0), color: '#8b5cf6', count: conecta.length },
    { name: 'Brasa', value: brasa.reduce((acc, curr) => acc + curr.totalRevenue, 0), expense: brasa.reduce((acc, curr) => acc + curr.totalCost, 0), color: '#f59e0b', count: brasa.length },
    { name: 'Bênção', value: bencao.reduce((acc, curr) => acc + curr.totalRevenue, 0), expense: 0, color: '#f43f5e', count: bencao.length },
    { name: 'Acampamento', value: totalInstallments, expense: 0, color: '#6366f1', count: installments.length },
  ];

  const projectTotals = selectedProject === 'Todos' 
    ? globalProjectTotals 
    : globalProjectTotals.filter(p => p.name === selectedProject);

  // Goals
  const META_ROOF = 50000;
  const META_MOON = 75000;

  // Calculate monthly data for the chart
  const monthlyData: Record<string, { Sabor: number, Brilho: number, Conecta: number, Brasa: number, Bencao: number, Acampamento: number, total: number }> = {};

  const processMonthlyItem = (dateStr: string | undefined, type: string, value: number) => {
    if (!dateStr) return;
    const month = dateStr.substring(0, 7); // YYYY-MM
    if (!monthlyData[month]) {
      monthlyData[month] = { Sabor: 0, Brilho: 0, Conecta: 0, Brasa: 0, Bencao: 0, Acampamento: 0, total: 0 };
    }
    // @ts-ignore
    monthlyData[month][type] += value;
    monthlyData[month].total += value;
  };

  sabor.forEach(item => processMonthlyItem(item.date, 'Sabor', item.totalRevenue));
  conecta.forEach(item => processMonthlyItem(item.date, 'Conecta', item.totalRevenue));
  brasa.forEach(item => processMonthlyItem(item.date, 'Brasa', item.totalRevenue));
  bencao.forEach(item => processMonthlyItem(item.date, 'Bencao', item.totalRevenue));
  brilho.forEach(item => processMonthlyItem(item.date, 'Brilho', item.packagePrice));
  installments.forEach(item => {
    const amount = item.paidAmount || (item.isPaid ? item.amount : 0);
    processMonthlyItem(item.dueDate || item.month, 'Acampamento', amount); 
  });

  const sortedMonths = Object.keys(monthlyData).sort();
  const startMonth = sortedMonths[0] || '2026-05';
  
  const parseYearMonth = (ym: string) => {
    const [y, m] = ym.split('-');
    return parseInt(y) * 12 + parseInt(m) - 1;
  };
  
  const startM = parseYearMonth(startMonth);
  // Assumir finalização da campanha no final de 2027
  const endM = parseYearMonth('2027-12'); 
  const totalMonthsForGoal = Math.max(endM - startM + 1, 1);
  const goalPerMonth = META_ROOF / totalMonthsForGoal;

  let cumulative = 0;
  
  const chartData = sortedMonths.map((month) => {
    cumulative += monthlyData[month].total;
    const currentM = parseYearMonth(month);
    const expectedCumulative = (currentM - startM + 1) * goalPerMonth;

    const split = month.split('-');
    const date = new Date(parseInt(split[0]), parseInt(split[1]) - 1, 1);
    const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

    return {
      monthFull: month,
      month: monthName,
      ...monthlyData[month],
      Acumulado: cumulative,
      MetaEsperada: parseFloat(expectedCumulative.toFixed(2))
    };
  });

  const globalTotalRevenue = globalProjectTotals.reduce((acc, curr) => acc + curr.value, 0);
  const totalRevenue = projectTotals.reduce((acc, curr) => acc + curr.value, 0);
  const totalExpense = projectTotals.reduce((acc, curr) => acc + curr.expense, 0);
  const totalCount = projectTotals.reduce((acc, curr) => acc + curr.count, 0);
  const totalBalance = totalRevenue - totalExpense;

  const roofProgress = Math.min((globalTotalRevenue / META_ROOF) * 100, 100);
  const moonProgress = Math.min((globalTotalRevenue / META_MOON) * 100, 100);
  const leftForRoof = Math.max(META_ROOF - globalTotalRevenue, 0);
  const leftForMoon = Math.max(META_MOON - globalTotalRevenue, 0);

  // Collection reminders (due in next 7 days or overdue)
  const today = new Date('2026-05-24'); // Fixed for this context
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);

  const pendingCollections = [
    ...installments.filter(inst => {
      if (inst.isPaid) return false;
      const dueDate = new Date(inst.dueDate);
      return dueDate <= nextWeek;
    }).map(inst => ({
      id: inst.id,
      name: inst.participantName,
      amount: inst.amount,
      dueDate: inst.dueDate,
      label: `Parcela ${inst.month}`,
      project: 'Acampamento'
    })),
    ...brilhoClients.filter(client => !client.isPaid).map(client => ({
      id: client.id,
      name: client.name,
      amount: client.packagePrice,
      dueDate: new Date(client.timestamp).toISOString().split('T')[0], // Use timestamp as reference if no date
      label: `Pacote: ${client.packageName}`,
      project: 'Brilho'
    }))
  ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const filteredPendingCollections = selectedProject === 'Todos' 
    ? pendingCollections 
    : pendingCollections.filter(p => (selectedProject === 'Acampamento' && p.project === 'Acampamento') || (selectedProject === 'Brilho' && p.project === 'Brilho'));

  const summary = [
    { label: 'Total Arrecadado', value: totalRevenue, icon: DollarSign, color: 'bg-green-100 text-green-600' },
    { label: 'Despesas Totais', value: totalExpense, icon: TrendingUp, color: 'bg-red-100 text-red-600' },
    { label: 'Saldo Atual', value: totalBalance, icon: DollarSign, color: 'bg-blue-100 text-blue-600' },
    { label: 'Ações Realizadas', value: totalCount, icon: CalendarIcon, color: 'bg-purple-100 text-purple-600' },
  ];

  return (
    <div className="space-y-6 pb-20 md:pt-20">
      <header className="px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Home className="text-blue-500" />
          Home
        </h1>
        <p className="text-sm font-medium text-slate-400">Visão Geral e Metas</p>
      </header>

      {/* Filtering */}
      <div className="px-4 pb-2">
        <div className="relative max-w-xs">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full appearance-none bg-slate-900 border border-slate-800 text-slate-200 text-sm font-bold rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
          >
            {['Todos', 'Acampamento', 'Sabor', 'Brilho', 'Conecta', 'Brasa', 'Bênção'].map(cat => (
              <option key={cat} value={cat}>
                {cat === 'Todos' ? '📊 Visão Geral' : `📌 Projeto: ${cat}`}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-500">
            <Filter size={14} />
          </div>
        </div>
      </div>

      {/* Collection Reminders */}
      {filteredPendingCollections.length > 0 && (
        <div className="px-4">
          <div className="bg-amber-950/20 border border-amber-900/30 rounded-3xl p-5 shadow-inner">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                <Bell size={20} className="animate-bounce" />
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-500 uppercase tracking-widest">Cobranças Ativas</h3>
                <p className="text-[10px] text-slate-500 font-bold">Vencimentos Próximos ou Atrasados</p>
              </div>
            </div>
            
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {filteredPendingCollections.map((inst) => {
                const isOverdue = new Date(inst.dueDate) < today;
                return (
                  <motion.div 
                    layout
                    key={inst.id}
                    className={cn(
                      "flex justify-between items-center p-3 rounded-xl border bg-slate-900/50",
                      isOverdue ? "border-red-900/30" : "border-amber-900/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-8 rounded-full",
                        isOverdue ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-blue-500"
                      )}></div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-bold text-slate-100 leading-none">{inst.name}</p>
                          <span className={cn(
                            "text-[8px] px-1 rounded-sm font-bold uppercase",
                            inst.project === 'Brilho' ? "bg-cyan-500/20 text-cyan-400" : "bg-indigo-500/20 text-indigo-400"
                          )}>
                            {inst.project}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock size={10} className="text-slate-500" />
                          <p className={cn(
                            "text-[10px] font-bold uppercase",
                            isOverdue ? "text-red-400" : "text-blue-500"
                          )}>
                            {inst.project === 'Brilho' ? 'Cadastrado em ' : 'Vence '} {formatDate(inst.dueDate)} {isOverdue && inst.project !== 'Brilho' && '(Atrasado)'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-200">{formatCurrency(inst.amount)}</p>
                      <p className="text-[8px] text-slate-500 font-bold uppercase">{inst.label}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4">
        {summary.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-800 flex flex-col justify-between min-h-[90px]">
              <div>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", item.color)}>
                  <Icon size={16} />
                </div>
                <p className="text-[9px] text-slate-500 uppercase tracking-widest font-black leading-tight mb-1">{item.label}</p>
              </div>
              <p className="text-sm sm:text-lg font-black text-slate-100 truncate">
                {typeof item.value === 'number' && (item.label.includes('Total') || item.label.includes('Saldo') || item.label.includes('Despesas'))
                  ? formatCurrency(item.value) 
                  : item.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Goals Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4">
        {/* Meta Roof */}
        <div className="bg-gradient-to-br from-indigo-950 to-slate-900 border border-indigo-900/40 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10">
            <Target size={120} />
          </div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
              <Target size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-100 font-sans tracking-tight">Meta Roof</h3>
              <p className="text-sm font-semibold text-indigo-400">Objetivo Inicial</p>
            </div>
          </div>
          
          <div className="space-y-4 relative z-10">
            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-2 gap-1 sm:gap-0">
                <span className="text-3xl sm:text-4xl font-black text-white tracking-tighter shadow-sm leading-none">{formatCurrency(globalTotalRevenue)}</span>
                <span className="text-xs sm:text-sm font-medium text-slate-400">de {formatCurrency(META_ROOF)}</span>
              </div>
              
              <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 p-0.5 mt-2">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${roofProgress}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)] relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>
                </motion.div>
              </div>
              
              <div className="flex justify-between items-center mt-3">
                <span className="text-[10px] sm:text-sm font-bold text-indigo-300">{roofProgress.toFixed(1)}% Alcançado</span>
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 text-right">Falta {formatCurrency(leftForRoof)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Meta Moon */}
        <div className="bg-gradient-to-br from-fuchsia-950 to-slate-900 border border-fuchsia-900/40 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10">
            <Rocket size={120} />
          </div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 border border-fuchsia-500/20">
              <Rocket size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-100 font-sans tracking-tight">Meta Moon</h3>
              <p className="text-sm font-semibold text-fuchsia-400">Superação de Expectativas</p>
            </div>
          </div>
          
          <div className="space-y-4 relative z-10">
            <div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-2 gap-1 sm:gap-0">
                <span className="text-3xl sm:text-4xl font-black text-white tracking-tighter shadow-sm leading-none">{formatCurrency(globalTotalRevenue)}</span>
                <span className="text-xs sm:text-sm font-medium text-slate-400">de {formatCurrency(META_MOON)}</span>
              </div>
              
              <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 p-0.5 mt-2">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${moonProgress}%` }}
                  transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                  className="h-full bg-gradient-to-r from-fuchsia-500 to-fuchsia-400 rounded-full shadow-[0_0_15px_rgba(217,70,239,0.5)] relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>
                </motion.div>
              </div>
              
              <div className="flex justify-between items-center mt-3">
                <span className="text-[10px] sm:text-sm font-bold text-fuchsia-300">{moonProgress.toFixed(1)}% Alcançado</span>
                <span className="text-[10px] sm:text-xs font-semibold text-slate-400 text-right">Falta {formatCurrency(leftForMoon)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Project Revenue Breakdown Pie Chart */}
      {selectedProject === 'Todos' && (
        <div className="px-4">
          <div className="bg-slate-900 p-4 md:p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="w-full text-center md:text-left">
              <h2 className="text-base md:text-lg font-bold text-slate-100 mb-1 md:mb-2 font-sans">Distribuição da Arrecadação</h2>
              <p className="text-[10px] md:text-xs text-slate-400">Contribuição de cada projeto para o objetivo geral.</p>
            </div>
            
            <div className="h-[200px] md:h-[250px] w-full max-w-[250px] md:max-w-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={globalProjectTotals.filter(p => p.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {globalProjectTotals.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b' }}
                    itemStyle={{ color: '#f1f5f9' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="w-full md:w-auto grid grid-cols-2 md:grid-cols-1 gap-3 md:gap-2 mt-2 md:mt-0 px-2 md:px-0">
              {globalProjectTotals.filter(p => p.value > 0).map((proj, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: proj.color }}></div>
                  <span className="text-[11px] md:text-xs font-semibold text-slate-300 min-w-[70px] md:min-w-[80px]">{proj.name}</span>
                  <span className="text-[10px] md:text-xs text-slate-500 font-mono">
                    {((proj.value / globalTotalRevenue) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Chart: Revenue vs Expense */}
      <div className="px-4">
        <div className="bg-slate-900 p-4 md:p-6 rounded-2xl shadow-sm border border-slate-800 overflow-hidden">
          <h2 className="text-base md:text-lg font-bold text-slate-100 mb-4 md:mb-6 font-sans">Receitas vs Despesas</h2>
          <div className="h-56 md:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectTotals} margin={{ left: -30, right: 0, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  interval={0}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)' }}
                  itemStyle={{ color: '#f1f5f9' }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', fontSize: '10px' }} />
                <Bar name="Receitas" dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar name="Despesas" dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Revenue Over Time & Goal Track */}
      <div className="px-4">
        <div className="bg-slate-900 p-4 md:p-6 rounded-2xl shadow-sm border border-slate-800 overflow-hidden">
          <h2 className="text-base md:text-lg font-bold text-slate-100 mb-2">Acompanhamento da Meta</h2>
          <p className="text-xs text-slate-400 mb-4 md:mb-6">Progresso acumulado vs. Meta esperada para atingir o objetivo.</p>
          <div className="h-64 md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ left: -30, right: 0, top: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10 }} 
                />
                <YAxis 
                  yAxisId="left"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 9 }}
                  tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 9 }}
                  tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #1e293b', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)' }}
                  itemStyle={{ color: '#f1f5f9' }}
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '15px', fontSize: '10px' }} />
                
                {/* Collected that specific month */}
                <Bar yAxisId="right" name="Arrecadado no Mês" dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} opacity={0.6} />
                
                {/* Meta planejado */}
                <Line yAxisId="left" name="Meta Esperada Acum." type="monotone" dataKey="MetaEsperada" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                
                {/* O que realmente arrecadou acumulado */}
                <Area yAxisId="left" name="Arrecadado Acumulado" type="monotone" dataKey="Acumulado" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorAcumulado)" />
                
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
