"use client";

/**
 * Auth estável: refresh em foco, timeout de loading, logout limpo + limpa cache.
 * Evita tela travada com cache morto quando o JWT expira.
 */

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase, UserProfile, isSupabaseConfigured } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { registrarLoginAction } from '@/app/actions/auditoria-actions';

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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const router = useRouter();
  const initialized = useRef(false);
  const fetchingProfile = useRef(false);
  const lastUserId = useRef<string | null>(null);
  const refreshing = useRef(false);

  const loadProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured || !supabase) return null;
    if (fetchingProfile.current && lastUserId.current === userId) return null;

    fetchingProfile.current = true;
    lastUserId.current = userId;

    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000));

    try {
      const query = supabase
        .from('usuarios')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) throw error;
          return data;
        });

      const profileData = await Promise.race([query, timeout]);

      if (profileData) {
        setProfile(profileData as UserProfile);
        const email = String((profileData as any).email || '').toLowerCase().trim();
        const secure =
          typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; secure' : '';
        if (email) {
          document.cookie = `lexis_user_email=${email}; path=/; max-age=31536000; samesite=lax${secure}`;
        }
        const cargo = String((profileData as any).cargo || '').trim();
        if (cargo) {
          document.cookie = `lexis_user_role=${encodeURIComponent(cargo)}; path=/; max-age=31536000; samesite=lax${secure}`;
        }
        setSessionError(null);
        return profileData as UserProfile;
      }
      setProfile(null);
      return null;
    } catch (e: any) {
      console.error('[AuthProvider] perfil:', e?.message || e);
      setSessionError('Não foi possível carregar o perfil. Tente recarregar.');
      return null;
    } finally {
      fetchingProfile.current = false;
      setLoading(false);
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

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!supabase || refreshing.current) return false;
    refreshing.current = true;
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
          setLoading(false);
          goLogin('expired');
          return false;
        }
        setUser(sess.session.user);
        if (lastUserId.current !== sess.session.user.id) {
          await loadProfile(sess.session.user.id);
        }
        return true;
      }
      setUser(data.session.user);
      setSessionError(null);
      if (lastUserId.current !== data.session.user.id) {
        await loadProfile(data.session.user.id);
      } else {
        setLoading(false);
      }
      return true;
    } catch {
      setLoading(false);
      return false;
    } finally {
      refreshing.current = false;
    }
  }, [goLogin, loadProfile]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (!supabase) {
      setLoading(false);
      setSessionError('Supabase não configurado');
      return;
    }

    // Safety: nunca ficar em loading eterno
    const bootTimeout = window.setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          setSessionError((e) => e || 'Demora na autenticação — recarregue ou entre de novo.');
        }
        return false;
      });
    }, 15000);

    supabase.auth.getSession().then(({ data, error }: { data: { session: Session | null }; error: any }) => {
      if (error) {
        console.warn('[Auth] getSession', error.message);
        setLoading(false);
        goLogin('session');
        return;
      }
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        loadProfile(sessionUser.id);
      } else {
        setLoading(false);
        goLogin('session');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);

      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setProfile(null);
        lastUserId.current = null;
        clearLexisCookies();
        clearSessionCaches();
        setLoading(false);
        setSessionError(null);
        goLogin('signed_out');
        return;
      }

      if (event === 'TOKEN_REFRESHED' && sessionUser) {
        setSessionError(null);
        setUser(sessionUser);
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' && sessionUser) {
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
        goLogin('session');
      }
    });

    // Voltar à aba / app após idle: renova JWT
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshSession().catch(() => {});
      }
    };
    const onFocus = () => {
      refreshSession().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);

    // Ping a cada 4 min (JWT costuma ser 1h; refresh preventivo)
    const tick = window.setInterval(() => {
      refreshSession().catch(() => {});
    }, 4 * 60 * 1000);

    return () => {
      window.clearTimeout(bootTimeout);
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      subscription.unsubscribe();
    };
  }, [goLogin, loadProfile, refreshSession]);

  const signOut = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      await supabase.auth.signOut();
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
      value={{ user, profile, loading, sessionError, refreshSession, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
