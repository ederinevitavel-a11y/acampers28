import React, { useState, useEffect } from 'react';
import { Plus, Trash2, User, CreditCard, Search, Calendar as CalendarIcon, IdCard, CheckCircle2, XCircle, ChevronRight, Bell, Receipt, Edit3, Users, FileSpreadsheet, FileText, Phone } from 'lucide-react';
import { Participant, Installment, Dependent } from '../types';
import { cn, formatDate, formatCurrency } from '../lib/utils';
import { MEMBERS_LIST } from '../data/members';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc, writeBatch, where, getDocs } from 'firebase/firestore';
import { useConsolidatedData } from '../hooks/useConsolidatedData';
import { ConfirmModal } from './ConfirmModal';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const CAMP_DATE = new Date('2028-01-01'); // Fix to beginning of 2028

const Participantes: React.FC = () => {
  const { participants: allParticipants, installments: allInstallments, loading } = useConsolidatedData();
  const [installmentsMap, setInstallmentsMap] = useState<Record<string, Installment[]>>({});
  const [showForm, setShowForm] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentModal, setPaymentModal] = useState<{isOpen: boolean, participantId: string, inst: Installment | null, amount: string, error?: string}>({isOpen: false, participantId: '', inst: null, amount: ''});
  const [obsModal, setObsModal] = useState<{isOpen: boolean, instId: string, text: string}>({isOpen: false, instId: '', text: ''});
  const [deleteParticipantModal, setDeleteParticipantModal] = useState<{id: string, name: string} | null>(null);
  const [deleteDependentModal, setDeleteDependentModal] = useState<{id: string, name: string} | null>(null);
  
  // Update local installments map when global data changes or for detail view
  useEffect(() => {
    if (selectedParticipantId) {
      const pInstallments = allInstallments.filter(i => i.participantId === selectedParticipantId);
      setInstallmentsMap(prev => ({ ...prev, [selectedParticipantId]: pInstallments.sort((a, b) => a.month.localeCompare(b.month)) }));
    }
  }, [allInstallments, selectedParticipantId]);

  const [formData, setFormData] = useState({
    name: '',
    rg: '',
    phone: '',
    birthDate: '',
    transport: 'Carro' as 'Carro' | 'Ônibus',
    installments: 1,
    dueDay: 10,
    observation: '',
    isPaid: false,
    dependents: [] as Dependent[]
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const getMaxInstallments = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12
    
    // Deadline: Dec 2027
    const targetYear = 2027;
    const targetMonth = 12;
    
    // Total months available from NEXT month
    const totalMonths = ((targetYear - currentYear) * 12) + (targetMonth - currentMonth);
    return Math.max(1, totalMonths);
  };

  const getParticipantOverdue = (participantId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allInstallments.some(inst => 
      inst.participantId === participantId && 
      !inst.isPaid && 
      new Date(inst.dueDate + 'T12:00:00') < today
    );
  };

  const getParticipantOverdueDetails = (participantId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueInsts = allInstallments.filter(inst => 
      inst.participantId === participantId && 
      !inst.isPaid && 
      new Date(inst.dueDate + 'T12:00:00') < today
    ).sort((a, b) => new Date(a.dueDate + 'T12:00:00').getTime() - new Date(b.dueDate + 'T12:00:00').getTime());
    
    if (overdueInsts.length === 0) return null;
    const oldest = overdueInsts[0];
    const dueDateObj = new Date(oldest.dueDate + 'T12:00:00');
    const diffTime = Math.abs(today.getTime() - dueDateObj.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
      dueDate: oldest.dueDate,
      daysOverdue: diffDays,
      amount: oldest.amount,
      count: overdueInsts.length
    };
  };

  const calculateAgeAtCamp = (birthDateStr: string) => {
    if (!birthDateStr) return 0;
    const birthDate = new Date(birthDateStr);
    let age = CAMP_DATE.getFullYear() - birthDate.getFullYear();
    const monthDiff = CAMP_DATE.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && CAMP_DATE.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getPaymentType = (age: number): 'Inteira' | 'Meia' | 'Isento' => {
    if (age <= 5) return 'Isento';
    if (age <= 10) return 'Meia';
    return 'Inteira';
  };

  const getPaymentValue = (type: 'Inteira' | 'Meia' | 'Isento', transport: 'Carro' | 'Ônibus') => {
    if (type === 'Isento') return 0;
    if (transport === 'Ônibus') {
      return type === 'Inteira' ? 864 : 432;
    } else {
      return type === 'Inteira' ? 720 : 360;
    }
  };

  const handleAddDependent = () => {
    setFormData(prev => ({
      ...prev,
      dependents: [
        ...prev.dependents,
        { id: Math.random().toString(36).substring(7), name: '', birthDate: '', relationship: 'Cônjuge', ageAtCamp: 0, paymentType: 'Inteira' }
      ]
    }));
  };

  const updateDependent = (id: string, field: keyof Dependent, value: string) => {
    setFormData(prev => ({
      ...prev,
      dependents: prev.dependents.map(dep => 
        dep.id === id ? { ...dep, [field]: value } : dep
      )
    }));
  };

  const removeDependent = (id: string) => {
    setFormData(prev => ({
      ...prev,
      dependents: prev.dependents.filter(dep => dep.id !== id)
    }));
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert("Por favor, informe o nome do participante principal.");
      return;
    }

    const ageAtCamp = formData.birthDate ? calculateAgeAtCamp(formData.birthDate) : 0;
    const paymentType = formData.birthDate ? getPaymentType(ageAtCamp) : 'Inteira';
    
    let totalValue = getPaymentValue(paymentType, formData.transport);

    const processedDependents = formData.dependents.map(dep => {
      const depAge = calculateAgeAtCamp(dep.birthDate);
      const depType = getPaymentType(depAge);
      totalValue += getPaymentValue(depType, formData.transport);
      return {
        ...dep,
        ageAtCamp: depAge,
        paymentType: depType
      };
    });
    
    const participantData = {
      name: formData.name,
      rg: formData.rg,
      phone: formData.phone,
      birthDate: formData.birthDate,
      transport: formData.transport,
      installments: formData.installments,
      dueDay: formData.dueDay,
      observation: formData.observation,
      isPaid: formData.isPaid,
      dependents: processedDependents,
      ageAtCamp,
      paymentType,
      totalValue,
      timestamp: Date.now(),
    };
    
    try {
      if (editingId) {
        // Update existing participant
        await updateDoc(doc(db, 'participants', editingId), participantData);
        
        // Update existing installments or regenerate if no payments have been made
        const q = query(collection(db, 'installments'), where('participantId', '==', editingId));
        const snapshot = await getDocs(q);
        
        const existingInstallments = snapshot.docs.map(d => d.data());
        const hasPayments = existingInstallments.some(i => (i.paidAmount || 0) > 0 || i.isPaid);

        if (!hasPayments || snapshot.empty) {
          // Regenerate installments to match new total/installment count
          const batch = writeBatch(db);
          // Delete old ones first
          snapshot.docs.forEach(d => batch.delete(d.ref));
          
          if (totalValue > 0 && formData.installments > 0) {
            const installmentAmount = totalValue / formData.installments;
            let currentYear = new Date().getFullYear();
            let currentMonth = new Date().getMonth() + 2; // Start next month
            
            for (let i = 0; i < formData.installments; i++) {
              if (currentMonth > 12) { currentMonth = 1; currentYear++; }
              const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
              const dueDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(formData.dueDay).padStart(2, '0')}`;
              const instRef = doc(collection(db, 'installments'));
              batch.set(instRef, {
                participantId: editingId,
                participantName: formData.name,
                amount: installmentAmount,
                paidAmount: formData.isPaid ? installmentAmount : 0,
                month: monthStr,
                dueDate: dueDate,
                isPaid: formData.isPaid,
                timestamp: Date.now()
              });
              currentMonth++;
            }
          }
          await batch.commit();
        } else {
          // Just update the names for consistency
          const batch = writeBatch(db);
          snapshot.docs.forEach(d => {
            batch.update(d.ref, { participantName: formData.name });
          });
          await batch.commit();
        }
      } else {
        // Add new participant
        const docRef = await addDoc(collection(db, 'participants'), participantData);
        
        // Generate installments
        if (totalValue > 0 && formData.installments > 0) {
          const batch = writeBatch(db);
          const installmentAmount = totalValue / formData.installments;
          
          let currentYear = new Date().getFullYear();
          let currentMonth = new Date().getMonth() + 2; // Start next month
          
          for (let i = 0; i < formData.installments; i++) {
            if (currentMonth > 12) { currentMonth = 1; currentYear++; }
            const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
            const dueDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(formData.dueDay).padStart(2, '0')}`;
            
            const instRef = doc(collection(db, 'installments'));
            batch.set(instRef, {
              participantId: docRef.id,
              participantName: formData.name,
              amount: installmentAmount,
              paidAmount: formData.isPaid ? installmentAmount : 0,
              month: monthStr,
              dueDate: dueDate,
              isPaid: formData.isPaid,
              timestamp: Date.now()
            });
            
            currentMonth++;
          }
          await batch.commit();
        }
      }
      
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', rg: '', phone: '', birthDate: '', transport: 'Carro', installments: 1, dueDay: 10, observation: '', isPaid: false, dependents: [] });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'participants');
    }
  };

  const toggleInstallment = async (participantId: string, installmentId: string, currentPaid: boolean, amount: number) => {
    try {
      const nextPaid = !currentPaid;
      await updateDoc(doc(db, 'installments', installmentId), { 
        isPaid: nextPaid,
        paidAmount: nextPaid ? amount : 0
      });
      
      // Check if all are paid to update participant status
      const q = query(collection(db, 'installments'), where('participantId', '==', participantId));
      const snapshot = await getDocs(q);
      const allPaid = snapshot.docs.every(d => d.id === installmentId ? nextPaid : d.data().isPaid);
      
      await updateDoc(doc(db, 'participants', participantId), { isPaid: allPaid });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `installments/${installmentId}`);
    }
  };

  const openUpdateObservation = (installmentId: string, currentObservation: string) => {
    setObsModal({ isOpen: true, instId: installmentId, text: currentObservation || '' });
  };

  const submitUpdateObservation = async () => {
    try {
      await updateDoc(doc(db, 'installments', obsModal.instId), { observation: obsModal.text });
      setObsModal({ isOpen: false, instId: '', text: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `installments/${obsModal.instId}`);
    }
  };

  const openPartialPayment = (participantId: string, installment: Installment) => {
    setPaymentModal({
      isOpen: true,
      participantId,
      inst: installment,
      amount: (installment.paidAmount || 0).toString(),
      error: undefined
    });
  };

  const submitPartialPayment = async () => {
    if (!paymentModal.inst) return;
    
    const newPaidAmount = parseFloat(paymentModal.amount.replace(',', '.'));
    if (isNaN(newPaidAmount) || newPaidAmount < 0) {
      setPaymentModal(prev => ({ ...prev, error: "Por favor, insira um valor válido." }));
      return;
    }

    try {
      const isPaid = newPaidAmount >= paymentModal.inst.amount;
      await updateDoc(doc(db, 'installments', paymentModal.inst.id), { 
        paidAmount: newPaidAmount,
        isPaid: isPaid
      });

      // Update participant main status
      const q = query(collection(db, 'installments'), where('participantId', '==', paymentModal.participantId));
      const snapshot = await getDocs(q);
      const allPaid = snapshot.docs.every(d => d.id === paymentModal.inst!.id ? isPaid : d.data().isPaid);
      
      await updateDoc(doc(db, 'participants', paymentModal.participantId), { isPaid: allPaid });
      setPaymentModal({ isOpen: false, participantId: '', inst: null, amount: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `installments/${paymentModal.inst.id}`);
    }
  };

  const sendWhatsAppReceipt = (p: Participant, installments: Installment[]) => {
    const paidInstallments = installments.filter(i => i.isPaid);
    const totalPaid = paidInstallments.reduce((acc, i) => acc + (i.paidAmount || 0), 0);
    
    let message = `*ACAMPA 2028 - COMPROVANTE DE PAGAMENTO*\n\n`;
    message += `*Acamper:* ${p.name}\n`;
    message += `*Valor Total:* ${formatCurrency(p.totalValue || 0)}\n`;
    message += `*Total Pago:* ${formatCurrency(totalPaid)}\n`;
    message += `*Saldo Devedor:* ${formatCurrency((p.totalValue || 0) - totalPaid)}\n\n`;
    
    if (paidInstallments.length > 0) {
      message += `*Parcelas Pagas:*\n`;
      paidInstallments.forEach(i => {
        message += `- ${i.month}: ${formatCurrency(i.paidAmount || 0)}\n`;
      });
    }
    
    message += `\n_Gerado em ${new Date().toLocaleDateString('pt-BR')}_`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/55${p.phone?.replace(/\D/g, '')}?text=${encodedMessage}`, '_blank');
  };

  const generatePDFReceipt = (p: Participant, installments: Installment[]) => {
    const doc = new jsPDF();
    const paidInstallments = installments.filter(i => i.isPaid);
    const totalPaid = paidInstallments.reduce((acc, i) => acc + (i.paidAmount || 0), 0);
    const userEmail = auth.currentUser?.email || 'N/A';
    
    // Header
    doc.setFillColor(79, 70, 229); // Indigo 600
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('ACAMPA 2028', 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text('COMPROVANTE DE PAGAMENTO', 105, 32, { align: 'center' });
    
    // Participant Info
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Dados do Acamper:', 14, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nome: ${p.name}`, 14, 62);
    doc.text(`RG: ${p.rg || 'Não informado'}`, 14, 69);
    doc.text(`Telefone: ${p.phone || 'Não informado'}`, 14, 76);
    
    // Summary
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Financeiro:', 14, 90);
    doc.setFont('helvetica', 'normal');
    
    autoTable(doc, {
      startY: 95,
      head: [['Descrição', 'Valor']],
      body: [
        ['Valor Total', formatCurrency(p.totalValue || 0)],
        ['Total Pago', formatCurrency(totalPaid)],
        ['Saldo Devedor', formatCurrency((p.totalValue || 0) - totalPaid)]
      ],
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      margin: { left: 14, right: 14 }
    });
    
    // History
    if (paidInstallments.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Histórico de Pagamentos:', 14, (doc as any).lastAutoTable.finalY + 15);
      
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Mês', 'Vencimento', 'Valor Pago', 'Status']],
        body: paidInstallments.map(i => [
          i.month,
          formatDate(i.dueDate),
          formatCurrency(i.paidAmount || 0),
          'PAGO'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }, // Emerald 500
        margin: { left: 14, right: 14 }
      });
    } else {
      doc.setFont('helvetica', 'italic');
      doc.text('Nenhum pagamento registrado até o momento.', 14, (doc as any).lastAutoTable.finalY + 15);
    }
    
    // Footer
    const finalY = (doc as any).lastAutoTable.finalY + 30;
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(`Recibo gerado por: ${userEmail}`, 14, finalY);
    doc.text(`Data de emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, finalY + 6);
    
    doc.save(`Recibo_${p.name.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
  };

  const handleEditParticipant = (p: Participant) => {
    setEditingId(p.id);
    setFormData({
      name: p.name,
      rg: p.rg,
      phone: p.phone || '',
      birthDate: p.birthDate,
      transport: p.transport,
      installments: p.installments || 1,
      dueDay: p.dueDay || 10,
      observation: p.observation || '',
      isPaid: p.isPaid,
      dependents: p.dependents || []
    });
    setShowForm(true);
  };

  const deleteParticipant = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'participants', id));
      // Delete installments too
      const q = query(collection(db, 'installments'), where('participantId', '==', id));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `participants/${id}`);
    }
  };

  const getInstallmentStatus = (inst: Installment) => {
    if (inst.isPaid) return { label: 'Pago', class: 'bg-green-500/10 text-green-400 border-green-500/20' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(inst.dueDate + 'T12:00:00'); // Add time to avoid timezone shifts
    
    if (dueDate < today) {
      return { label: 'Em Atraso', class: 'bg-red-500/10 text-red-500 border-red-500/20' };
    }
    return { label: 'Em Dia', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
  };

  const filteredParticipants = allParticipants.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.rg.includes(searchTerm)
  );

  const handleExportExcel = () => {
    const data = [];
    allParticipants.forEach(p => {
      const status = (!p.totalValue || p.totalValue === 0) ? 'Isento' : p.isPaid ? 'Liquidado' : getParticipantOverdue(p.id) ? 'Em Atraso' : 'Em Dia';
      
      // Add Titular
      data.push({
        'Tipo': 'Titular',
        'Nome': p.name,
        'RG': p.rg,
        'Parentesco': '-',
        'Nascimento': formatDate(p.birthDate),
        'Idade (2028)': p.ageAtCamp,
        'Transporte': p.transport,
        'Categoria': p.paymentType,
        'Telefone': p.phone || '',
        'Status Financeiro': status,
        'Valor Total': p.totalValue || 0,
        'Observação': p.observation || ''
      });

      // Add Dependents
      if (p.dependents && p.dependents.length > 0) {
        p.dependents.forEach(dep => {
          data.push({
            'Tipo': 'Dependente',
            'Nome': dep.name,
            'RG': dep.rg || '',
            'Parentesco': dep.relationship,
            'Nascimento': formatDate(dep.birthDate),
            'Idade (2028)': dep.ageAtCamp,
            'Transporte': p.transport, // Dependent follows titular
            'Categoria': dep.paymentType,
            'Telefone': p.phone || '', 
            'Status Financeiro': status,
            'Valor Total': 0, 
            'Observação': `Dependente de ${p.name}`
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Acampers");
    XLSX.writeFile(workbook, `Lista_Acampers_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const title = "Lista Completa de Acampers 2028";
    
    doc.setFontSize(18);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, 22);

    const tableData = [];
    allParticipants.forEach(p => {
      const status = (!p.totalValue || p.totalValue === 0) ? 'Isento' : p.isPaid ? 'Liquidado' : getParticipantOverdue(p.id) ? 'Em Atraso' : 'Em Dia';
      
      tableData.push([
        'Titular',
        p.name,
        p.rg,
        formatDate(p.birthDate),
        p.ageAtCamp,
        p.paymentType,
        p.transport,
        status
      ]);

      if (p.dependents && p.dependents.length > 0) {
        p.dependents.forEach(dep => {
          tableData.push([
            'Dependente',
            dep.name,
            dep.rg || '-',
            formatDate(dep.birthDate),
            dep.ageAtCamp,
            dep.paymentType,
            p.transport,
            status
          ]);
        });
      }
    });

    autoTable(doc, {
      head: [['Tipo', 'Nome', 'RG', 'Nascimento', 'Idade', 'Categoria', 'Transporte', 'Status']],
      body: tableData,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
    });

    doc.save(`Lista_Acampers_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
  };

  const totalPeople = allParticipants.length + allParticipants.reduce((acc, p) => acc + (p.dependents?.length || 0), 0);
  const totalInteira = allParticipants.reduce((acc, p) => acc + (p.paymentType === 'Inteira' ? 1 : 0) + (p.dependents?.filter(d => d.paymentType === 'Inteira').length || 0), 0);
  const totalMeia = allParticipants.reduce((acc, p) => acc + (p.paymentType === 'Meia' ? 1 : 0) + (p.dependents?.filter(d => d.paymentType === 'Meia').length || 0), 0);
  const totalIsentos = allParticipants.reduce((acc, p) => acc + (p.paymentType === 'Isento' ? 1 : 0) + (p.dependents?.filter(d => d.paymentType === 'Isento').length || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-28 md:pt-20 px-3 sm:px-4">
      <header className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="text-indigo-400" size={24} />
            Acampers
          </h1>
          <p className="text-xs sm:text-slate-400 font-medium text-slate-500">Cadastro do Acampa 2028</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <button 
              onClick={handleExportExcel}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 p-2.5 rounded-xl border border-emerald-500/20 active:scale-95 transition-all"
              title="Exportar Excel"
            >
              <FileSpreadsheet size={18} />
              <span className="text-[10px] font-bold uppercase sm:hidden">Excel</span>
            </button>
            <button 
              onClick={handleExportPDF}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 p-2.5 rounded-xl border border-red-500/20 active:scale-95 transition-all"
              title="Exportar PDF"
            >
              <FileText size={18} />
              <span className="text-[10px] font-bold uppercase sm:hidden">PDF</span>
            </button>
          </div>
          <button 
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', rg: '', phone: '', birthDate: '', transport: 'Carro', installments: 1, dueDay: 10, observation: '', isPaid: false, dependents: [] });
              setShowForm(true);
            }}
            className="bg-indigo-600 text-white p-3 rounded-xl sm:rounded-full shadow-lg shadow-indigo-900/30 active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus size={20} />
            <span className="text-[10px] font-bold uppercase sm:hidden">Novo</span>
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
        <input 
          type="text" 
          placeholder="Buscar acamper..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full p-3.5 pl-10 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-inner outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium text-slate-100 placeholder:text-slate-600"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-1">
        <div className="bg-slate-900/40 p-2.5 rounded-2xl border border-slate-800/80 shadow-sm text-center">
          <p className="text-[8px] sm:text-[9px] text-indigo-400 font-black uppercase mb-0.5 flex items-center justify-center gap-1 tracking-wider"><Users size={10} /> Pessoas</p>
          <p className="text-lg sm:text-xl font-black text-slate-100">{totalPeople}</p>
        </div>
        <div className="bg-slate-900/40 p-2.5 rounded-2xl border border-slate-800/80 shadow-sm text-center">
          <p className="text-[8px] sm:text-[9px] text-fuchsia-400 font-black uppercase mb-0.5 flex items-center justify-center gap-1 tracking-wider">Inteiras</p>
          <p className="text-lg font-black text-fuchsia-100">{totalInteira}</p>
        </div>
        <div className="bg-slate-900/40 p-2.5 rounded-2xl border border-slate-800/80 shadow-sm text-center">
          <p className="text-[8px] sm:text-[9px] text-sky-400 font-black uppercase mb-0.5 flex items-center justify-center gap-1 tracking-wider">Meias</p>
          <p className="text-lg font-black text-sky-100">{totalMeia}</p>
        </div>
        <div className="bg-slate-900/40 p-2.5 rounded-2xl border border-slate-800/80 shadow-sm text-center">
          <p className="text-[8px] sm:text-[9px] text-emerald-400 font-black uppercase mb-0.5 flex items-center justify-center gap-1 tracking-wider">Isentos</p>
          <p className="text-lg font-black text-emerald-100">{totalIsentos}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2">
        <div className="bg-slate-900/50 p-2.5 rounded-2xl border border-slate-800/50 shadow-sm text-center">
          <p className="text-[8px] sm:text-[9px] text-slate-500 font-black uppercase mb-0.5 tracking-widest">Titulares</p>
          <p className="text-base sm:text-lg font-black text-slate-100">{allParticipants.length}</p>
        </div>
        <div className="bg-green-500/5 p-2.5 rounded-2xl border border-green-500/10 shadow-sm text-center">
          <p className="text-[8px] sm:text-[9px] text-green-500 font-black uppercase mb-0.5 tracking-widest">Liquidados</p>
          <p className="text-base sm:text-lg font-black text-green-400">{allParticipants.filter(p => p.isPaid || p.totalValue === 0).length}</p>
        </div>
        <div className="bg-blue-500/5 p-2.5 rounded-2xl border border-blue-500/10 shadow-sm text-center">
          <p className="text-[8px] sm:text-[9px] text-blue-400 font-black uppercase mb-0.5 tracking-widest">Em Dia</p>
          <p className="text-base sm:text-lg font-black text-blue-400">{allParticipants.filter(p => !p.isPaid && p.totalValue > 0 && !getParticipantOverdue(p.id)).length}</p>
        </div>
        <div className="bg-red-500/5 p-2.5 rounded-2xl border border-red-500/10 shadow-sm text-center">
          <p className="text-[8px] sm:text-[9px] text-red-500 font-black uppercase mb-0.5 tracking-widest">Atrasados</p>
          <p className="text-base sm:text-lg font-black text-red-500">{allParticipants.filter(p => !p.isPaid && p.totalValue > 0 && getParticipantOverdue(p.id)).length}</p>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
            <motion.div 
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-slate-900 p-6 rounded-t-3xl shadow-2xl border-t border-slate-800 fixed inset-x-0 bottom-0 top-10 z-[60] md:relative md:top-0 md:rounded-3xl md:border md:inset-x-0 md:bottom-auto overflow-y-auto no-scrollbar pb-24 md:pb-6"
            >
              <div className="w-12 h-1 bg-slate-800 rounded-full mx-auto mb-6 md:hidden" />
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
                  <User className="text-indigo-500" />
                  {editingId ? 'Editar Acamper' : 'Novo Acamper'}
                </h2>
                <button 
                  onClick={() => { setShowForm(false); setEditingId(null); }} 
                  className="bg-slate-800 text-slate-400 p-2 rounded-full hover:text-slate-200 transition-colors"
                >
                  <XCircle size={20} />
                </button>
              </div>
            <form onSubmit={handleAddParticipant} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
                  <User size={12} /> Nome Completo
                </label>
                <input 
                  type="text" 
                  placeholder="Nome do participante"
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  list="members-list"
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100 font-medium"
                />
                <datalist id="members-list">
                  {MEMBERS_LIST
                    .filter(name => !allParticipants.some(p => p.name.toLowerCase() === name.toLowerCase() && p.id !== editingId))
                    .sort()
                    .map(name => (
                      <option key={name} value={name} />
                    ))
                  }
                </datalist>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
                  <Phone size={12} className="text-emerald-500" /> WhatsApp/Telefone
                </label>
                <input 
                  type="text" 
                  placeholder="(00) 00000-0000"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
                    <IdCard size={12} /> RG
                  </label>
                  <input 
                    type="text" 
                    placeholder="00.000.000-0"
                    value={formData.rg}
                    onChange={e => setFormData({...formData, rg: e.target.value})}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
                    <CalendarIcon size={12} /> Nascimento
                  </label>
                  <input 
                    type="date" 
                    required
                    value={formData.birthDate}
                    onChange={e => setFormData({...formData, birthDate: e.target.value})}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
                  Meio de Transporte
                </label>
                <div className="flex gap-4 p-1 bg-slate-800 rounded-xl border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, transport: 'Carro'})}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all",
                      formData.transport === 'Carro' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    Carro
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, transport: 'Ônibus'})}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-all",
                      formData.transport === 'Ônibus' ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    Ônibus
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
                  Observação
                </label>
                <textarea 
                  placeholder="Restrições alimentares, problemas de saúde, etc..."
                  value={formData.observation}
                  onChange={e => setFormData({...formData, observation: e.target.value})}
                  className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-100 font-medium text-sm resize-none"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
                    <CreditCard size={12} /> Qtd Parcelas
                  </label>
                    <select 
                      value={formData.installments}
                      onChange={e => setFormData({...formData, installments: Number(e.target.value)})}
                      className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                    >
                      {[...Array(getMaxInstallments())].map((_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}x</option>
                      ))}
                    </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
                    <CalendarIcon size={12} /> Dia Vencimento
                  </label>
                  <select 
                    value={formData.dueDay}
                    onChange={e => setFormData({...formData, dueDay: Number(e.target.value)})}
                    className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium"
                  >
                    {[5, 10, 15, 20, 25].map(day => (
                      <option key={day} value={day}>Dia {day}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 italic ml-1">* Parcelamento entre 07/2026 e 12/2027</p>

              {formData.birthDate && (
                <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-900/50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-indigo-400 font-bold uppercase">Idade em Base a 01/2028</p>
                      <p className="text-lg font-bold text-indigo-300">{calculateAgeAtCamp(formData.birthDate)} anos</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-indigo-400 font-bold uppercase">Categoria</p>
                      <p className="text-lg font-bold text-indigo-300">{getPaymentType(calculateAgeAtCamp(formData.birthDate))}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Dependents Section */}
              <div className="pt-2 border-t border-slate-700/50 mt-4 mb-2">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                    <Users size={16} className="text-indigo-400" /> Dependentes Familiares
                  </label>
                  <button 
                    type="button" 
                    onClick={handleAddDependent}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-full transition-all"
                  >
                    <Plus size={14} /> Adicionar
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.dependents.map((dep, index) => (
                    <div key={dep.id} className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl relative group">
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setDeleteDependentModal({id: dep.id, name: dep.name}); }}
                        className="absolute -top-2 -right-2 bg-red-500/10 text-red-400 hover:text-red-300 hover:bg-red-500/20 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all border border-red-500/20"
                      >
                        <Trash2 size={12} />
                      </button>
                      
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="col-span-2 space-y-1">
                          <input 
                            type="text" 
                            placeholder="Nome do dependente"
                            required
                            value={dep.name}
                            onChange={e => updateDependent(dep.id, 'name', e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <input 
                            type="text" 
                            placeholder="RG (Opcional)"
                            value={dep.rg || ''}
                            onChange={e => updateDependent(dep.id, 'rg', e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 text-slate-100"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Parentesco</label>
                          <select 
                            value={dep.relationship}
                            onChange={e => updateDependent(dep.id, 'relationship', e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg outline-none text-slate-100"
                          >
                            <option value="Cônjuge">Cônjuge</option>
                            <option value="Filho(a)">Filho(a)</option>
                            <option value="Outro">Outro</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Nascimento</label>
                          <input 
                            type="date" 
                            value={dep.birthDate}
                            onChange={e => updateDependent(dep.id, 'birthDate', e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg outline-none text-slate-100"
                          />
                        </div>
                      </div>

                      {dep.birthDate && (
                        <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
                          <div className="text-[10px] font-medium text-slate-400">
                            Idade: <span className="text-indigo-400 font-bold">{calculateAgeAtCamp(dep.birthDate)} anos</span>
                          </div>
                          <div className="text-[10px] font-medium text-slate-400">
                            Valor: <span className="text-emerald-400 font-bold">{getPaymentType(calculateAgeAtCamp(dep.birthDate))}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {formData.dependents.length === 0 && (
                    <div className="text-center py-4 text-xs font-medium text-slate-500 italic bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
                      Nenhum dependente adicionado.
                    </div>
                  )}
                </div>
              </div>

              {/* Total Calculation Preview */}
              <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Valor Total (Família)</span>
                  <span className="text-xl font-black text-white">
                    {formatCurrency(
                      getPaymentValue(
                        formData.birthDate ? getPaymentType(calculateAgeAtCamp(formData.birthDate)) : 'Inteira',
                        formData.transport
                      ) + 
                      formData.dependents.reduce((acc, dep) => acc + getPaymentValue(
                        dep.birthDate ? getPaymentType(calculateAgeAtCamp(dep.birthDate)) : 'Isento',
                        formData.transport
                      ), 0)
                    )}
                  </span>
                </div>
              </div>

              <div className="pt-6 sticky bottom-0 bg-slate-900 pb-2">
                <button 
                  type="submit"
                  className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all text-sm uppercase tracking-wider"
                >
                  {editingId ? 'Salvar Alterações' : 'Confirmar Inscrição'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        {filteredParticipants.length === 0 ? (
          <div className="bg-slate-900 p-12 rounded-3xl border border-dashed border-slate-800 text-center">
            <User className="mx-auto text-slate-700 mb-3" size={48} />
            <p className="text-slate-500 font-medium">Nenhum participante encontrado.</p>
          </div>
        ) : (
          filteredParticipants.map((p) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={p.id} 
              className="bg-slate-900 overflow-hidden rounded-2xl shadow-md border border-slate-800 active:border-slate-700 transition-colors"
            >
              <div 
                className="p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer active:bg-slate-800 transition-colors gap-3"
                onClick={() => {
                  if (selectedParticipantId === p.id) {
                    setSelectedParticipantId(null);
                  } else {
                    setSelectedParticipantId(p.id);
                  }
                }}
              >
                <div className="flex items-start sm:items-center gap-3 w-full sm:w-auto">
                  <div className={cn(
                    "w-12 h-12 sm:w-10 sm:h-10 rounded-2xl sm:rounded-full flex items-center justify-center font-black text-white shrink-0 shadow-inner",
                    p.paymentType === 'Inteira' ? "bg-indigo-600" : p.paymentType === 'Meia' ? "bg-blue-500" : "bg-teal-500"
                  )}>
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={cn("font-bold text-base sm:text-sm leading-tight mb-0.5 truncate", getParticipantOverdue(p.id) ? "text-red-400" : "text-slate-100")}>{p.name}</h4>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest shrink-0">RG: {p.rg}</p>
                      {p.phone && (
                        <div className="flex items-center gap-1.5">
                          <a 
                            href={`https://wa.me/55${p.phone.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center justify-center text-green-500 hover:text-green-400 transition-colors bg-green-500/10 p-1 rounded border border-green-500/20"
                            title="Contato WhatsApp"
                          >
                            <Phone size={12} className="text-emerald-500" />
                          </a>
                          <div className="flex items-center bg-slate-800/50 rounded p-0.5 gap-1 border border-slate-700/50">
                            <button
                              onClick={(e) => { e.stopPropagation(); sendWhatsAppReceipt(p, installmentsMap[p.id] || []); }}
                              className="text-[10px] text-amber-400 font-black hover:text-amber-300 transition-colors uppercase px-1.5"
                              title="Enviar Recibo via WhatsApp"
                            >
                              Recibo
                            </button>
                            <div className="w-[1px] h-3 bg-slate-700" />
                            <button
                              onClick={(e) => { e.stopPropagation(); generatePDFReceipt(p, installmentsMap[p.id] || []); }}
                              className="text-[10px] text-indigo-400 font-black hover:text-indigo-300 transition-colors uppercase px-1.5"
                              title="Baixar Recibo PDF"
                            >
                              PDF
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {getParticipantOverdue(p.id) && (() => {
                      const overdue = getParticipantOverdueDetails(p.id);
                      if (!overdue) return null;
                      return (
                        <div className="mt-1.5 flex items-center gap-2 text-[9px] text-red-400 bg-red-500/10 px-2 py-1 rounded-lg w-fit border border-red-500/20 shadow-sm font-bold">
                          <span className="uppercase">{overdue.daysOverdue} dias em atraso</span>
                          <span className="opacity-30">|</span>
                          <span>{formatDate(overdue.dueDate)}</span>
                        </div>
                      );
                    })()}
                    {p.observation && (
                      <p className="text-[10px] text-amber-500/80 mt-1.5 italic flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-lg w-fit border border-amber-500/20 max-w-full truncate">📝 {p.observation}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-1 rounded-lg font-black uppercase tracking-wider border border-slate-700/50">
                        {p.ageAtCamp} anos
                      </span>
                      <span className={cn(
                        "text-[9px] px-2 py-1 rounded-lg font-black uppercase tracking-wider border",
                        p.paymentType === 'Inteira' ? "bg-indigo-950/50 text-indigo-400 border-indigo-900/30" : "bg-blue-950/50 text-blue-400 border-blue-900/30"
                      )}>
                        {p.paymentType}
                      </span>
                      <span className={cn(
                        "text-[9px] px-2 py-1 rounded-lg font-black uppercase tracking-wider border",
                        p.transport === 'Carro' ? "bg-emerald-950/50 text-emerald-400 border-emerald-900/30" : "bg-amber-950/50 text-amber-400 border-amber-900/30"
                      )}>
                        {p.transport}
                      </span>
                      {p.dependents && p.dependents.length > 0 && (
                        <span className="text-[9px] bg-purple-900/30 text-purple-300 px-2 py-1 rounded-lg font-black uppercase tracking-wider border border-purple-900/20 flex items-center gap-1">
                          <Users size={10} /> +{p.dependents.length}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-0 border-slate-800/50 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {getParticipantOverdue(p.id) && (
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                      )}
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ring-1 ring-inset",
                        p.isPaid || (!p.totalValue || p.totalValue === 0)
                          ? "bg-green-500/10 text-green-400 ring-green-500/20" 
                          : getParticipantOverdue(p.id)
                            ? "bg-red-500/10 text-red-500 ring-red-500/20"
                            : "bg-blue-500/10 text-blue-400 ring-blue-500/20"
                      )}>
                        {(!p.totalValue || p.totalValue === 0) ? 'Isento' : p.isPaid ? 'Pago' : getParticipantOverdue(p.id) ? 'Atrasado' : 'Em Dia'}
                      </span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleEditParticipant(p); }}
                      className="p-2 text-slate-500 hover:text-indigo-400 transition-colors bg-slate-800/50 rounded-lg border border-slate-700/50"
                      title="Editar Acamper"
                    >
                      <Edit3 size={16} />
                    </button>
                    <ChevronRight size={18} className={cn("text-slate-600 transition-transform hidden sm:block", selectedParticipantId === p.id && "rotate-90")} />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedParticipantId(selectedParticipantId === p.id ? null : p.id); }}
                      className="sm:hidden text-indigo-400 font-bold text-xs uppercase underline underline-offset-4"
                    >
                      {selectedParticipantId === p.id ? 'Fechar' : 'Detalhes'}
                    </button>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setDeleteParticipantModal({id: p.id, name: p.name}); }}
                    className="text-slate-600 hover:text-red-500 p-2 transition-colors bg-slate-800/50 sm:bg-transparent rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {selectedParticipantId === p.id && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-800 bg-slate-900/50"
                  >
                    <div className="p-4 space-y-6">
                      {/* Financial Status Summary */}
                      <div className="flex justify-between items-center">
                        <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <CreditCard size={12} /> Resumo Financeiro
                        </h5>
                        <div className="flex gap-2">
                          {p.phone && (
                            <a 
                              href={`https://wa.me/55${p.phone.replace(/\D/g, '')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-green-500 bg-green-500/10 p-2 rounded-lg border border-green-500/20 flex items-center justify-center hover:bg-green-500/20 transition-all"
                              title="Mensagem WhatsApp"
                            >
                              <Phone size={14} className="text-emerald-500" />
                            </a>
                          )}
                          <button
                            onClick={() => sendWhatsAppReceipt(p, installmentsMap[p.id] || [])}
                            className="text-[10px] font-black text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 flex items-center gap-1 hover:bg-amber-500/20 transition-all"
                          >
                            <Receipt size={12} /> Recibo
                          </button>
                          <button
                            onClick={() => generatePDFReceipt(p, installmentsMap[p.id] || [])}
                            className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20 flex items-center gap-1 hover:bg-indigo-500/20 transition-all"
                          >
                            <FileText size={12} /> Recibo PDF
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 shadow-inner">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Total Família</p>
                          <p className="text-sm font-black text-slate-100">{formatCurrency(p.totalValue || 0)}</p>
                        </div>
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 shadow-inner">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Pago</p>
                          <p className="text-sm font-black text-emerald-400">
                            {formatCurrency(installmentsMap[p.id]?.reduce((acc, i) => acc + (i.paidAmount || 0), 0) || 0)}
                          </p>
                        </div>
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 shadow-inner">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Restante</p>
                          <p className="text-sm font-black text-blue-400">
                            {formatCurrency(Math.max((p.totalValue || 0) - (installmentsMap[p.id]?.reduce((acc, i) => acc + (i.paidAmount || 0), 0) || 0), 0))}
                          </p>
                        </div>
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 shadow-inner">
                          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Parcelas</p>
                          <p className="text-sm font-black text-indigo-400">{p.installments}x de {formatCurrency((p.totalValue || 0) / (p.installments || 1))}</p>
                        </div>
                      </div>

                      {/* Dependents list if any */}
                      {p.dependents && p.dependents.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Users size={12} /> Dependentes
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {p.dependents.map(dep => (
                              <div key={dep.id} className="bg-slate-800/30 p-2 rounded-xl border border-slate-800 flex justify-between items-center">
                                <div>
                                  <p className="text-xs font-bold text-slate-200">{dep.name}</p>
                                  <p className="text-[10px] text-slate-500">{dep.relationship} • {dep.ageAtCamp} anos</p>
                                </div>
                                <span className="text-[9px] bg-slate-900/50 px-2 py-1 rounded-lg text-slate-400 font-bold border border-slate-800">
                                  {dep.paymentType}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Installments Table/List */}
                      <div className="space-y-3">
                        <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Receipt size={12} /> Fluxo de Pagamentos
                        </h5>
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1 no-scrollbar sm:custom-scrollbar">
                          {installmentsMap[p.id]?.map((inst) => {
                            const status = getInstallmentStatus(inst);
                            return (
                              <div key={inst.id} className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:border-slate-700 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500 group-hover:bg-slate-700 transition-colors">
                                    {inst.month.split('-')[1]}/{inst.month.split('-')[0].substring(2)}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs font-black text-slate-100">{formatCurrency(inst.amount)}</p>
                                      <span className={cn("text-[9px] px-2 py-0.5 rounded-md font-bold border", status.class)}>
                                        {status.label}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-bold">Vence em {formatDate(inst.dueDate)}</p>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-slate-800/50">
                                  <div className="flex-1 sm:flex-none">
                                    <p className="text-[9px] text-slate-500 font-bold uppercase leading-none mb-1">Pago</p>
                                    <p className={cn("text-xs font-black", (inst.paidAmount || 0) >= inst.amount ? "text-emerald-400" : (inst.paidAmount || 0) > 0 ? "text-blue-400" : "text-slate-600")}>
                                      {formatCurrency(inst.paidAmount || 0)}
                                    </p>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={() => openPartialPayment(p.id, inst)}
                                      className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:text-indigo-400 transition-colors"
                                      title="Pagamento Parcial"
                                    >
                                      <Receipt size={16} />
                                    </button>
                                    <button 
                                      onClick={() => openUpdateObservation(inst.id, inst.observation || '')}
                                      className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        inst.observation ? "bg-amber-500/10 text-amber-500" : "bg-slate-800 text-slate-400 hover:text-amber-500"
                                      )}
                                      title="Observação"
                                    >
                                      <Edit3 size={16} />
                                    </button>
                                    <button 
                                      onClick={() => toggleInstallment(p.id, inst.id, inst.isPaid, inst.amount)}
                                      className={cn(
                                        "p-2 rounded-lg transition-all active:scale-90",
                                        inst.isPaid ? "bg-green-500/10 text-green-500" : "bg-slate-800 text-slate-500 hover:text-green-500"
                                      )}
                                      title={inst.isPaid ? "Marcar como não pago" : "Marcar como pago"}
                                    >
                                      <CheckCircle2 size={16} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
      
      {/* Modals */}
      <AnimatePresence>
        {obsModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl"
            >
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-4">
                <Edit3 size={16} className="text-amber-500" /> Editar Observação
              </h3>
              <textarea
                rows={3}
                placeholder="Ex: Renegociação, justificativa de atraso..."
                value={obsModal.text}
                onChange={e => setObsModal(prev => ({ ...prev, text: e.target.value }))}
                className="w-full p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-medium text-sm resize-none mb-4 focus:border-amber-500/50"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setObsModal({ isOpen: false, instId: '', text: '' })}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-300 hover:bg-slate-800 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitUpdateObservation}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-amber-950 hover:bg-amber-400 transition-all"
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {paymentModal.isOpen && paymentModal.inst && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl"
            >
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-4">
                <Receipt size={16} className="text-indigo-500" /> Registrar Pagamento
              </h3>
              <div className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl mb-4 space-y-1">
                <p className="text-xs text-slate-400 font-bold">Valor da Parcela: <span className="text-slate-200">{formatCurrency(paymentModal.inst.amount)}</span></p>
                <p className="text-xs text-slate-400 font-bold">Valor já pago: <span className="text-green-400">{formatCurrency(paymentModal.inst.paidAmount || 0)}</span></p>
              </div>
              <div className="space-y-1 mb-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Novo valor TOTAL pago</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">R$</span>
                  <input
                    type="text"
                    value={paymentModal.amount}
                    onChange={e => setPaymentModal(prev => ({ ...prev, amount: e.target.value.replace(/[^0-9.,]/g, '') }))}
                    className="w-full pl-9 p-3 bg-slate-800 border border-slate-700 rounded-xl outline-none text-slate-100 font-bold text-sm focus:border-indigo-500/50"
                  />
                </div>
                {paymentModal.error && (
                  <p className="text-xs text-red-500 mt-1 ml-1">{paymentModal.error}</p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setPaymentModal({ isOpen: false, participantId: '', inst: null, amount: '' })}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-300 hover:bg-slate-800 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitPartialPayment}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-500 text-indigo-50 hover:bg-indigo-400 transition-all"
                >
                  Salvar Pagamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!deleteDependentModal}
        message={`Você deseja remover o dependente ${deleteDependentModal?.name || 'sem nome'}?`}
        onConfirm={() => {
          if (deleteDependentModal) removeDependent(deleteDependentModal.id);
        }}
        onCancel={() => setDeleteDependentModal(null)}
      />

      <ConfirmModal
        isOpen={!!deleteParticipantModal}
        message={`Você realmente quer excluir o registro de ${deleteParticipantModal?.name}? Esta ação não pode ser desfeita e excluirá também todas as parcelas associadas.`}
        onConfirm={() => {
          if (deleteParticipantModal) deleteParticipant(deleteParticipantModal.id);
        }}
        onCancel={() => setDeleteParticipantModal(null)}
      />
    </div>
  );
};

export default Participantes;
