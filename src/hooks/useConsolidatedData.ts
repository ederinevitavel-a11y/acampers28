/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  SaborCentralEntry, BrasaGracaEntry, BrilhoCelesteWash, 
  ConectaCentralEvent, RecebaSuabencaoRaffle, BrilhoCelesteClient, Participant, Installment,
  BrilhoCelesteExpense
} from '../types';

export function useConsolidatedData() {
  const [data, setData] = useState({
    sabor: [] as SaborCentralEntry[],
    brasa: [] as BrasaGracaEntry[],
    brilho: [] as BrilhoCelesteWash[],
    brilhoClients: [] as BrilhoCelesteClient[],
    brilhoExpenses: [] as BrilhoCelesteExpense[],
    conecta: [] as ConectaCentralEvent[],
    bencao: [] as RecebaSuabencaoRaffle[],
    participants: [] as Participant[],
    installments: [] as Installment[],
    loading: true
  });

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    const collections = [
      { name: 'sabor_central', key: 'sabor' },
      { name: 'brasa_graca', key: 'brasa' },
      { name: 'brilho_celeste', key: 'brilho' },
      { name: 'brilho_celeste_clients', key: 'brilhoClients' },
      { name: 'brilho_celeste_expenses', key: 'brilhoExpenses' },
      { name: 'conecta_central', key: 'conecta' },
      { name: 'receba_bencao', key: 'bencao' },
      { name: 'participants', key: 'participants' },
      { name: 'installments', key: 'installments' },
    ];

    let loadedCount = 0;
    const totalCols = collections.length;

    collections.forEach((col) => {
      const q = query(collection(db, col.name), orderBy('timestamp', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        setData(prev => {
          const newData = { ...prev, [col.key]: docs };
          return {
            ...newData,
            loading: loadedCount < totalCols - 1 ? true : false
          };
        });
        loadedCount++;
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, col.name);
      });
      unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  return data;
}
