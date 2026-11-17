const STORAGE_KEY = 'onyka_sensitive_reauth_expires_at'

/** Client-side mirror of the 5-minute server reauth cookie (UX only). */
export function getSensitiveReauthExpiresAt(): number {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export function isSensitiveReauthValid(now = Date.now()): boolean {
  return getSensitiveReauthExpiresAt() > now
}

export function markSensitiveReauth(expiresAt: number): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(expiresAt))
  } catch {
    /* private mode */
  }
}

export function clearSensitiveReauth(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
