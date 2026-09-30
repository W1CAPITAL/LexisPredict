"use client";

/**
 * Auth leve: não trava a UI.
 * - loading só no boot curto
 * - refresh de token em background (sem setLoading)
 * - sem refresh a cada focus (isso derrubava o navegador)
 */

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase, UserProfile, isSupabaseConfigured } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { registrarLoginAction } from '@/app/actions/auditoria-actions';
import { disableGuestMode, isGuestMode } from '@/lib/guest-mode';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  sessionError: string | null;
  refreshSession: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  sessionError: null,
  refreshSession: async () => false,
  signOut: async () => {},
});

function clearLexisCookies() {
  try {
    document.cookie = 'lexis_user_email=; path=/; max-age=0; samesite=lax';
    document.cookie = 'lexis_user_role=; path=/; max-age=0; samesite=lax';
  } catch {
    /* */
  }
}

function clearSessionCaches() {
  try {
    sessionStorage.removeItem('lexis_carteira_sessao_v2');
    sessionStorage.removeItem('lexis_scan_progress_v1');
  } catch {
    /* */
  }
}

const MIN_REFRESH_GAP_MS = 25 * 60 * 1000; // refresh de segurança, nunca por troca de aba
const PROFILE_CACHE_KEY = 'lexis_auth_profile_v1';
const PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;

function readCachedProfile(userId: string): UserProfile | null {
  try {
    const raw = window.sessionStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      parsed.userId !== userId ||
      !parsed.profile ||
      Date.now() - Number(parsed.at || 0) > PROFILE_CACHE_TTL_MS
    ) return null;
    return parsed.profile as UserProfile;
  } catch {
    return null;
  }
}

function writeCachedProfile(userId: string, profile: UserProfile) {
  try {
    window.sessionStorage.setItem(
      PROFILE_CACHE_KEY,
      JSON.stringify({ userId, profile, at: Date.now() })
    );
  } catch {
    /* cache best effort */
  }
}

