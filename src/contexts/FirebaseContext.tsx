/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, getRedirectResult } from 'firebase/auth';
import { auth, login, logout } from '../lib/firebase';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check for redirect result immediately
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("Login por redirecionamento bem-sucedido:", result.user.email);
          setUser(result.user);
        }
      } catch (err: any) {
        console.error("Erro ao processar resultado do redirecionamento", err);
        // Don't set global error for common background failures
        if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
          setError("Erro ao processar login: " + err.message);
        }
      }
    };

    handleRedirect();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    }, (err) => {
      console.error("Erro na mudança de estado de autenticação", err);
      setError(err.message);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    try {
      await login();
    } catch (err: any) {
      setError(err.message || "Erro ao entrar");
    }
  };

  const signOutUser = async () => {
    try {
      await logout();
    } catch (err: any) {
      setError(err.message || "Erro ao sair");
    }
  };

  return (
    <FirebaseContext.Provider value={{ user, loading, error, signIn: signInWithGoogle, signOut: signOutUser }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
