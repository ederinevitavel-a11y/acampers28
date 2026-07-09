import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Trash2, User, CreditCard, Search, 
  Calendar as CalendarIcon, IdCard, CheckCircle2, 
  XCircle, ChevronRight, Bell, Receipt, 
  Edit3, Users, FileSpreadsheet, FileText, FileSignature, FileStack,
  Phone, AlertCircle, Info, Filter,
  ArrowUpRight, Download, MoreHorizontal,
  Target, Rocket, Car, Clock, MessageSquare, QrCode
} from 'lucide-react';
import { Participant, Installment, Dependent } from '../types';
import { cn, formatDate, formatCurrency, maskPhone, maskRG } from '../lib/utils';
import { MEMBERS_LIST } from '../data/members';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc, writeBatch, where, getDocs } from 'firebase/firestore';
import { useConsolidatedData } from '../hooks/useConsolidatedData';
import { ConfirmModal } from './ConfirmModal';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

const CAMP_DATE = new Date('2028-01-29T00:00:00'); // Novo Acampa 28 date

const getMaxInstallments = () => {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1; // 1-12
  
  // Deadline: Dec 2027
  const targetYear = 2027;
  const targetMonth = 12;
  
  // Total months available from CURRENT month
  const totalMonths = ((targetYear - currentYear) * 12) + (targetMonth - currentMonth) + 1;
  return Math.max(1, totalMonths);
};

