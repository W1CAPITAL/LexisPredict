"use client";

export const GUEST_MODE_KEY = "lexis_guest_mode_v1";
export const GUEST_CACHE_PREFIX = "lexis_guest_cache_";

export function isGuestMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(GUEST_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function enableGuestMode() {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_MODE_KEY, "1");
  localStorage.setItem("lexis_data_provider_cfg_v1", JSON.stringify({
    kind: "local",
    sheets: { webhookUrl: "", token: "" },
    deviceId: "guest-browser",
  }));
  document.cookie = "lexis_guest=1; path=/; max-age=86400; samesite=lax";
}

export function disableGuestMode() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_MODE_KEY);
  localStorage.setItem("lexis_data_provider_cfg_v1", JSON.stringify({
    kind: "supabase",
    sheets: { webhookUrl: "", token: "" },
    deviceId: "browser",
  }));
  document.cookie = "lexis_guest=; path=/; max-age=0; samesite=lax";
}

export function guestCacheGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(GUEST_CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function guestCacheSet<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUEST_CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* cache best effort */
  }
}

export function clearGuestCache() {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(GUEST_CACHE_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    /* */
  }
}
