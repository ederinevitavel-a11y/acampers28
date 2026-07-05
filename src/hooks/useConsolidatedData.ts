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
  BrilhoCelesteExpense, CampExpense
} from '../types';

export function useConsolidatedData() {
  const [data, setData] = useState({
    participants: [] as Participant[],
    installments: [] as Installment[],
    campExpenses: [] as CampExpense[],
    loading: true,
    error: null as string | null
  });

  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    const collections = [
      { name: 'participants', key: 'participants' },
      { name: 'installments', key: 'installments' },
      { name: 'camp_expenses', key: 'campExpenses' },
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
            loading: loadedCount < totalCols - 1 ? true : false,
            error: null
          };
        });
        loadedCount++;
      }, (error) => {
        console.error(`Erro ao carregar coleção ${col.name}:`, error);
        setData(prev => ({ ...prev, loading: false, error: error.message }));
        // handleFirestoreError(error, OperationType.LIST, col.name); // Avoid throwing to prevent crash
      });
      unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  return data;
}
