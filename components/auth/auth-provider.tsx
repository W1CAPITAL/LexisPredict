/**
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 * @license Proprietary - All rights reserved. See LICENSE file.
 */
"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase, UserProfile, isSupabaseConfigured } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

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
        // Sincronia de cookie para o contexto do servidor
        document.cookie = `lexis_user_email=${profileData.email.toLowerCase().trim()}; path=/; max-age=31536000; samesite=lax`;
        return profileData as UserProfile;
      }
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

    // Se o Supabase não estiver configurado, encerra o carregamento e não tenta acessar .auth
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Sessão Inicial
    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        loadProfile(sessionUser.id);
      } else {
        setLoading(false);
      }
    });

    // Listener de Mudanças
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        lastUserId.current = null;
        document.cookie = "lexis_user_email=; path=/; max-age=0";
        setLoading(false);
        return;
      }

      if (sessionUser) {
        if (lastUserId.current !== sessionUser.id) {
          loadProfile(sessionUser.id);
        } else {
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
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
