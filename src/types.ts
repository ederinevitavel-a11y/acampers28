/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Transaction {
  id: string;
  date: string;
  description: string;
  type: 'revenue' | 'expense';
  amount: number;
  project: 'Sabor Central' | 'Brilho Celeste' | 'Conecta Central' | 'Brasa & Graça' | 'Receba sua Benção';
  timestamp: number;
}

export interface SaborCentralEntry {
  id: string;
  date: string;
  item: string;
  quantitySold: number;
  unitCost: number;
  totalCost: number;
  totalRevenue: number;
  profit: number;
  isPaid: boolean;
  timestamp: number;
}

export interface BrasaGracaEntry {
  id: string;
  date: string;
  item: string;
  quantitySold: number;
  unitCost: number;
  totalCost: number;
  totalRevenue: number;
  profit: number;
  isPaid: boolean;
  timestamp: number;
}

export interface BrilhoCelesteClient {
  id: string;
  name: string;
  phone?: string;
  carInfo?: string;
  packageName: '1 Lavagem' | '2 Lavagens' | '4 Lavagens';
  totalWashesBought: number;
  washesRemaining: number;
  packagePrice: number;
  isPaid: boolean;
  paymentDate?: string;
  timestamp: number;
}

export interface BrilhoCelesteWash {
  id: string;
  date: string;
  timeSlot: string; // "09:00", "09:15", ..., "15:00"
  clientId?: string; // Optional if we allow one-off washes without registration, but user asked for registration
  clientName: string;
  packageName: '1 Lavagem' | '2 Lavagens' | '4 Lavagens';
  packagePrice: number;
  isPaid: boolean;
  timestamp: number;
}

export interface BrilhoCelesteExpense {
  id: string;
  date: string;
  description: string;
  amount: number;
  timestamp: number;
}

export interface ConectaCentralEvent {
  id: string;
  date: string;
  name: string;
  description?: string;
  totalRevenue: number;
  totalExpense: number;
  profit: number;
  participantCount: number;
  timestamp: number;
}

export interface RecebaSuabencaoRaffle {
  id: string;
  date: string;
  prize: string;
  participantsCount: number;
  winnerName: string;
  ticketPrice: number;
  totalRevenue: number;
  timestamp: number;
}

export interface Installment {
  id: string;
  participantId: string;
  participantName: string;
  amount: number;
  paidAmount: number;
  month: string; // "YYYY-MM"
  dueDate: string; // "YYYY-MM-DD"
  isPaid: boolean;
  observation?: string;
  paidByEmail?: string | null;
  paidAt?: string | null;
  timestamp: number;
}

export interface Dependent {
  id: string;
  name: string;
  rg?: string;
  birthDate: string;
  relationship: string;
  ageAtCamp: number;
  paymentType: 'Inteira' | 'Meia' | 'Isento';
}

export interface Participant {
  id: string;
  name: string;
  rg: string;
  phone?: string;
  birthDate: string;
  ageAtCamp: number;
  paymentType: 'Inteira' | 'Meia' | 'Isento';
  transport: 'Carro' | 'Ônibus';
  dependents?: Dependent[];
  totalValue?: number;
  installments?: number;
  dueDay?: number;
  observation?: string;
  isPaid: boolean;
  timestamp: number;
}

export interface CampExpense {
  id: string;
  installmentNumber: number;
  dueDate: string; // "YYYY-MM-DD"
  amount: number;
  isPaid: boolean;
  paymentDate?: string;
  observation?: string;
  timestamp: number;
}

export type AppTab = 'dashboard' | 'participantes';
