'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, DoctorProfile } from '@/types';
import { client } from '@/lib/api/client';
import { refreshClient } from '@/lib/api/refreshClient';
import { tokenStore } from '@/lib/api/tokenStore';

interface AuthContextType {
  user: User | null;
  doctorProfile: DoctorProfile | null;
  loading: boolean;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setDoctorProfile: React.Dispatch<React.SetStateAction<DoctorProfile | null>>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndDoctor = useCallback(async () => {
    try {
      const { data: userRes } = await client.get('/users/me');
      const currentUser = userRes.data as User;
      setUser(currentUser);

      if (currentUser.role === 'doctor') {
        try {
          const { data: docRes } = await client.get('/doctor/profile');
          setDoctorProfile(docRes.data as DoctorProfile);
        } catch {
          setDoctorProfile(null);
        }
      } else {
        setDoctorProfile(null);
      }
    } catch {
      setUser(null);
      setDoctorProfile(null);
      tokenStore.clear();
    }
  }, []);

  // Bootstrap session on app mount
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        const { data: refreshRes } = await refreshClient.post('/auth/refresh');
        if (refreshRes?.data?.accessToken && mounted) {
          tokenStore.set(refreshRes.data.accessToken);
          await fetchProfileAndDoctor();
        }
      } catch {
        // No active refresh session or invalid cookie
        if (mounted) {
          tokenStore.clear();
          setUser(null);
          setDoctorProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initSession();

    return () => {
      mounted = false;
    };
  }, [fetchProfileAndDoctor]);

  const logout = async () => {
    try {
      await refreshClient.post('/auth/logout');
    } catch {
      // Ignore logout errors
    } finally {
      tokenStore.clear();
      setUser(null);
      setDoctorProfile(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  const refetchUser = async () => {
    await fetchProfileAndDoctor();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        doctorProfile,
        loading,
        setUser,
        setDoctorProfile,
        logout,
        refetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

