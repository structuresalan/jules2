import React, { useEffect, useRef, useState } from 'react';
import {
  auth,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from '../firebase';
import { AuthContext } from './authContextInstance';

const getSignupInviteCode = () =>
  String(import.meta.env.VITE_SIGNUP_INVITE_CODE || '')
    .trim();

const isValidInviteCode = (inviteCode = '') => {
  const requiredInviteCode = getSignupInviteCode();
  if (!requiredInviteCode) return true;

  return inviteCode.trim() === requiredInviteCode;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const ignoreNullAuthStateUntilRef = useRef(0);
  const authConfigured = Boolean(auth);

  const createAccount = async (email: string, password: string, inviteCode = '') => {
    const activeAuth = auth;
    const normalizedEmail = email.trim();

    if (!activeAuth) {
      throw new Error('Firebase is not configured yet. Add the Firebase environment variables in Vercel before creating an account.');
    }

    if (!isValidInviteCode(inviteCode)) {
      throw new Error('Invalid signup code.');
    }

    setLoading(true);
    await setPersistence(activeAuth, browserLocalPersistence);
    const credential = await createUserWithEmailAndPassword(activeAuth, normalizedEmail, password);

    ignoreNullAuthStateUntilRef.current = Date.now() + 6000;
    setUser(credential.user);
    setLoading(false);
  };

  const login = async (email: string, password: string) => {
    const activeAuth = auth;

    if (!activeAuth) {
      throw new Error('Firebase is not configured yet. Add the Firebase environment variables in Vercel before logging in.');
    }

    setLoading(true);
    await setPersistence(activeAuth, browserLocalPersistence);
    const credential = await signInWithEmailAndPassword(activeAuth, email.trim(), password);

    ignoreNullAuthStateUntilRef.current = Date.now() + 6000;
    setUser(credential.user);
    setLoading(false);
  };

  const logout = async () => {
    const activeAuth = auth;
    ignoreNullAuthStateUntilRef.current = 0;

    if (activeAuth) {
      await signOut(activeAuth);
    }

    setUser(null);
    setLoading(false);
  };

  // Kept only for local development fallback. The login screen no longer exposes this in production.
  const mockLogin = () => {
    if (!import.meta.env.DEV) return;
    setUser({ email: 'demo@example.com', uid: 'mock-uid' } as User);
    setLoading(false);
  };

  const mockLogout = () => {
    setUser(null);
    setLoading(false);
  };

  useEffect(() => {
    const activeAuth = auth;

    if (!activeAuth) {
      setLoading(false);
      return;
    }

    setPersistence(activeAuth, browserLocalPersistence).catch((error) => {
      console.error('Firebase persistence setup error', error);
    });

    const unsubscribe = onAuthStateChanged(activeAuth, (firebaseUser) => {
      if (!firebaseUser && Date.now() < ignoreNullAuthStateUntilRef.current) {
        setLoading(false);
        return;
      }

      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authConfigured,
        createAccount,
        login,
        logout,
        mockLogin,
        mockLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
