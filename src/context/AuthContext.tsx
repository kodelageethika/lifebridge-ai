import React, { createContext, useContext, useEffect, useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { OrganType, PublicUserAccount } from '../types/index.ts';
import { apiRequest, setStoredToken, getStoredToken } from '../services/api.ts';
import {
  firebaseAuth,
  googleProvider,
  syncFirebaseUserProfile,
  testFirestoreConnection,
} from '../lib/firebase.ts';

export type AuthModalTab = 'signin' | 'register' | 'reset';

interface AuthContextType {
  user: PublicUserAccount | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  authModalOpen: boolean;
  authModalTab: AuthModalTab;
  openAuthModal: (tab?: AuthModalTab) => void;
  closeAuthModal: () => void;
  login: (email: string, password: string) => Promise<PublicUserAccount>;
  register: (input: {
    email: string;
    password: string;
    displayName: string;
    role: 'donor' | 'recipient';
    bloodGroup?: 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';
    organType?: OrganType;
    age?: number;
  }) => Promise<PublicUserAccount>;
  loginWithGoogle: () => Promise<PublicUserAccount>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ accepted: boolean; previewResetToken?: string }>;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<void>;
  updateProfile: (displayName: string) => Promise<PublicUserAccount>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<PublicUserAccount | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<AuthModalTab>('signin');

  const refreshSession = async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        // Attempt HTTP-only cookie check when in-memory Bearer token is absent (e.g. page reload)
        const res = await apiRequest<{ user: PublicUserAccount }>('/api/v1/auth/me');
        setUser(res.user);
      } else {
        const res = await apiRequest<{ user: PublicUserAccount }>('/api/v1/auth/me');
        setUser(res.user);
      }
    } catch {
      setUser(null);
      setStoredToken(null);
    } finally {
      setIsAuthLoading(false);
    }
  };

  useEffect(() => {
    testFirestoreConnection();
    refreshSession();
  }, []);

  const openAuthModal = (tab: AuthModalTab = 'signin') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => setAuthModalOpen(false);

  const login = async (email: string, password: string): Promise<PublicUserAccount> => {
    const res = await apiRequest<{ user: PublicUserAccount; token: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setStoredToken(res.token);
    setUser(res.user);
    setAuthModalOpen(false);
    return res.user;
  };

  const register = async (input: {
    email: string;
    password: string;
    displayName: string;
    role: 'donor' | 'recipient';
    bloodGroup?: 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-';
    organType?: OrganType;
    age?: number;
  }): Promise<PublicUserAccount> => {
    const res = await apiRequest<{ user: PublicUserAccount; token: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: input,
    });
    setStoredToken(res.token);
    setUser(res.user);
    setAuthModalOpen(false);
    return res.user;
  };

  const loginWithGoogle = async (): Promise<PublicUserAccount> => {
    const cred = await signInWithPopup(firebaseAuth, googleProvider);
    const idToken = await cred.user.getIdToken();
    if (cred.user.email) {
      syncFirebaseUserProfile({
        uid: cred.user.uid,
        email: cred.user.email,
        displayName: cred.user.displayName || cred.user.email.split('@')[0],
      });
    }
    const res = await apiRequest<{ user: PublicUserAccount; token: string }>('/api/v1/auth/firebase', {
      method: 'POST',
      body: { idToken },
    });
    setStoredToken(res.token);
    setUser(res.user);
    setAuthModalOpen(false);
    return res.user;
  };

  const logout = async () => {
    try {
      await apiRequest('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // ignore network error during logout cleanup
    }
    try {
      if (firebaseAuth.currentUser) {
        await signOut(firebaseAuth);
      }
    } catch {
      // ignore firebase signout errors
    }
    setStoredToken(null);
    setUser(null);
  };

  const requestPasswordReset = async (email: string) => {
    return apiRequest<{ accepted: boolean; previewResetToken?: string }>(
      '/api/v1/auth/password-reset/request',
      { method: 'POST', body: { email } }
    );
  };

  const confirmPasswordReset = async (token: string, newPassword: string) => {
    await apiRequest('/api/v1/auth/password-reset/confirm', {
      method: 'POST',
      body: { token, newPassword },
    });
  };

  const updateProfile = async (displayName: string): Promise<PublicUserAccount> => {
    const res = await apiRequest<{ user: PublicUserAccount }>('/api/v1/auth/profile', {
      method: 'PATCH',
      body: { displayName },
    });
    setUser(res.user);
    return res.user;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isAuthLoading,
        authModalOpen,
        authModalTab,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        loginWithGoogle,
        logout,
        requestPasswordReset,
        confirmPasswordReset,
        updateProfile,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
