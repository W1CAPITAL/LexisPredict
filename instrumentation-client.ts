/**
 * LexisPredict — proteção contra refresh token stale no navegador.
 *
 * Quando o Supabase Auth devolve HTTP 400 para /auth/v1/token,
 * a sessão persistida localmente pode estar inválida/rotacionada.
 * Removemos somente as chaves de sessão do Supabase e deixamos o app
 * continuar pelo fluxo normal de login. Nenhum dado de negócio é tocado.
 */
(() => {
  if (typeof window === 'undefined') return

  const purgeAuthStorage = () => {
    try {
      for (const storage of [window.localStorage, window.sessionStorage]) {
        const keys: string[] = []
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i)
          if (key) keys.push(key)
        }
        for (const key of keys) {
          const k = key.toLowerCase()
          if (
            k.includes('supabase.auth') ||
            /^sb-[^-]+-auth-token/i.test(key) ||
            k === 'supabase.auth.token' ||
            k === 'sb-auth-token' ||
            k === 'sb-session'
          ) {
            storage.removeItem(key)
          }
        }
      }
    } catch {
      // Storage bloqueado não pode impedir o carregamento do aplicativo.
    }
  }

  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init)
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (/\/auth\/v1\/token(?:\?|$)/i.test(url) && response.status === 400) {
        purgeAuthStorage()
        window.dispatchEvent(new CustomEvent('lexis:supabase-auth-reset'))
      }
    } catch {
      // Não propagar erro do mecanismo de recuperação para o app.
    }
    return response
  }
})()
