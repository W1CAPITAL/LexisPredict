"use client";

/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase, UserProfile, isSupabaseConfigured } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { registrarLoginAction } from '@/app/actions/auditoria-actions';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const initialized = useRef(false);
  const fetchingProfile = useRef(false);
  const lastUserId = useRef<string | null>(null);

  const loadProfile = async (userId: string) => {
    if (!isSupabaseConfigured || !supabase || (fetchingProfile.current && lastUserId.current === userId)) return null;
    
    fetchingProfile.current = true;
    lastUserId.current = userId;

    try {
      const { data: profileData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as UserProfile);
        const email = String(profileData.email || '').toLowerCase().trim();
        const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; secure' : '';
        if (email) {
          document.cookie = `lexis_user_email=${email}; path=/; max-age=31536000; samesite=lax${secure}`;
        }
        const cargo = String(profileData.cargo || '').trim();
        if (cargo) {
          document.cookie = `lexis_user_role=${encodeURIComponent(cargo)}; path=/; max-age=31536000; samesite=lax${secure}`;
        }
        return profileData as UserProfile;
      }
      // Sem linha em usuarios: libera UI (evita loading eterno / loop)
      setProfile(null);
      return null;
    } catch (e) {
      console.error("[AuthProvider] Erro ao carregar perfil:", e);
      return null;
    } finally {
      fetchingProfile.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (!supabase) {
      setLoading(false);
      return;
    }

    // Sessão Inicial
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        loadProfile(sessionUser.id);
      } else {
        setLoading(false);
        try {
          const path = typeof window !== 'undefined' ? window.location.pathname : '';
          if (path && path !== '/login' && path !== '/signup' && !path.startsWith('/termos')) {
            router.replace('/login?reason=session');
          }
        } catch { /* ignore */ }
      }
    });

    // Listener de Mudanças de Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        lastUserId.current = null;
        document.cookie = "lexis_user_email=; path=/; max-age=0";
        document.cookie = "lexis_user_role=; path=/; max-age=0";
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' && sessionUser) {
        // Auditoria de login (F1)
        registrarLoginAction(sessionUser.email).catch(() => {});
      }

      if (sessionUser) {
        if (lastUserId.current !== sessionUser.id) {
          await loadProfile(sessionUser.id);
        } else {
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
        try {
          const path = typeof window !== 'undefined' ? window.location.pathname : '';
          if (path && path !== '/login' && path !== '/signup' && !path.startsWith('/termos')) {
            router.replace('/login?reason=session');
          }
        } catch { /* ignore */ }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (!supabase) return;
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    lastUserId.current = null;
    document.cookie = "lexis_user_email=; path=/; max-age=0";
    setLoading(false);
    router.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