function clearCachedProfile() {
  try {
    window.sessionStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    /* */
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const router = useRouter();
  const fetchingProfile = useRef(false);
  const lastUserId = useRef<string | null>(null);
  const lastRefreshAt = useRef(0);
  const refreshing = useRef(false);

  const loadProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured || !supabase) return null;
    if (fetchingProfile.current && lastUserId.current === userId) return null;
    fetchingProfile.current = true;
    lastUserId.current = userId;
    try {
      const { data: profileData } = await supabase
        .from('usuarios')
        .select('id, auth_user_id, empresa_id, nome, email, cargo, role, avatar_url, created_at')
        .eq('auth_user_id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as UserProfile);
        writeCachedProfile(userId, profileData as UserProfile);
        try {
          const email = String(profileData.email || '').toLowerCase().trim();
          const secure =
            typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; secure' : '';
          if (email) {
            document.cookie = `lexis_user_email=${email}; path=/; max-age=31536000; samesite=lax${secure}`;
          }
          const cargo = String(profileData.cargo || '').trim();
          if (cargo) {
            document.cookie = `lexis_user_role=${encodeURIComponent(cargo)}; path=/; max-age=31536000; samesite=lax${secure}`;
          }
        } catch {
          /* */
        }
        setSessionError(null);
        return profileData as UserProfile;
      }
      setProfile(null);
      return null;
    } catch (e: any) {
      console.warn('[Auth] perfil', e?.message || e);
      return null;
    } finally {
      fetchingProfile.current = false;
    }
  }, []);

  const goLogin = useCallback(
    (reason: string) => {
      try {
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        if (path && path !== '/login' && path !== '/signup' && !path.startsWith('/termos')) {
          router.replace(`/login?reason=${encodeURIComponent(reason)}`);
        }
      } catch {
        /* */
      }
    },
    [router]
  );

  /** Refresh em background — NÃO mexe em loading (não trava fila/sidebar). */
  const refreshSession = useCallback(
    async (force = false): Promise<boolean> => {
      if (!supabase || refreshing.current) return false;
      const now = Date.now();
      if (!force && now - lastRefreshAt.current < MIN_REFRESH_GAP_MS) return true;
      refreshing.current = true;
      lastRefreshAt.current = now;
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) {
          const { data: sess } = await supabase.auth.getSession();
          if (!sess.session) {
            setUser(null);
            setProfile(null);
            lastUserId.current = null;
            clearLexisCookies();
            clearSessionCaches();
            clearCachedProfile();
            setSessionError('Sessão expirada');
            goLogin('expired');
            return false;
          }
          setUser(sess.session.user);
          return true;
        }
        setUser(data.session.user);
        setSessionError(null);
        return true;
      } catch {
        return false;
      } finally {
        refreshing.current = false;
      }
    },
    [goLogin]
  );

  useEffect(() => {
    if (isGuestMode()) {
      const guestUser = { id: 'guest', email: 'convidado@lexispredict.local', user_metadata: { guest: true } };
      const guestProfile: UserProfile = {
        id: 'guest-profile',
        auth_user_id: 'guest',
        empresa_id: 'guest-local',
        nome: 'CONVIDADO',
        email: 'convidado@lexispredict.local',
        cargo: 'Superadmin',
        role: 'superadmin',
        created_at: new Date(0).toISOString(),
        avatar_url: null,
      };
      setGuestMode(true);
      setUser(guestUser);
      setProfile(guestProfile);
      setLoading(false);
      setSessionError(null);
      return;
    }

    if (!supabase) {
      setLoading(false);
      return;
    }

    // Boot: libera UI assim que souber se há sessão (perfil em paralelo)
    let disposed = false;
    const bootDeadline = window.setTimeout(() => {
      if (!disposed) {
        setSessionError('A conexão demorou. Tente entrar novamente.');
        setLoading(false);
      }
    }, 15000);

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (disposed) return;
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      setLoading(false); // getSession é local; não esperar rede para liberar UI
      window.clearTimeout(bootDeadline);

      if (sessionUser) {
        lastRefreshAt.current = Date.now();

        // Hidrata o perfil imediatamente da sessão do navegador e revalida
        // em background no Supabase. Trocar de aba/recarregar não deve parecer novo login.
        const cached = readCachedProfile(sessionUser.id);
        if (cached) setProfile(cached);

        loadProfile(sessionUser.id).catch(() => {});
      }
    }).catch(() => {
      if (!disposed) {
        setSessionError('Não foi possível verificar a sessão. Confira sua conexão.');
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (disposed) return;
      setLoading(false);
      window.clearTimeout(bootDeadline);
      const sessionUser = session?.user ?? null;

      if (event === 'TOKEN_REFRESHED') {
        lastRefreshAt.current = Date.now();
        if (sessionUser) setUser(sessionUser);
        return;
      }

      if (event === 'SIGNED_OUT' || (event as string) === 'USER_DELETED') {
        setUser(null);
        setProfile(null);
        lastUserId.current = null;
        clearLexisCookies();
        clearSessionCaches();
        clearCachedProfile();
        setLoading(false);
        goLogin('signed_out');
        return;
      }

      setUser(sessionUser);

      if (event === 'SIGNED_IN' && sessionUser) {
        window.setTimeout(() => {
          if (!disposed) void registrarLoginAction(sessionUser.email).catch(() => {});
        }, 0);
      }

      if (sessionUser) {
        if (lastUserId.current !== sessionUser.id) {
          window.setTimeout(() => {
            if (!disposed) void loadProfile(sessionUser.id).catch(() => {});
          }, 0);
        }
      } else if (event !== 'INITIAL_SESSION') {
        setProfile(null);
        goLogin('session');
      }
    });

    // O SDK já faz auto-refresh do token. Não reautenticar ao trocar de aba.
    // Mantemos apenas uma rede de segurança de baixa frequência.
    const tick = window.setInterval(() => {
      refreshSession(false).catch(() => {});
    }, 45 * 60 * 1000); // rede de segurança a cada 45 min

    return () => {
      disposed = true;
      window.clearTimeout(bootDeadline);
      window.clearInterval(tick);
      subscription.unsubscribe();
    };
  }, [goLogin, loadProfile, refreshSession]);

  const signOut = async () => {
    if (guestMode || isGuestMode()) disableGuestMode();
    try {
      if (supabase) await supabase.auth.signOut({ scope: 'local' });
    } catch {
      /* */
    }
    setUser(null);
    setProfile(null);
    lastUserId.current = null;
    clearLexisCookies();
    clearSessionCaches();
    clearCachedProfile();
    setLoading(false);
    router.replace('/login');
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, sessionError, refreshSession: () => refreshSession(true), signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
