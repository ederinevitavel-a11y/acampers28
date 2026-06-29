/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signOut,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId);

export const auth = getAuth(app);

// Forçar persistência local para manter a sessão no celular
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.error("Erro ao definir persistência:", err);
});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Global sign in helper
export const login = async () => {
  try {
    // Em dispositivos móveis, navegadores como Safari bloqueiam popups agressivamente.
    // No entanto, em iframes (AI Studio), o pop-up é mais confiável se disparado por clique.
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Tentativa de login falhou", error);
    
    // Se o popup foi bloqueado, tentamos o redirecionamento
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/internal-error') {
      try {
        console.log("Tentando login por redirecionamento...");
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectError: any) {
        console.error("Erro no redirecionamento", redirectError);
        throw redirectError;
      }
    }
    
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      return null;
    }
    
    throw error;
  }
};

export const logout = () => signOut(auth);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test: OK");
  } catch (error: any) {
    if (error.code === 'unavailable') {
      console.error("Firestore is currently unavailable. This might be a transient network issue in the preview environment. The client will retry automatically.");
    } else if (error.code === 'permission-denied') {
      console.warn("Firestore connection test: Permission denied (expected if rules are active).");
    } else {
      console.error("Firestore connection test failed:", error.message);
    }
  }
}
testConnection();
