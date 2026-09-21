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
import { loadSafetySession, clearSafetySession, perfilToCargo, writeSafetyCookies } from '@/lib/hybrid/safety-mode';

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

const MIN_REFRESH_GAP_MS = 25 * 60 * 1000; // no máximo 1x a cada 25 min

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
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

    const safety = loadSafetySession();
    if (safety?.active) {
      writeSafetyCookies(safety.user);
      try { (supabase as any)?.realtime?.disconnect?.(); } catch { /* banco fora */ }
      const cargo = perfilToCargo(safety.user.perfil);
      setUser({ id: safety.user.login, email: safety.user.email || safety.user.login, safety: true });
      setProfile({
        id: safety.user.login,
        auth_user_id: safety.user.login,
        empresa_id: "sheets",
        nome: safety.user.nome,
        email: safety.user.email || safety.user.login,
        cargo,
        role: String(safety.user.perfil || "operador").toLowerCase(),
        created_at: safety.at,
      });
      setLoading(false);
      return () => {};
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
      setLoading(false); // UI livre já
      window.clearTimeout(bootDeadline);
      if (sessionUser) {
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
        if (sessionUser) setUser(sessionUser);
        return;
      }

      if (event === 'SIGNED_OUT' || (event as string) === 'USER_DELETED') {
        setUser(null);
        setProfile(null);
        lastUserId.current = null;
        clearLexisCookies();
        clearSessionCaches();
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

    // Só ao voltar de aba oculta por muito tempo (não a cada clique/focus)
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRefreshAt.current < MIN_REFRESH_GAP_MS) return;
      refreshSession(false).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);

    // Intervalo longo — o SDK já auto-refresh; isto é só rede de segurança
    const tick = window.setInterval(() => {
      refreshSession(false).catch(() => {});
    }, 45 * 60 * 1000); // rede de segurança a cada 45 min

    return () => {
      disposed = true;
      window.clearTimeout(bootDeadline);
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      subscription.unsubscribe();
    };
  }, [goLogin, loadProfile, refreshSession]);

  const signOut = async () => {
    try {
      clearSafetySession();
      if (supabase) await supabase.auth.signOut({ scope: 'local' });
    } catch {
      /* */
    }
    setUser(null);
    setProfile(null);
    lastUserId.current = null;
    clearLexisCookies();
    clearSessionCaches();
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
