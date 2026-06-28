import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar as CalendarIcon, Clock, User, Droplets, CreditCard, Search, Users, CheckCircle2, XCircle, DollarSign } from 'lucide-react';
import { BrilhoCelesteWash, BrilhoCelesteClient, BrilhoCelesteExpense } from '../types';
import { formatCurrency, cn, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc, increment, writeBatch } from 'firebase/firestore';
import { ConfirmModal } from './ConfirmModal';

const PACKAGES = [
  { name: '1 Lavagem' as const, price: 30, count: 1 },
  { name: '2 Lavagens' as const, price: 50, count: 2 },
  { name: '4 Lavagens' as const, price: 100, count: 4 },
];

const TIME_SLOTS = [];
for (let hour = 9; hour <= 15; hour++) {
  for (let min = 0; min < 60; min += 15) {
    if (hour === 15 && min > 0) break;
    const h = hour.toString().padStart(2, '0');
    const m = min.toString().padStart(2, '0');
    TIME_SLOTS.push(`${h}:${m}`);
  }
}

const BrilhoCeleste: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'agenda' | 'clientes' | 'financas'>('agenda');
  const [washes, setWashes] = useState<BrilhoCelesteWash[]>([]);
  const [clients, setClients] = useState<BrilhoCelesteClient[]>([]);
  const [expenses, setExpenses] = useState<BrilhoCelesteExpense[]>([]);
  const [showWashForm, setShowWashForm] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [deleteWashModal, setDeleteWashModal] = useState<BrilhoCelesteWash | null>(null);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [washError, setWashError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [washFormData, setWashFormData] = useState({
    timeSlot: '09:00',
    clientId: '',
    clientName: '',
  });

  const [clientFormData, setClientFormData] = useState({
    name: '',
    phone: '',
    carInfo: '',
    packageName: '1 Lavagem' as const,
    isPaid: false,
    paymentDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const qWashes = query(collection(db, 'brilho_celeste'), orderBy('timestamp', 'asc'));
    const unsubWashes = onSnapshot(qWashes, (snapshot) => {
      setWashes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BrilhoCelesteWash[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'brilho_celeste'));

    const qClients = query(collection(db, 'brilho_celeste_clients'), orderBy('name', 'asc'));
    const unsubClients = onSnapshot(qClients, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BrilhoCelesteClient[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'brilho_celeste_clients'));

    const qExpenses = query(collection(db, 'brilho_celeste_expenses'), orderBy('timestamp', 'desc'));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BrilhoCelesteExpense[]);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'brilho_celeste_expenses'));

    return () => {
      unsubWashes();
      unsubClients();
      unsubExpenses();
    };
  }, []);

  // Expense form data
  const [expenseFormData, setExpenseFormData] = useState({
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
  });

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'brilho_celeste_expenses'), {
        ...expenseFormData,
        timestamp: Date.now(),
      });
      setShowExpenseForm(false);
      setExpenseFormData({ description: '', amount: 0, date: new Date().toISOString().split('T')[0] });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'brilho_celeste_expenses');
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'brilho_celeste_expenses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `brilho_celeste_expenses/${id}`);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const pkg = PACKAGES.find(p => p.name === clientFormData.packageName);
    const newClient = {
      ...clientFormData,
      totalWashesBought: pkg?.count || 1,
      washesRemaining: pkg?.count || 1,
      packagePrice: pkg?.price || 0,
      timestamp: Date.now(),
    };

    try {
      await addDoc(collection(db, 'brilho_celeste_clients'), newClient);
      setShowClientForm(false);
      setClientFormData({ 
        name: '', 
        phone: '', 
        carInfo: '', 
        packageName: '1 Lavagem', 
        isPaid: false,
        paymentDate: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'brilho_celeste_clients');
    }
  };

  const handleAddWash = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let clientName = washFormData.clientName;
    let packageName: any = '1 Lavagem';
    let packagePrice = 30; // Avulso: R$ 30

    const selectedClient = clients.find(c => c.id === washFormData.clientId);
    if (selectedClient) {
      if (selectedClient.washesRemaining <= 0) {
        setWashError("Cliente não possui lavagens restantes!");
        return;
      }
      clientName = selectedClient.name;
      packageName = selectedClient.packageName;
      packagePrice = 25; // Package use: R$ 25 (attributed value)
    }

    const newWash = {
      date: selectedDate,
      clientId: washFormData.clientId || null,
      clientName,
      timeSlot: washFormData.timeSlot,
      packageName,
      packagePrice: packagePrice,
      isPaid: selectedClient ? true : false, // Package use is effectively "prepaid"
      timestamp: Date.now(),
    };

    try {
      const batch = writeBatch(db);
      const washRef = doc(collection(db, 'brilho_celeste'));
      batch.set(washRef, newWash);

      if (washFormData.clientId) {
        const clientRef = doc(db, 'brilho_celeste_clients', washFormData.clientId);
        batch.update(clientRef, { washesRemaining: increment(-1) });
      }

      await batch.commit();
      setShowWashForm(false);
      setWashError(null);
      setWashFormData({ timeSlot: '09:00', clientId: '', clientName: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'brilho_celeste');
    }
  };

  const toggleWashPayment = async (id: string, currentPaid: boolean) => {
    try {
      await updateDoc(doc(db, 'brilho_celeste', id), { isPaid: !currentPaid });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `brilho_celeste/${id}`);
    }
  };

  const toggleClientPayment = async (client: BrilhoCelesteClient) => {
    try {
      const batch = writeBatch(db);
      const newPaidStatus = !client.isPaid;
      
      // Update client
      batch.update(doc(db, 'brilho_celeste_clients', client.id), { isPaid: newPaidStatus });
      
      // Update all washes of this client that were inherited from the package
      const clientWashes = washes.filter(w => w.clientId === client.id);
      clientWashes.forEach(w => {
        batch.update(doc(db, 'brilho_celeste', w.id), { isPaid: newPaidStatus });
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `brilho_celeste_clients/${client.id}`);
    }
  };

  const deleteWash = async (wash: BrilhoCelesteWash) => {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'brilho_celeste', wash.id));

      if (wash.clientId) {
        const clientRef = doc(db, 'brilho_celeste_clients', wash.clientId);
        batch.update(clientRef, { washesRemaining: increment(1) });
      }

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `brilho_celeste/${wash.id}`);
    }
  };

  const deleteClient = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'brilho_celeste_clients', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `brilho_celeste_clients/${id}`);
    }
  };

  const filteredWashes = washes.filter(w => w.date === selectedDate);
  const dayExpenses = expenses.filter(e => e.date === selectedDate);
  
  // Daily Balance Logic
  // 1. One-off washes paid on this specific date
  const dayOneOffReceived = filteredWashes.filter(w => !w.clientId && w.isPaid).reduce((acc, curr) => acc + curr.packagePrice, 0);
  
  // 2. Package payments registered on this specific date
  const dayPackageReceived = clients.filter(c => c.isPaid && c.paymentDate === selectedDate).reduce((acc, curr) => acc + curr.packagePrice, 0);
  
  const dayTotalReceived = dayOneOffReceived + dayPackageReceived;
  const dayTotalExpenses = dayExpenses.reduce((acc, curr) => acc + curr.amount, 0);
  const dayBalance = dayTotalReceived - dayTotalExpenses;

  return (
    <div className="space-y-6 pb-20 md:pt-20 px-4">
      <header className="py-4 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2">
              <Droplets className="text-cyan-400" size={24} />
              Brilho Celeste
            </h1>
            <p className="text-[10px] sm:text-slate-400 font-bold text-slate-500 uppercase tracking-widest">Controle de Lavagens e Pacotes</p>
          </div>
          <button 
            onClick={() => activeSubTab === 'agenda' ? setShowWashForm(true) : setShowClientForm(true)}
            className="bg-cyan-600 text-white p-3 rounded-xl sm:rounded-full shadow-lg shadow-cyan-900/30 active:scale-95 transition-all"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Daily Financial Status */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-900/50 border border-slate-800 p-2 sm:p-3 rounded-xl shadow-inner text-center">
            <p className="text-[7px] sm:text-[9px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Rec. Hoje</p>
            <p className="text-[10px] sm:text-base font-black text-green-400 truncate">{formatCurrency(dayTotalReceived)}</p>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 p-2 sm:p-3 rounded-xl shadow-inner text-center">
            <p className="text-[7px] sm:text-[9px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Desp. Hoje</p>
            <p className="text-[10px] sm:text-base font-black text-red-500 truncate">{formatCurrency(dayTotalExpenses)}</p>
          </div>
          <div className="bg-slate-950 p-2 sm:p-3 rounded-xl border border-cyan-900/30 shadow-lg text-center">
            <p className="text-[7px] sm:text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Saldo Hoje</p>
            <p className={cn("text-[10px] sm:text-base font-black truncate", dayBalance >= 0 ? "text-cyan-400" : "text-red-400")}>
              {formatCurrency(dayBalance)}
            </p>
          </div>
        </div>

        <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 backdrop-blur-md">
            <button 
              onClick={() => setActiveSubTab('agenda')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] sm:text-sm font-black uppercase transition-all tracking-tighter sm:tracking-normal",
                activeSubTab === 'agenda' ? "bg-slate-800 text-cyan-400 shadow-sm" : "text-slate-500"
              )}
            >
              <CalendarIcon size={14} /> Agenda
            </button>
            <button 
              onClick={() => setActiveSubTab('clientes')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] sm:text-sm font-black uppercase transition-all tracking-tighter sm:tracking-normal",
                activeSubTab === 'clientes' ? "bg-slate-800 text-cyan-400 shadow-sm" : "text-slate-500"
              )}
            >
              <Users size={14} /> Clientes
            </button>
            <button 
              onClick={() => setActiveSubTab('financas')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] sm:text-sm font-black uppercase transition-all tracking-tighter sm:tracking-normal",
                activeSubTab === 'financas' ? "bg-slate-800 text-cyan-400 shadow-sm" : "text-slate-500"
              )}
            >
              <DollarSign size={14} /> Finanças
            </button>
          </div>
        </header>
  
        {activeSubTab === 'agenda' ? (
          <div className="space-y-6">
            <div className="bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-800 flex items-center gap-3">
              <CalendarIcon size={20} className="text-blue-500" />
              <input 
                type="date" 
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="flex-1 bg-transparent font-bold text-slate-100 outline-none"
              />
            </div>
  
            <div className="space-y-3">
              {TIME_SLOTS.map((slot) => {
                const wash = filteredWashes.find(w => w.timeSlot === slot);
                return (
                  <div 
                    key={slot} 
                    className={cn(
                      "p-4 rounded-2xl border transition-all flex items-center justify-between",
                      wash ? "bg-blue-950/20 border-blue-900/30 shadow-inner" : "bg-slate-900 border-slate-800"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("font-bold text-sm", wash ? "text-blue-400" : "text-slate-600")}>
                        {slot}
                      </div>
                      {wash ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-100 leading-none">{wash.clientName}</p>
                            <button 
                              onClick={() => toggleWashPayment(wash.id, wash.isPaid)}
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ring-1 ring-inset",
                                wash.isPaid ? "bg-green-500/10 text-green-400 ring-green-500/20" : "bg-amber-500/10 text-amber-500 ring-amber-500/20"
                              )}
                            >
                              {wash.isPaid ? 'Pago' : 'Pend.'}
                            </button>
                          </div>
                          <p className="text-[10px] text-blue-500 font-bold uppercase">{wash.packageName}</p>
                        </div>
                      ) : (
                        <button 
                          onClick={() => { setWashFormData({...washFormData, timeSlot: slot}); setShowWashForm(true); }}
                          className="text-slate-600 text-sm italic font-medium"
                        >
                          Livre
                        </button>
                      )}
                    </div>
                    {wash && (
                      <button onClick={(e) => { e.stopPropagation(); setDeleteWashModal(wash); }} className="text-slate-700 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeSubTab === 'clientes' ? (
          <div className="space-y-4">
            {clients.length === 0 ? (
              <div className="bg-slate-900 p-12 rounded-3xl border border-dashed border-slate-800 text-center">
                <Users className="mx-auto text-slate-700 mb-3" size={48} />
                <p className="text-slate-500 font-medium">Nenhum cliente cadastrado.</p>
              </div>
            ) : (
              clients.map((client) => (
                <div key={client.id} className="bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-800 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-100">{client.name}</h4>
                        <button 
                          onClick={() => toggleClientPayment(client)}
                          className={cn(
                            "text-[9px] px-2 py-0.5 rounded-full font-black uppercase ring-1 ring-inset",
                            client.isPaid 
                              ? "bg-green-500/10 text-green-400 ring-green-600/20" 
                              : "bg-amber-500/10 text-amber-500 ring-amber-600/20"
                          )}
                        >
                          {client.isPaid ? 'Pago' : 'Pendente'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                        {client.phone && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center">
                              <svg className="w-3 h-3 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            </div>
                            <a href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="text-[10px] text-slate-400 font-bold hover:text-green-500 transition-colors">
                              {client.phone}
                            </a>
                          </div>
                        )}
                        {client.carInfo && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center">
                              <svg className="w-3 h-3 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 002 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>
                              </svg>
                            </div>
                            <p className="text-[10px] text-slate-300 font-bold truncate">{client.carInfo}</p>
                          </div>
                        )}
                        {!client.isPaid && client.paymentDate && (
                          <div className="flex items-center gap-1.5 col-span-2">
                            <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center">
                              <CalendarIcon size={12} className="text-amber-500" />
                            </div>
                            <p className="text-[10px] text-amber-500 font-bold">Pagar em: {formatDate(client.paymentDate)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteClientId(client.id); }} className="text-slate-700 hover:text-red-500 p-2 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="flex justify-between items-end pt-3 border-t border-slate-800/50">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Contratado</p>
                        <span className="text-[10px] text-slate-300 font-black">{client.packageName}</span>
                      </div>
                      <div className="flex gap-1.5">
                        {[...Array(client.totalWashesBought)].map((_, i) => (
                          <div 
                             key={i} 
                             className={cn(
                               "w-7 h-2 rounded-full transition-all duration-500", 
                               i < (client.totalWashesBought - client.washesRemaining) ? "bg-slate-800" : "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]"
                             )} 
                          />
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-blue-400 tracking-tighter leading-none">{client.washesRemaining}</p>
                      <p className="text-[9px] text-blue-500 font-black uppercase tracking-widest">Restantes</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total Recebido</p>
                <p className="text-lg font-black text-green-400">
                  {formatCurrency(
                    washes.filter(w => !w.clientId && w.isPaid).reduce((acc, curr) => acc + curr.packagePrice, 0) + 
                    clients.filter(c => c.isPaid).reduce((acc, curr) => acc + curr.packagePrice, 0)
                  )}
                </p>
              </div>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total Despesas</p>
                <p className="text-lg font-black text-red-500">
                  {formatCurrency(expenses.reduce((acc, curr) => acc + curr.amount, 0))}
                </p>
              </div>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm col-span-2">
                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Saldo Líquido (Realizado)</p>
                <p className="text-2xl font-black text-blue-400">
                  {formatCurrency(
                    (washes.filter(w => !w.clientId && w.isPaid).reduce((acc, curr) => acc + curr.packagePrice, 0) + 
                    clients.filter(c => c.isPaid).reduce((acc, curr) => acc + curr.packagePrice, 0)) - 
                    expenses.reduce((acc, curr) => acc + curr.amount, 0)
                  )}
                </p>
              </div>
            </div>

            <div className="bg-slate-900/40 p-4 rounded-2xl border border-dashed border-slate-800">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Resumo de Cobranças</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Pendente (Avulsos):</span>
                  <span className="font-bold text-amber-500">
                    {formatCurrency(washes.filter(w => !w.clientId && !w.isPaid).reduce((acc, curr) => acc + curr.packagePrice, 0))}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Pendente (Pacotes):</span>
                  <span className="font-bold text-amber-500">
                    {formatCurrency(clients.filter(c => !c.isPaid).reduce((acc, curr) => acc + curr.packagePrice, 0))}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-200 font-bold">Total Previsto (Total):</span>
                  <span className="font-bold text-slate-100">
                    {formatCurrency(
                      washes.filter(w => !w.clientId).reduce((acc, curr) => acc + curr.packagePrice, 0) + 
                      clients.reduce((acc, curr) => acc + curr.packagePrice, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest leading-none">Lista de Despesas</h3>
              <button 
                onClick={() => setShowExpenseForm(true)}
                className="text-blue-500 text-xs font-bold uppercase flex items-center gap-1"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>

            <div className="space-y-3">
              {expenses.length === 0 ? (
                <div className="bg-slate-950/50 rounded-2xl p-8 border border-dashed border-slate-800 text-center">
                  <p className="text-slate-500 text-xs italic">Nenhuma despesa registrada.</p>
                </div>
              ) : (
                expenses.map(expense => (
                  <div key={expense.id} className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-bold text-slate-100">{expense.description}</p>
                      <p className="text-[10px] text-slate-500">{formatDate(expense.date)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-sm font-bold text-red-400">{formatCurrency(expense.amount)}</p>
                      <button onClick={() => setDeleteExpenseId(expense.id)} className="text-slate-700 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      {/* Forms Overlay */}
      <AnimatePresence>
        {showWashForm && (
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
                <CalendarIcon className="text-cyan-500" />
                Agendar Lavagem
              </h2>
              <button 
                onClick={() => { setShowWashForm(false); setWashError(null); }} 
                className="bg-slate-800 text-slate-400 p-2 rounded-full"
              >
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleAddWash} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Horário</label>
                  <select 
                    value={washFormData.timeSlot}
                    onChange={e => setWashFormData({...washFormData, timeSlot: e.target.value})}
                    className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold"
                  >
                    {TIME_SLOTS.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Data</label>
                  <div className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl text-slate-400 text-sm font-bold flex items-center gap-2">
                    <CalendarIcon size={16} /> {formatDate(selectedDate)}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Cliente com Pacote</label>
                <select 
                  value={washFormData.clientId}
                  onChange={e => setWashFormData({...washFormData, clientId: e.target.value, clientName: ''})}
                  className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold"
                >
                  <option value="">Avulso (Não cadastrado)</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id} disabled={c.washesRemaining <= 0}>
                      {c.name} ({c.washesRemaining} rest.)
                    </option>
                  ))}
                </select>
              </div>

              {!washFormData.clientId ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-cyan-400 uppercase ml-1">Nome do Cliente Avulso</label>
                  <input 
                    type="text" required
                    value={washFormData.clientName}
                    onChange={e => setWashFormData({...washFormData, clientName: e.target.value})}
                    className="w-full p-4 bg-cyan-950/20 border border-cyan-900/30 rounded-2xl outline-none text-slate-100 font-bold placeholder:text-slate-600"
                    placeholder="Ex: Irmão José"
                  />
                </div>
              ) : (
                <div className="p-4 bg-green-500/5 rounded-2xl border border-green-500/10 flex items-center gap-3">
                  <CheckCircle2 className="text-green-500" size={18} />
                  <p className="text-sm text-green-400 font-bold">Lavagem descontada do pacote.</p>
                </div>
              )}

              {washError && (
                <div className="p-4 bg-red-500/5 rounded-2xl border border-red-500/10 flex items-center gap-3">
                  <XCircle className="text-red-500" size={18} />
                  <p className="text-sm text-red-400 font-bold">{washError}</p>
                </div>
              )}

              <button type="submit" className="w-full bg-cyan-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-cyan-900/30 mt-4 active:scale-95 transition-all uppercase tracking-widest text-sm">
                Confirmar Agendamento
              </button>
            </form>
          </motion.div>
        )}

        {showExpenseForm && (
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
                <DollarSign className="text-red-400" />
                Registrar Despesa
              </h2>
              <button 
                onClick={() => setShowExpenseForm(false)} 
                className="bg-slate-800 text-slate-400 p-2 rounded-full"
              >
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Descrição</label>
                <input 
                  type="text" required
                  value={expenseFormData.description}
                  onChange={e => setExpenseFormData({...expenseFormData, description: e.target.value})}
                  className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold placeholder:text-slate-600"
                  placeholder="Ex: Sabão, Esponjas, etc."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Valor</label>
                  <input 
                    type="number" required step="0.01"
                    value={expenseFormData.amount || ''}
                    onChange={e => setExpenseFormData({...expenseFormData, amount: parseFloat(e.target.value)})}
                    className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Data</label>
                  <input 
                    type="date" required
                    value={expenseFormData.date}
                    onChange={e => setExpenseFormData({...expenseFormData, date: e.target.value})}
                    className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold"
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-red-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-red-900/30 mt-4 active:scale-95 transition-all uppercase tracking-widest text-sm">
                Confirmar Despesa
              </button>
            </form>
          </motion.div>
        )}

        {showClientForm && (
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
                <Users className="text-cyan-500" />
                Novo Cliente (Pacote)
              </h2>
              <button onClick={() => setShowClientForm(false)} className="bg-slate-800 text-slate-400 p-2 rounded-full">
                <XCircle size={20} />
              </button>
            </div>
            <form onSubmit={handleAddClient} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Nome Completo</label>
                <input 
                  type="text" required
                  value={clientFormData.name}
                  onChange={e => setClientFormData({...clientFormData, name: e.target.value})}
                  className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold"
                  placeholder="Nome do cliente"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">WhatsApp</label>
                  <input 
                    type="tel"
                    value={clientFormData.phone}
                    onChange={e => setClientFormData({...clientFormData, phone: e.target.value})}
                    className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold placeholder:text-slate-600"
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Veículo (Carro)</label>
                  <input 
                    type="text"
                    value={clientFormData.carInfo}
                    onChange={e => setClientFormData({...clientFormData, carInfo: e.target.value})}
                    className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold placeholder:text-slate-600"
                    placeholder="Cor / Modelo / Placa"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Pacote Contratado</label>
                <div className="grid grid-cols-3 gap-2">
                  {PACKAGES.map(pkg => (
                    <button
                      key={pkg.name} type="button"
                      onClick={() => setClientFormData({...clientFormData, packageName: pkg.name})}
                      className={cn(
                        "p-3 rounded-2xl border text-center text-[10px] font-black transition-all uppercase",
                        clientFormData.packageName === pkg.name ? "bg-cyan-600 text-white border-cyan-600 shadow-lg shadow-cyan-900/20" : "bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700"
                      )}
                    >
                      {pkg.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Status Pagto.</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setClientFormData({...clientFormData, isPaid: true})}
                      className={cn(
                        "flex-1 py-4 rounded-2xl border text-[10px] font-black transition-all flex items-center justify-center gap-2 uppercase",
                        clientFormData.isPaid ? "bg-green-600 text-white border-green-600 shadow-lg shadow-green-900/20" : "bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700"
                      )}
                    >
                      <CheckCircle2 size={16} /> PAGO
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientFormData({...clientFormData, isPaid: false})}
                      className={cn(
                        "flex-1 py-4 rounded-2xl border text-[10px] font-black transition-all flex items-center justify-center gap-2 uppercase",
                        !clientFormData.isPaid ? "bg-amber-600 text-white border-amber-600 shadow-lg shadow-amber-900/20" : "bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700"
                      )}
                    >
                      <XCircle size={16} /> PEND.
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Data Pagto/Venc.</label>
                  <input 
                    type="date"
                    value={clientFormData.paymentDate}
                    onChange={e => setClientFormData({...clientFormData, paymentDate: e.target.value})}
                    className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl outline-none text-slate-100 font-bold"
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-cyan-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-cyan-900/30 mt-4 active:scale-95 transition-all uppercase text-sm tracking-widest">
                Salvar Cadastro
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!deleteWashModal}
        message="Você realmente quer excluir esta ação?"
        onConfirm={() => {
          if (deleteWashModal) deleteWash(deleteWashModal);
        }}
        onCancel={() => setDeleteWashModal(null)}
      />

      <ConfirmModal
        isOpen={!!deleteClientId}
        message="Você realmente quer excluir este cliente e seu pacote?"
        onConfirm={() => {
          if (deleteClientId) deleteClient(deleteClientId);
        }}
        onCancel={() => setDeleteClientId(null)}
      />

      <ConfirmModal
        isOpen={!!deleteExpenseId}
        message="Você realmente quer excluir esta despesa?"
        onConfirm={() => {
          if (deleteExpenseId) {
            deleteExpense(deleteExpenseId);
            setDeleteExpenseId(null);
          }
        }}
        onCancel={() => setDeleteExpenseId(null)}
      />
    </div>
  );
};

export default BrilhoCeleste;