const Participantes: React.FC = () => {
  const { participants: allParticipants, installments: allInstallments, loading, error } = useConsolidatedData();
  const [installmentsMap, setInstallmentsMap] = useState<Record<string, Installment[]>>({});
  const [showForm, setShowForm] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [showPixModal, setShowPixModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [logoBgColor, setLogoBgColor] = useState<[number, number, number]>([15, 23, 42]);
  const [pixQrBase64, setPixQrBase64] = useState<string | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        setLogoBase64(canvas.toDataURL('image/jpeg'));
        
        try {
          const pixel = ctx.getImageData(5, 5, 1, 1).data;
          setLogoBgColor([pixel[0], pixel[1], pixel[2]]);
        } catch (e) {
          console.warn("Could not extract background color from logo", e);
        }
      }
    };
    img.src = 'https://i.imgur.com/yqEPRBk.jpeg';

    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    qrImg.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = qrImg.width;
      canvas.height = qrImg.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(qrImg, 0, 0);
        setPixQrBase64(canvas.toDataURL('image/png'));
      }
    };
    qrImg.src = 'https://i.imgur.com/C3ItOnH.png';
  }, []);
  const [paymentModal, setPaymentModal] = useState<{isOpen: boolean, participantId: string, inst: Installment | null, amount: string, error?: string}>({isOpen: false, participantId: '', inst: null, amount: ''});
  const [obsModal, setObsModal] = useState<{isOpen: boolean, instId: string, text: string}>({isOpen: false, instId: '', text: ''});
  const [deleteParticipantModal, setDeleteParticipantModal] = useState<{id: string, name: string} | null>(null);
  const [deleteDependentModal, setDeleteDependentModal] = useState<{id: string, name: string} | null>(null);
  const [confirmStatusModal, setConfirmStatusModal] = useState<{
    participantId: string,
    installmentId: string,
    currentPaid: boolean,
    amount: number,
    month: string,
    participantName: string
  } | null>(null);
  
  const [copiedPix, setCopiedPix] = useState(false);
  
  const handleCopyPix = () => {
    navigator.clipboard.writeText("00020101021126470014BR.GOV.BCB.PIX0125acampacentral@hotmail.com5204000053039865802BR5925IGREJA BATISTA CENTRAL NO6009SAO PAULO62080504daqr6304B4D0");
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  };
  
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
    birthDate: '1990-01-01',
    transport: 'Carro' as 'Carro' | 'Ônibus',
    installments: getMaxInstallments(),
    dueDay: 10,
    observation: '',
    isPaid: false,
    dependents: [] as Dependent[]
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const overdueList = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return allParticipants
      .filter(p => {
        if (p.isPaid || p.totalValue === 0) return false;
        return allInstallments.some(inst => 
          inst.participantId === p.id && 
          !inst.isPaid && 
          new Date(inst.dueDate + 'T12:00:00') < today
        );
      })
      .map(p => {
        const pInstallments = allInstallments.filter(inst => inst.participantId === p.id && !inst.isPaid);
        const overdueInsts = pInstallments.filter(inst => new Date(inst.dueDate + 'T12:00:00') < today);
        const totalOverdue = overdueInsts.reduce((sum, inst) => sum + (inst.amount - (inst.paidAmount || 0)), 0);
        
        const sortedOverdue = [...overdueInsts].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        const oldestOverdue = sortedOverdue[0];

        return {
          id: p.id,
          name: p.name,
          phone: p.phone,
          totalOverdue,
          dueDate: oldestOverdue ? oldestOverdue.dueDate : '',
          month: oldestOverdue ? oldestOverdue.month : ''
        };
      })
      .sort((a, b) => b.totalOverdue - a.totalOverdue);
  }, [allParticipants, allInstallments]);

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
      return type === 'Inteira' ? 792 : 396;
    } else {
      return type === 'Inteira' ? 648 : 324;
    }
  };

  const handleAddDependent = () => {
    setFormData(prev => ({
      ...prev,
      dependents: [
        ...prev.dependents,
        { id: Math.random().toString(36).substring(7), name: '', rg: '', birthDate: '', relationship: 'Cônjuge', ageAtCamp: 0, paymentType: 'Inteira' }
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
            let currentMonth = new Date().getMonth() + 1; // Start current month (July onwards)
            
            const userEmail = auth.currentUser?.email || 'N/A';
            const now = new Date().toISOString();
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
                paidByEmail: formData.isPaid ? userEmail : null,
                paidAt: formData.isPaid ? now : null,
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
          let currentMonth = new Date().getMonth() + 1; // Start current month (July onwards)
          
          const userEmail = auth.currentUser?.email || 'N/A';
          const now = new Date().toISOString();
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
              paidByEmail: formData.isPaid ? userEmail : null,
              paidAt: formData.isPaid ? now : null,
              timestamp: Date.now()
            });
            
            currentMonth++;
          }
          await batch.commit();
        }
      }
      
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', rg: '', phone: '', birthDate: '1990-01-01', transport: 'Carro', installments: 1, dueDay: 10, observation: '', isPaid: false, dependents: [] });
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'participants');
    }
  };

  const toggleInstallment = async (participantId: string, installmentId: string, currentPaid: boolean, amount: number) => {
    try {
      const nextPaid = !currentPaid;
      const userEmail = auth.currentUser?.email || 'N/A';
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'installments', installmentId), { 
        isPaid: nextPaid,
        paidAmount: nextPaid ? amount : 0,
        paidByEmail: nextPaid ? userEmail : null,
        paidAt: nextPaid ? now : null
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
      const userEmail = auth.currentUser?.email || 'N/A';
      const now = new Date().toISOString();
      await updateDoc(doc(db, 'installments', paymentModal.inst.id), { 
        paidAmount: newPaidAmount,
        isPaid: isPaid,
        paidByEmail: newPaidAmount > 0 ? userEmail : null,
        paidAt: newPaidAmount > 0 ? now : null
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
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const paidInstallments = installments.filter(i => i.isPaid);
    const totalPaid = paidInstallments.reduce((acc, i) => acc + (i.paidAmount || 0), 0);
    const userEmail = auth.currentUser?.email || 'N/A';
    
    // Header
    doc.setFillColor(79, 70, 229); // Indigo 600
    doc.rect(0, 0, 210, 45, 'F');
    
    if (logoBase64) {
      doc.addImage(logoBase64, 'JPEG', 14, 5, 35, 35);
    }
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('ACAMPA 2028', 115, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text('COMPROVANTE DE PAGAMENTO', 115, 32, { align: 'center' });
    
    // Participant Info
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Dados do Acamper:', 14, 65);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nome: ${p.name}`, 14, 72);
    doc.text(`RG / RN: ${p.rg || 'Não informado'}`, 14, 79);
    doc.text(`Telefone: ${p.phone || 'Não informado'}`, 14, 86);
    
    // Summary
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo Financeiro:', 14, 100);
    doc.setFont('helvetica', 'normal');
    
    autoTable(doc, {
      startY: 105,
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
      doc.setTextColor(30, 41, 59);
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
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] }, // Emerald 500
        margin: { left: 14, right: 14 }
      });
    } else {
      doc.setFont('helvetica', 'italic');
      doc.text('Nenhum pagamento registrado até o momento.', 14, (doc as any).lastAutoTable.finalY + 15);
    }
    
    // Footer
    const finalY = pageHeight - 20;
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text(`Recibo gerado por: ${userEmail}`, 14, finalY);
    doc.text(`Data de emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 14, finalY + 6);
    
    doc.save(`Recibo_${p.name.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
  };

  const generatePaymentBooklet = async (p: Participant, installments: Installment[]) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Filter only unpaid installments and sort by date
    const openInstallments = installments.filter(i => !i.isPaid);
    
    if (openInstallments.length === 0) return;

    const sortedInstallments = [...openInstallments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    
    // Original total count for correct labeling (e.g. 3/10)
    const totalInstallmentsCount = installments.length;
    
    let qrCodeDataUrl = pixQrBase64 || '';
    if (!qrCodeDataUrl) {
      try {
        qrCodeDataUrl = await QRCode.toDataURL('00020101021126470014BR.GOV.BCB.PIX0125acampacentral@hotmail.com5204000053039865802BR5925IGREJA BATISTA CENTRAL NO6009SAO PAULO62080504daqr6304B4D0', { margin: 1, errorCorrectionLevel: 'M' });
      } catch (err) {
        console.error('Error generating QR Code', err);
      }
    }

    let currentY = 10;
    const stubHeight = 65; // Height for each stub
    const padding = 10;

    sortedInstallments.forEach((inst) => {
      // Find original index for display purposes (1-indexed)
      const originalIndex = installments.findIndex(i => i.id === inst.id) + 1;

      // Check if we need a new page
      if (currentY + stubHeight > pageHeight - 10) {
        doc.addPage();
        currentY = 10;
      }

      // Draw Stub Box
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.rect(padding, currentY, pageWidth - (padding * 2), stubHeight);
      
      // Dashed line for cutting
      (doc as any).setLineDash([2, 2], 0);
      doc.line(0, currentY + stubHeight + 2, pageWidth, currentY + stubHeight + 2);
      (doc as any).setLineDash([], 0);

      if (logoBase64) {
        doc.addImage(logoBase64, 'JPEG', padding + 10, currentY + 5, 18, 18);
      }

      // Title & Installment Info
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('ACAMPA CENTRAL 2028 - CARNÊ', padding + 30, currentY + 12);
      
      doc.setFontSize(11);
      doc.setTextColor(37, 99, 235);
      doc.text(`Parcela ${originalIndex}/${totalInstallmentsCount}`, pageWidth - padding - 10, currentY + 10, { align: 'right' });

      // Participant Details
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('ACAMPER:', padding + 10, currentY + 28);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(p.name.toUpperCase(), padding + 10, currentY + 33);

      // Financial Details
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'normal');
      doc.text('VENCIMENTO:', padding + 10, currentY + 43);
      doc.text('VALOR DA PARCELA:', padding + 60, currentY + 43);
      
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(formatDate(inst.dueDate), padding + 10, currentY + 48);
      doc.text(formatCurrency((p.totalValue || 0) / (p.installments || 1)), padding + 60, currentY + 48);

      // PIX Info
      doc.setFillColor(241, 245, 249);
      doc.rect(padding + 105, currentY + 15, 80, 30, 'F');
      
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text('PAGAMENTO VIA PIX:', padding + 108, currentY + 20.5);
      
      doc.setTextColor(37, 99, 235);
      doc.setFontSize(7);
      doc.text('acampacentral@hotmail.com', padding + 108, currentY + 25);
      
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(5.5);
      doc.text('Igreja Batista Central Itaim', padding + 108, currentY + 29.5);

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Escaneie o QR Code ao lado ou', padding + 108, currentY + 35);
      doc.text('use a chave email acima.', padding + 108, currentY + 39);

      if (qrCodeDataUrl) {
        // Draw white background card for QR Code
        doc.setFillColor(255, 255, 255);
        doc.rect(padding + 157, currentY + 17, 26, 26, 'F');
        doc.addImage(qrCodeDataUrl, 'PNG', padding + 158, currentY + 18, 24, 24);
      }

      // Footer of Stub
      doc.setDrawColor(226, 232, 240);
      doc.line(padding + 10, currentY + 54, pageWidth - padding - 10, currentY + 54);
      
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'italic');
      doc.text('Controle de pagamento. Confira os dados antes de confirmar o pagamento.', padding + 10, currentY + 59);
      
      doc.text('Autenticação Mecânica / Assinatura do Responsável', pageWidth - padding - 10, currentY + 59, { align: 'right' });

      currentY += stubHeight + 8;
    });

    doc.save(`Carne_Acampa_${p.name.replace(/\s+/g, '_')}.pdf`);
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

  const filteredParticipants = allParticipants.filter(p => {
    const searchLower = searchTerm.toLowerCase().trim();
    if (!searchLower) return true;

    const matchTitularName = p.name.toLowerCase().includes(searchLower);
    const matchTitularRG = p.rg && p.rg.toLowerCase().includes(searchLower);
    const matchTitularPhone = p.phone && p.phone.toLowerCase().replace(/\D/g, '').includes(searchLower.replace(/\D/g, ''));
    
    const matchDependents = p.dependents && p.dependents.some(dep => 
      dep.name.toLowerCase().includes(searchLower) || 
      (dep.rg && dep.rg.toLowerCase().includes(searchLower))
    );

    return matchTitularName || matchTitularRG || matchTitularPhone || matchDependents;
  });

  const handleExportExcel = () => {
    const data = [];
    allParticipants.forEach(p => {
      const status = (!p.totalValue || p.totalValue === 0) ? 'Isento' : p.isPaid ? 'Liquidado' : getParticipantOverdue(p.id) ? 'Em Atraso' : 'Em Dia';
      
      // Add Titular
      data.push({
        'Tipo': 'Titular',
        'Nome': p.name,
        'RG / RN': p.rg,
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
            'RG / RN': dep.rg || '',
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
    
    if (logoBase64) {
      doc.addImage(logoBase64, 'JPEG', 14, 5, 25, 25);
    }

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(18);
    doc.text(title, 42, 15);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 42, 22);

    const tableData: any[][] = [];
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
      head: [['Tipo', 'Nome', 'RG / RN', 'Nascimento', 'Idade', 'Categoria', 'Transporte', 'Status']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
    });

    doc.save(`Lista_Acampers_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`);
  };

  const handlePrintContract = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    if (logoBase64) {
      doc.addImage(logoBase64, 'JPEG', 14, 10, 25, 25);
    }

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    
    // Position title to the right of the logo to avoid overlap
    doc.text("CONTRATO DE CONDIÇÕES GERAIS", 45, 20);
    doc.text("ACAMPA CENTRAL 2028", 45, 27);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    
    doc.text("Organização: Igreja Batista Central – Itaim Paulista", 45, 35);
    doc.text("Evento: Acampa Central 2028", 45, 41);

    const extraInfo = [
      "Datas: 29 e 30 de janeiro de 2028",
      "Saída: 28 de janeiro de 2028, às 19h, da Igreja Batista Central – Itaim Paulista"
    ];
    
    let currentY = 50;
    extraInfo.forEach((text, i) => {
      doc.text(text, 20, currentY);
      currentY += 6;
    });

    // Cláusulas
    let y = currentY + 10;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Cláusulas", 20, y);
    y += 10;

    const clauses = [
      { t: "1. Adesão e Concordância", c: "A inscrição no Acampa Central 2028 implica plena concordância com todas as condições estabelecidas neste contrato. O(a) participante declara estar ciente e de acordo com as regras aqui descritas." },
      { t: "2. Pagamento e Cancelamento", c: "- O valor da inscrição será informado no momento da inscrição e deverá ser pago em dia até a data limite acordada entre o(a) participante e a organização.\n- Devido a compromissos assumidos com o estabelecimento, em caso de desistência não haverá devolução de valores pagos, independentemente do motivo.\n- A inscrição é pessoal e intransferível.\n- Em caso específico de mudança ou substituição do(a) acampante, é obrigação do responsável comunicar previamente a organização do Acampa Central 2028." },
      { t: "3. Regras de Conduta Cristã", c: "O(a) participante compromete-se a:\n- Respeitar os princípios cristãos de convivência, amor ao próximo e respeito mútuo.\n- Participar das atividades espirituais e recreativas com espírito de cooperação.\n- Abster-se de portar bebidas alcoólicas, cigarros ou qualquer substância ilícita.\n- Manter comportamento condizente com os valores da fé cristã, respeitando o próximo em amor." },
      { t: "4. Responsabilidade da Organização", c: "- A organização não se responsabiliza por objetos pessoais perdidos ou danificados.\n- Em caso de comportamento inadequado ou contrário às regras, o(a) participante poderá ser desligado do acampamento sem direito a reembolso." },
      { t: "5. Responsabilidade dos Pais ou Responsáveis Legais", c: "- Os pais ou responsáveis legais são integralmente responsáveis pelos menores de idade inscritos no Acampa Central 2028.\n- É dever dos responsáveis garantir que os menores cumpram todas as regras estabelecidas neste contrato.\n- Qualquer ocorrência envolvendo menores será tratada diretamente com os pais ou responsáveis legais." },
      { t: "6. Segurança e Saúde", c: "- O(a) participante deve informar previamente qualquer condição médica relevante.\n- É obrigatório seguir as orientações da equipe responsável quanto à segurança e uso das instalações." },
      { t: "7. Autorização de Imagem", c: "O(a) participante autoriza o uso de sua imagem em fotos e vídeos para fins de divulgação institucional da Igreja Batista Central, sem ônus para a organização." },
      { t: "8. Disposições Finais", c: "Este contrato entra em vigor na data da inscrição e é regido pelas leis brasileiras.\nCasos omissos serão resolvidos pela liderança da Igreja Batista Central.\nA inscrição significa concordância integral com todas as cláusulas aqui descritas." }
    ];

    clauses.forEach(clause => {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(clause.t, 20, y);
      y += 6;
      
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(clause.c, pageWidth - 40);
      lines.forEach(line => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(line, 20, y);
        y += 5;
      });
      y += 5;
    });

    doc.save(`Contrato_Geral_Acampa_2028.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black p-4 text-center">
        <div className="w-16 h-16 bg-red-950 text-red-400 rounded-full flex items-center justify-center mb-6">
          <AlertCircle size={32} />
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

  return (
    <div className="space-y-6 sm:space-y-8 pb-32 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Intelligence Header */}
      <header className="py-4 sm:py-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
        <div className="w-full">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/20 shrink-0">
              <Users className="text-white" size={24} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tighter uppercase">Acampers</h1>
          </div>
          <p className="text-[10px] sm:text-sm font-bold text-slate-400 ml-1 uppercase tracking-widest">Base de Dados</p>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-2xl border border-slate-800 backdrop-blur-md flex-1 sm:flex-none justify-center">
            <button 
              onClick={handleExportExcel}
              className="p-2.5 sm:p-3 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all"
              title="Exportar Excel"
            >
              <FileSpreadsheet size={18} />
            </button>
            <button 
              onClick={handleExportPDF}
              className="p-2.5 sm:p-3 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
              title="Exportar PDF"
            >
              <FileText size={18} />
            </button>
            <button 
              onClick={handlePrintContract}
              className="p-2.5 sm:p-3 text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all"
              title="Contrato de Condições"
            >
              <FileSignature size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Intelligence Search & Filters */}
      <div className="py-3 bg-black md:bg-transparent -mx-4 px-4 md:mx-0 md:px-0">
        <div className="relative group w-full lg:max-w-2xl">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Pesquisar por nome, RG, telefone ou dependente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-white pl-11 pr-12 py-3.5 sm:py-4 rounded-2xl md:rounded-[24px] focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-600 font-bold text-sm sm:text-base"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-red-400 transition-colors"
              title="Limpar pesquisa"
            >
              <XCircle size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <Info size={18} className="text-indigo-400" />
            Lista de Titulares
          </h2>
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-6 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="w-full max-w-4xl bg-slate-900 md:rounded-[40px] rounded-t-[40px] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Form Header */}
              <div className="p-4 sm:p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/20">
                    {editingId ? <Edit3 className="text-white" size={20} /> : <Plus className="text-white" size={20} />}
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter">
                      {editingId ? 'Editar' : 'Novo Acamper'}
                    </h2>
                    <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mt-0.5">Preencha os dados com atenção</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="p-2 sm:p-3 bg-slate-800 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 rounded-xl sm:rounded-2xl transition-all"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-8 sm:space-y-10">
                <form onSubmit={handleAddParticipant} id="participant-form">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10">
                    {/* Primary Info */}
                    <div className="space-y-6 sm:space-y-8">
                      <div className="space-y-5 sm:space-y-6">
                        <div className="flex items-center gap-2 mb-2 sm:mb-4">
                          <User size={14} className="text-indigo-400" />
                          <h3 className="text-[10px] sm:text-xs font-black text-white uppercase tracking-widest">Informações do Titular</h3>
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                          <input 
                            type="text" 
                            required
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            list="members-list"
                            className="w-full bg-slate-800 border border-slate-700 text-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all font-bold placeholder:text-slate-600 text-sm"
                            placeholder="Nome Completo"
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

                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">RG ou RN (Reg. Nacional)</label>
                            <input 
                              type="text" 
                              value={formData.rg}
                              onChange={e => setFormData({...formData, rg: maskRG(e.target.value)})}
                              className="w-full bg-slate-800 border border-slate-700 text-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl outline-none font-bold placeholder:text-slate-600 text-sm"
                              placeholder="RG ou Registro Nacional"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">WhatsApp</label>
                            <input 
                              type="text" 
                              value={formData.phone}
                              onChange={e => setFormData({...formData, phone: maskPhone(e.target.value)})}
                              className="w-full bg-slate-800 border border-slate-700 text-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl outline-none font-bold placeholder:text-slate-600 text-sm"
                              placeholder="(00) 00000-0000"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nascimento</label>
                            <input 
                              type="date" 
                              required
                              value={formData.birthDate}
                              onChange={e => setFormData({...formData, birthDate: e.target.value})}
                              className="w-full bg-slate-800 border border-slate-700 text-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl outline-none font-bold appearance-none text-sm"
                            />
                            {formData.birthDate && (
                              <div className="flex items-center gap-1.5 mt-1 ml-1">
                                <div className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  getPaymentType(calculateAgeAtCamp(formData.birthDate)) === 'Inteira' ? "bg-indigo-400" : "bg-emerald-400"
                                )} />
                                <span className={cn(
                                  "text-[8px] font-black uppercase tracking-wider",
                                  getPaymentType(calculateAgeAtCamp(formData.birthDate)) === 'Inteira' ? "text-indigo-400" : "text-emerald-400"
                                )}>
                                  Categoria {getPaymentType(calculateAgeAtCamp(formData.birthDate))}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Transporte</label>
                            <div className="flex bg-slate-800 p-1 rounded-xl sm:rounded-2xl border border-slate-700">
                              {['Carro', 'Ônibus'].map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setFormData({...formData, transport: t as any})}
                                  className={cn(
                                    "flex-1 py-2 sm:py-3 px-2 sm:px-4 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black uppercase transition-all",
                                    formData.transport === t ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
                                  )}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-5 sm:space-y-6 pt-2 sm:pt-4">
                         <div className="flex items-center justify-between mb-2 sm:mb-4">
                            <div className="flex items-center gap-2">
                              <Users size={14} className="text-purple-400" />
                              <h3 className="text-[10px] sm:text-xs font-black text-white uppercase tracking-widest">Dependentes</h3>
                            </div>
                            <button 
                              type="button"
                              onClick={handleAddDependent}
                              className="text-[8px] sm:text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20 transition-all uppercase tracking-widest"
                            >
                              + Adicionar
                            </button>
                         </div>
                         
                         <div className="space-y-3 sm:space-y-4">
                           {formData.dependents.map((dep) => (
                             <div key={dep.id} className="bg-black/20 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-800 relative group/dep">
                               <button 
                                 type="button"
                                 onClick={() => setDeleteDependentModal({id: dep.id, name: dep.name})}
                                 className="absolute -top-1.5 -right-1.5 p-1.5 bg-rose-500 text-white rounded-full shadow-lg sm:opacity-0 group-hover/dep:opacity-100 transition-all active:scale-90 z-10"
                                >
                                 <Trash2 size={10} />
                               </button>
                               <div className="space-y-3 sm:space-y-4">
                                 <input 
                                   type="text" 
                                   placeholder="Nome do Dependente"
                                   value={dep.name}
                                   onChange={e => updateDependent(dep.id, 'name', e.target.value)}
                                   className="w-full bg-slate-900/50 border border-slate-800 text-white p-2.5 sm:p-3 rounded-lg sm:rounded-xl outline-none font-bold text-xs"
                                 />
                                 <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                   <div className="flex flex-col gap-1">
                                     <input 
                                       type="date" 
                                       value={dep.birthDate}
                                       onChange={e => updateDependent(dep.id, 'birthDate', e.target.value)}
                                       className="bg-slate-900/50 border border-slate-800 text-white p-2.5 sm:p-3 rounded-lg sm:rounded-xl outline-none font-bold text-[10px]"
                                     />
                                     {dep.birthDate && (
                                       <span className={cn(
                                         "text-[8px] font-black uppercase ml-1",
                                         getPaymentType(calculateAgeAtCamp(dep.birthDate)) === 'Inteira' ? "text-indigo-400" : 
                                         getPaymentType(calculateAgeAtCamp(dep.birthDate)) === 'Meia' ? "text-emerald-400" : 
                                         "text-slate-500"
                                       )}>
                                         {getPaymentType(calculateAgeAtCamp(dep.birthDate))}
                                       </span>
                                     )}
                                   </div>
                                   <select 
                                     value={dep.relationship}
                                     onChange={e => updateDependent(dep.id, 'relationship', e.target.value)}
                                     className="bg-slate-900/50 border border-slate-800 text-slate-300 p-2.5 sm:p-3 rounded-lg sm:rounded-xl outline-none font-bold text-[10px]"
                                   >
                                     <option value="Cônjuge">Cônjuge</option>
                                     <option value="Filho(a)">Filho(a)</option>
                                     <option value="Pais">Pai / Mãe</option>
                                     <option value="Outro">Outro</option>
                                   </select>
                                 </div>
                                 <div className="space-y-1">
                                   <div className="flex justify-between items-center ml-1">
                                     <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                       RG ou RN (Reg. Nacional)
                                     </span>
                                     {formData.transport === 'Ônibus' && (
                                       <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest animate-pulse">
                                         * Obrigatório para Ônibus
                                       </span>
                                     )}
                                   </div>
                                   <input 
                                     type="text" 
                                     placeholder={formData.transport === 'Ônibus' ? "RG ou RN (Obrigatório)" : "RG ou Registro Nacional"}
                                     value={dep.rg || ''}
                                     onChange={e => updateDependent(dep.id, 'rg', maskRG(e.target.value))}
                                     required={formData.transport === 'Ônibus'}
                                     className="w-full bg-slate-900/50 border border-slate-800 text-white p-2.5 sm:p-3 rounded-lg sm:rounded-xl outline-none font-bold text-xs placeholder:text-slate-600"
                                   />
                                 </div>
                               </div>
                             </div>
                           ))}
                           {formData.dependents.length === 0 && (
                             <div className="p-6 sm:p-8 border border-dashed border-slate-800 rounded-2xl sm:rounded-3xl text-center">
                               <p className="text-[9px] sm:text-[10px] font-bold text-slate-600 uppercase tracking-widest">Sem dependentes</p>
                             </div>
                           )}
                         </div>
                      </div>
                    </div>

                    {/* Financial Plan */}
                    <div className="space-y-6 sm:space-y-8">
                      <div className="bg-slate-800/20 p-5 sm:p-8 rounded-3xl sm:rounded-[40px] border border-slate-800/50 space-y-6 sm:space-y-8">
                        <div className="flex items-center gap-2">
                          <CreditCard size={14} className="text-emerald-400" />
                          <h3 className="text-[10px] sm:text-xs font-black text-white uppercase tracking-widest">Planejamento Financeiro</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4 sm:gap-6">
                          <div className="space-y-1">
                            <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Parcelas</label>
                            <select 
                              value={formData.installments}
                              onChange={e => setFormData({...formData, installments: Number(e.target.value)})}
                              className="w-full bg-slate-900 border border-slate-800 text-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl outline-none font-black text-sm"
                            >
                              {[...Array(getMaxInstallments())].map((_, i) => (
                                <option key={i + 1} value={i + 1}>{i + 1}x</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Vencimento</label>
                            <select 
                              value={formData.dueDay}
                              onChange={e => setFormData({...formData, dueDay: Number(e.target.value)})}
                              className="w-full bg-slate-900 border border-slate-800 text-white p-3.5 sm:p-4 rounded-xl sm:rounded-2xl outline-none font-black text-sm"
                            >
                              {[1, 5, 10, 15, 20, 25, 30].map(day => (
                                <option key={day} value={day}>Dia {day}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="pt-5 sm:pt-6 border-t border-slate-800 space-y-4">
                           <div className="flex justify-between items-end">
                             <div>
                               <p className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5 leading-normal">Investimento Total</p>
                               <p className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
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
                               </p>
                             </div>
                             <div className="text-right">
                               <p className="text-[8px] sm:text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5 leading-normal">Parcela</p>
                               <p className="text-lg sm:text-xl font-black text-indigo-300 leading-tight">
                                 {formatCurrency(
                                   (getPaymentValue(
                                     formData.birthDate ? getPaymentType(calculateAgeAtCamp(formData.birthDate)) : 'Inteira',
                                     formData.transport
                                   ) + 
                                   formData.dependents.reduce((acc, dep) => acc + getPaymentValue(
                                     dep.birthDate ? getPaymentType(calculateAgeAtCamp(dep.birthDate)) : 'Isento',
                                     formData.transport
                                   ), 0)) / formData.installments
                                 )}
                               </p>
                             </div>
                           </div>
                        </div>
                      </div>

                      <div className="space-y-3 sm:space-y-4">
                        <label className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Observações</label>
                        <textarea 
                          placeholder="Notas sobre pagamento, restrições..."
                          value={formData.observation}
                          onChange={e => setFormData({...formData, observation: e.target.value})}
                          className="w-full bg-slate-800 border border-slate-700 text-white p-4 rounded-2xl sm:rounded-3xl outline-none font-bold text-xs sm:text-sm resize-none h-24 sm:h-32 focus:ring-2 focus:ring-indigo-500/50"
                        />
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              {/* Action Bar */}
              <div className="p-4 sm:p-8 bg-black/40 border-t border-slate-800 flex justify-end gap-3 sm:gap-4">
                 <button 
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 sm:flex-none px-4 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black text-slate-400 hover:text-white uppercase tracking-widest transition-all"
                 >
                   Descartar
                 </button>
                 <button 
                  type="submit"
                  form="participant-form"
                  className="flex-2 sm:flex-none px-6 sm:px-10 py-3 sm:py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl sm:rounded-2xl shadow-xl shadow-indigo-900/40 uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 text-[10px] sm:text-xs"
                 >
                   <CheckCircle2 size={16} />
                   <span>{editingId ? 'Salvar' : 'Concluir'}</span>
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Status Legend */}
      <div className="flex flex-wrap gap-4 mb-4 px-4 py-3 bg-slate-900/50 rounded-2xl border border-slate-800/50 w-full sm:w-fit backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]" />
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Pago</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.4)]" />
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Pendente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]" />
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Atrasado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Isento</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inteira</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Meia</span>
          </div>
        </div>
      </div>

      {/* Grid container to hold both List and Cobrança Rápida side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Participant List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 gap-4">
          {filteredParticipants.length === 0 ? (
            <div className="bg-slate-900/50 p-20 rounded-[32px] border border-dashed border-slate-800 text-center">
              <User className="mx-auto text-slate-800 mb-4" size={48} />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhum acamper encontrado</p>
            </div>
          ) : (
            filteredParticipants.map(p => {
              const isOverdue = getParticipantOverdue(p.id);
              const overdueInfo = getParticipantOverdueDetails(p.id);
              const isSelected = selectedParticipantId === p.id;
              
              return (
                <motion.div 
                  layout
                  key={p.id}
                  className={cn(
                    "group relative bg-slate-900 border transition-all duration-300 rounded-[32px] overflow-hidden",
                    isSelected ? "border-indigo-500/50 shadow-2xl shadow-indigo-900/20 ring-1 ring-indigo-500/20" : "border-slate-800 hover:border-slate-700 shadow-lg"
                  )}
                >
                  <div 
                    className="p-4 sm:p-8 cursor-pointer active:bg-slate-800/50 transition-colors"
                    onClick={() => setSelectedParticipantId(isSelected ? null : p.id)}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-6">
                      <div className="flex items-center gap-3 sm:gap-5">
                        <div className={cn(
                          "w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-105",
                          p.isPaid ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/10" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/10"
                        )}>
                          <User size={20} className="sm:w-7 sm:h-7" />
                        </div>
                        
                        <div className="space-y-0.5 sm:space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-xl font-black text-white tracking-normal leading-tight uppercase break-words">{p.name}</h3>
                            <span className={cn(
                              "text-[7px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg border shrink-0",
                              p.isPaid ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                              isOverdue ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : 
                              "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            )}>
                              {p.isPaid ? 'PAGO' : isOverdue ? 'ATRASO' : 'OK'}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-6 gap-y-0.5 sm:gap-y-2 pt-0.5 sm:pt-1">
                            <div className="flex items-center gap-1">
                              <IdCard size={10} className="text-slate-500 sm:w-[14px] sm:h-[14px]" />
                              <span className="text-[9px] sm:text-[11px] font-bold text-slate-400">{p.rg}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <CalendarIcon size={10} className="text-slate-500 sm:w-[14px] sm:h-[14px]" />
                              <span className="text-[9px] sm:text-[11px] font-bold text-slate-400">{calculateAgeAtCamp(p.birthDate)}A</span>
                            </div>
                            {p.birthDate && (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800/50 border border-slate-700/50">
                                <div className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  getPaymentType(calculateAgeAtCamp(p.birthDate)) === 'Inteira' ? "bg-indigo-400" : "bg-emerald-400"
                                )} />
                                <span className={cn(
                                  "text-[8px] sm:text-[9px] font-black uppercase tracking-wider",
                                  getPaymentType(calculateAgeAtCamp(p.birthDate)) === 'Inteira' ? "text-indigo-400" : "text-emerald-400"
                                )}>
                                  {getPaymentType(calculateAgeAtCamp(p.birthDate))}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between lg:justify-end gap-4 sm:gap-8 border-t lg:border-t-0 border-slate-800/50 pt-3 lg:pt-0">
                        <div className="text-left lg:text-right">
                          <p className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5 sm:mb-1 leading-normal">Total</p>
                          <p className="text-lg sm:text-2xl font-black text-white leading-tight">{formatCurrency(p.totalValue || 0)}</p>
                        </div>
                        
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (!p.phone) return;
                              const cleanPhone = p.phone.replace(/\D/g, '');
                              if (cleanPhone) {
                                const finalPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
                                const text = encodeURIComponent(`Olá ${p.name}! Tudo bem? Estamos entrando em contato sobre a sua inscrição no Acampa Central 2028.`);
                                window.open(`https://wa.me/${finalPhone}?text=${text}`, '_blank');
                              }
                            }}
                            className={cn(
                              "p-2 sm:p-3 rounded-lg sm:rounded-2xl transition-all flex items-center justify-center",
                              p.phone 
                                ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300" 
                                : "bg-slate-800 text-slate-600 cursor-not-allowed opacity-40"
                            )}
                            disabled={!p.phone}
                            title={p.phone ? "Conversar no WhatsApp" : "Telefone não cadastrado"}
                          >
                            <svg className="w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.062 5.248 5.308 0 11.722 0c3.107.002 6.028 1.211 8.225 3.41s3.402 5.12 3.4 8.228c-.005 6.473-5.251 11.721-11.665 11.721-2.002-.001-3.97-.514-5.711-1.493L0 24zm6.59-14.859c-.12-.268-.247-.274-.361-.278-.093-.004-.201-.004-.308-.004s-.282.04-.429.198c-.148.158-.564.55-.564 1.34s.577 1.554.657 1.662c.081.108 1.135 1.733 2.75 2.43 1.343.58 1.616.465 1.905.438.289-.026.932-.38 1.066-.748.134-.368.134-.683.094-.748-.04-.065-.148-.105-.308-.185-.16-.081-.932-.46-1.077-.512-.145-.052-.25-.081-.355.081-.105.162-.408.512-.5.617-.093.105-.185.118-.345.038-.16-.081-.676-.249-1.288-.795-.476-.424-.797-.948-.891-1.11-.093-.162-.01-.25.071-.33.073-.072.162-.19.242-.285.08-.096.108-.16.162-.268.054-.105.027-.2-.013-.281-.04-.082-.361-.871-.495-1.197z"/>
                            </svg>
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleEditParticipant(p); }}
                            className="p-2 sm:p-3 bg-slate-800 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded-lg sm:rounded-2xl transition-all"
                            title="Editar"
                          >
                            <Edit3 size={14} className="sm:w-[18px] sm:h-[18px]" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setDeleteParticipantModal({id: p.id, name: p.name}); }}
                            className="p-2 sm:p-3 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg sm:rounded-2xl transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={14} className="sm:w-[18px] sm:h-[18px]" />
                          </button>
                          <div className={cn(
                            "p-1 sm:p-2 rounded-lg transition-transform duration-300",
                            isSelected ? "rotate-90 text-indigo-400" : "text-slate-600"
                          )}>
                            <ChevronRight size={18} className="sm:w-6 sm:h-6" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {isOverdue && overdueInfo && (
                      <div className="mt-6 bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500">
                            <AlertCircle size={20} className="animate-pulse" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-rose-500 uppercase tracking-widest">Pendência Crítica</p>
                            <p className="text-[11px] font-bold text-rose-400/80 mt-0.5">
                              {overdueInfo.count} parcela(s) vencida(s) há {overdueInfo.daysOverdue} dias.
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-500 uppercase">Total em Atraso</p>
                          <p className="text-lg font-black text-rose-500">{formatCurrency(overdueInfo.amount)}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <AnimatePresence>
                    {isSelected && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-800 bg-black/20"
                      >
                        <div className="p-6 sm:p-8 space-y-8">
                          {/* Dependents Detail */}
                          {p.dependents && p.dependents.length > 0 && (
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <Users className="text-indigo-400" size={18} />
                                <h4 className="text-sm font-black text-white uppercase tracking-tighter">Dependentes Familiares</h4>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {p.dependents.map(dep => (
                                  <div key={dep.id} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
                                    <div className="flex justify-between items-start mb-2">
                                      <p className="text-sm font-bold text-white">{dep.name}</p>
                                      <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">{dep.relationship}</span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                      <div>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Idade 2028</p>
                                        <p className="text-sm font-black text-indigo-400">{dep.ageAtCamp} Anos</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Categoria</p>
                                        <p className={cn(
                                          "text-sm font-black",
                                          dep.paymentType === 'Inteira' ? "text-indigo-400" : 
                                          dep.paymentType === 'Meia' ? "text-emerald-400" : 
                                          "text-slate-300"
                                        )}>{dep.paymentType}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Logistics & Payment Detail */}
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            <div className="lg:col-span-4 space-y-6">
                              <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50">
                                <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                  <Rocket size={14} className="text-blue-400" /> Logística de Viagem
                                </h4>
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/10">
                                    {p.transport === 'Ônibus' ? <Users size={24} /> : <Car size={24} />}
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modalidade</p>
                                    <p className="text-xl font-black text-white">{p.transport}</p>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="bg-slate-800/40 p-6 rounded-3xl border border-slate-700/50">
                                <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                  <Receipt size={14} className="text-emerald-400" /> Ações de Recibo
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                  <button 
                                    onClick={() => generatePDFReceipt(p, installmentsMap[p.id] || [])}
                                    className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-900 hover:bg-slate-800 rounded-2xl border border-slate-800 transition-all text-slate-400 hover:text-white"
                                    title="Recibo"
                                  >
                                    <Download size={20} />
                                    <span className="text-[8px] font-black uppercase text-center">Recibo</span>
                                  </button>
                                  <button 
                                    onClick={() => generatePaymentBooklet(p, installmentsMap[p.id] || [])}
                                    className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-900 hover:bg-slate-800 rounded-2xl border border-slate-800 transition-all text-slate-400 hover:text-blue-400"
                                    title="Gerar Carnê"
                                  >
                                    <FileStack size={20} />
                                    <span className="text-[8px] font-black uppercase text-center">Carnê</span>
                                  </button>
                                  <button 
                                    onClick={() => sendWhatsAppReceipt(p, installmentsMap[p.id] || [])}
                                    className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-900 hover:bg-slate-800 rounded-2xl border border-slate-800 transition-all text-slate-400 hover:text-emerald-400"
                                    title="WhatsApp"
                                  >
                                    <Phone size={20} />
                                    <span className="text-[8px] font-black uppercase text-center">WhatsApp</span>
                                  </button>
                                  <button 
                                    onClick={() => setShowPixModal(true)}
                                    className="flex flex-col items-center justify-center gap-2 p-3 bg-slate-900 hover:bg-slate-800 rounded-2xl border border-slate-800 transition-all text-slate-400 hover:text-amber-400"
                                    title="QR Code Pix"
                                  >
                                    <QrCode size={20} />
                                    <span className="text-[8px] font-black uppercase text-center">Pix QR</span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="lg:col-span-8">
                                <div className="bg-black/30 rounded-3xl border border-slate-800 p-4 sm:p-8 overflow-hidden">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                                    <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                                      <CreditCard size={14} className="text-indigo-400" /> Extrato de Parcelas
                                    </h4>
                                    <div className="text-left sm:text-right bg-slate-900/50 sm:bg-transparent p-3 sm:p-0 rounded-2xl sm:rounded-none w-full sm:w-auto border border-slate-800 sm:border-0">
                                      <p className="text-[10px] font-black text-slate-500 uppercase">Plano</p>
                                      <p className="text-xs sm:text-sm font-black text-indigo-400">{p.installments}x de {formatCurrency((p.totalValue || 0) / (p.installments || 1))}</p>
                                    </div>
                                  </div>
                                
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar no-scrollbar">
                                  {(installmentsMap[p.id] || []).map(inst => {
                                    const status = getInstallmentStatus(inst);
                                    return (
                                      <div key={inst.id} className="bg-slate-900/50 p-3 sm:p-4 rounded-2xl border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group/inst">
                                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                          <div className={cn(
                                            "w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0",
                                            inst.isPaid ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-800 text-slate-500"
                                          )}>
                                            {inst.isPaid ? <CheckCircle2 size={18} /> : inst.month.split('-')[1]}
                                          </div>
                                          <div className="min-w-0 flex flex-col gap-1">
                                            <div>
                                              <p className="text-[11px] font-black text-white leading-none mb-1">{inst.month}</p>
                                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vence {formatDate(inst.dueDate)}</p>
                                            </div>
                                            {inst.paidByEmail && (
                                              <span className="text-[9px] font-bold text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded-lg border border-slate-800 inline-block self-start leading-tight">
                                                Registrado por: <span className="text-indigo-400">{inst.paidByEmail}</span>
                                                {inst.paidAt && ` em ${new Date(inst.paidAt).toLocaleDateString('pt-BR')} às ${new Date(inst.paidAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t border-slate-800/50 sm:border-0">
                                          <div className="text-left sm:text-right">
                                            <p className="text-[9px] sm:text-[10px] font-black text-slate-500 uppercase leading-none mb-1">Pago</p>
                                            <p className="text-xs sm:text-sm font-black text-white">{formatCurrency(inst.paidAmount || 0)}</p>
                                          </div>
                                          
                                          <div className="flex items-center gap-1.5 sm:gap-2">
                                            <button 
                                              onClick={() => setConfirmStatusModal({
                                                participantId: p.id,
                                                installmentId: inst.id,
                                                currentPaid: inst.isPaid,
                                                amount: inst.amount,
                                                month: inst.month,
                                                participantName: p.name
                                              })}
                                              className={cn(
                                                "p-2 sm:p-2.5 rounded-xl transition-all",
                                                inst.isPaid ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-500 hover:bg-emerald-500/20 hover:text-emerald-400"
                                              )}
                                              title={inst.isPaid ? "Marcar como pendente" : "Marcar como pago"}
                                            >
                                              <CheckCircle2 size={18} />
                                            </button>
                                            <button 
                                              onClick={() => openPartialPayment(p.id, inst)}
                                              className="p-2 sm:p-2.5 bg-slate-800 text-slate-500 hover:bg-blue-500/20 hover:text-blue-400 rounded-xl transition-all"
                                              title="Pagamento Parcial"
                                            >
                                              <CreditCard size={18} />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
        </div>

        {/* Right Side: Cobrança Rápida (WhatsApp) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-lg font-black text-white uppercase tracking-tighter flex items-center gap-2">
              <MessageSquare size={18} className="text-emerald-400" />
              Cobrança Rápida (WhatsApp)
            </h2>
          </div>

          <div id="quick-billing-card" className="bg-slate-900 rounded-[32px] p-6 border border-slate-800 shadow-xl flex flex-col lg:sticky lg:top-6 min-h-[350px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Atrasos Pendentes
              </h3>
              <span className="text-[9px] font-black text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/10 uppercase tracking-widest animate-pulse">
                {overdueList.length} em atraso
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[500px] pr-1 scrollbar-thin scrollbar-thumb-slate-800 space-y-3">
              {overdueList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-12 px-4 bg-black/20 rounded-2xl border border-dashed border-slate-800 text-center">
                  <CheckCircle2 className="text-emerald-500 mb-3 opacity-20" size={36} />
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">Tudo em Dia</h4>
                  <p className="text-[10px] text-slate-500 font-medium max-w-[200px] mt-1">Nenhum camper possui pendência ou parcela vencida.</p>
                </div>
              ) : (
                overdueList.map((item) => (
                  <div 
                    key={item.id} 
                    className="bg-black/20 p-4 rounded-2xl border border-slate-800/80 hover:border-slate-700/80 flex items-center justify-between gap-4 transition-all duration-200 group"
                  >
                    <div className="overflow-hidden space-y-1 flex-1">
                      <h4 className="text-xs sm:text-sm font-black text-white truncate">{item.name}</h4>
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-2">
                        <div className="flex items-center gap-1">
                          <Clock size={11} className="text-slate-500" />
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                            Venceu {item.dueDate ? formatDate(item.dueDate) : 'Parcela'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs sm:text-sm font-black text-rose-400">{formatCurrency(item.totalOverdue)}</p>
                        <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Atrasado</p>
                      </div>

                      <button
                        onClick={() => {
                          if (!item.phone) return;
                          const cleanPhone = item.phone.replace(/\D/g, '');
                          if (cleanPhone) {
                            const finalPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
                            const formattedDate = item.dueDate ? formatDate(item.dueDate) : '';
                            const text = encodeURIComponent(
                              `Olá ${item.name}! Tudo bem? Passando para lembrar da sua parcela do Acampa Central 2028, que venceu em ${formattedDate} no valor de ${formatCurrency(item.totalOverdue)}. Se você já efetuou o pagamento, favor desconsiderar esta mensagem. Obrigado! 🙏`
                            );
                            window.open(`https://wa.me/${finalPhone}?text=${text}`, '_blank');
                          }
                        }}
                        disabled={!item.phone}
                        className={cn(
                          "p-2.5 rounded-xl transition-all flex items-center justify-center active:scale-90",
                          item.phone 
                            ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300" 
                            : "bg-slate-800 text-slate-600 cursor-not-allowed opacity-40"
                        )}
                        title={item.phone ? "Enviar cobrança amigável via WhatsApp" : "Sem telefone cadastrado"}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.062 5.248 5.308 0 11.722 0c3.107.002 6.028 1.211 8.225 3.41s3.402 5.12 3.4 8.228c-.005 6.473-5.251 11.721-11.665 11.721-2.002-.001-3.97-.514-5.711-1.493L0 24zm6.59-14.859c-.12-.268-.247-.274-.361-.278-.093-.004-.201-.004-.308-.004s-.282.04-.429.198c-.148.158-.564.55-.564 1.34s.577 1.554.657 1.662c.081.108 1.135 1.733 2.75 2.43 1.343.58 1.616.465 1.905.438.289-.026.932-.38 1.066-.748.134-.368.134-.683.094-.748-.04-.065-.148-.105-.308-.185-.16-.081-.676-.249-1.288-.795-.476-.424-.797-.948-.891-1.11-.093-.162-.01-.25.071-.33.073-.072.162-.19.242-.285.08-.096.108-.16.162-.268.054-.105.027-.2-.013-.281-.04-.082-.361-.871-.495-1.197z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
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

      <ConfirmModal
        isOpen={!!confirmStatusModal}
        title="Confirmar Alteração de Status"
        message={confirmStatusModal?.currentPaid 
          ? `Deseja realmente marcar a parcela de ${confirmStatusModal?.month} de ${confirmStatusModal?.participantName} como NÃO PAGA?` 
          : `Deseja confirmar o recebimento da parcela de ${confirmStatusModal?.month} de ${confirmStatusModal?.participantName}?`}
        confirmText="Confirmar"
        onConfirm={() => {
          if (confirmStatusModal) {
            toggleInstallment(
              confirmStatusModal.participantId,
              confirmStatusModal.installmentId,
              confirmStatusModal.currentPaid,
              confirmStatusModal.amount
            );
          }
        }}
        onCancel={() => setConfirmStatusModal(null)}
      />

      {/* Pix QR Code Modal */}
      <AnimatePresence>
        {showPixModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-3xl w-full max-w-sm relative shadow-2xl"
            >
              <button 
                onClick={() => setShowPixModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <XCircle size={20} />
              </button>

              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 text-center">
                QR Code Pix para Pagamento
              </h3>

              <div className="flex flex-col items-center gap-4 bg-white/5 p-4 rounded-2xl border border-slate-800/80 mb-6">
                <div className="bg-white p-3 rounded-2xl shadow-inner">
                  <img 
                    src="https://i.imgur.com/C3ItOnH.png" 
                    alt="QR Code Pix"
                    referrerPolicy="no-referrer"
                    className="w-44 h-44 object-contain"
                  />
                </div>
                <p className="text-[10px] text-slate-400 text-center font-semibold leading-relaxed">
                  Abra o aplicativo do seu banco, escolha "Pagar com Pix" ou "Escanear QR Code" e aponte a câmera.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider">
                  Pix Copia e Cola
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value="00020101021126470014BR.GOV.BCB.PIX0125acampacentral@hotmail.com5204000053039865802BR5925IGREJA BATISTA CENTRAL NO6009SAO PAULO62080504daqr6304B4D0"
                    className="bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none flex-1 truncate select-all"
                  />
                  <button 
                    onClick={handleCopyPix}
                    className="px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-colors whitespace-nowrap"
                    title="Copiar Código"
                  >
                    {copiedPix ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-800/60 text-center">
                <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">
                  Chave Email: acampacentral@hotmail.com
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <button 
        onClick={() => {
          setEditingId(null);
          setFormData({ name: '', rg: '', phone: '', birthDate: '1990-01-01', transport: 'Carro', installments: 1, dueDay: 10, observation: '', isPaid: false, dependents: [] });
          setShowForm(true);
        }}
        className="fixed bottom-24 right-6 w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-2xl shadow-indigo-900/40 flex items-center justify-center z-40 active:scale-90 transition-transform hover:bg-indigo-500 md:bottom-10"
      >
        <Plus size={28} />
      </button>
    </div>
  );
};

export default Participantes;
