import { SignJWT, jwtVerify } from 'jose'
import type { Request, Response } from 'express'
import { env } from '../config/env.js'
import { authService, AuthError } from './auth.service.js'

export const REAUTH_COOKIE = 'sensitive_reauth'
export const REAUTH_TTL_SEC = 5 * 60

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax' as const,
  path: '/',
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET)
}

export class ReauthService {
  async issueCookie(userId: string, res: Response): Promise<{ expiresAt: number }> {
    const expiresAt = Math.floor(Date.now() / 1000) + REAUTH_TTL_SEC
    const token = await new SignJWT({ purpose: 'sensitive_reauth' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .sign(secretKey())

    res.cookie(REAUTH_COOKIE, token, {
      ...COOKIE_OPTIONS,
      maxAge: REAUTH_TTL_SEC * 1000,
    })

    return { expiresAt: expiresAt * 1000 }
  }

  clearCookie(res: Response): void {
    res.clearCookie(REAUTH_COOKIE, COOKIE_OPTIONS)
  }

  async hasValidCookie(req: Request, userId: string): Promise<boolean> {
    const token = req.cookies?.[REAUTH_COOKIE]
    if (!token || typeof token !== 'string') return false
    try {
      const { payload } = await jwtVerify(token, secretKey())
      return (
        payload.sub === userId &&
        payload.purpose === 'sensitive_reauth' &&
        typeof payload.exp === 'number' &&
        payload.exp * 1000 > Date.now()
      )
    } catch {
      return false
    }
  }

  /**
   * Accept either a fresh password (and refresh the 5-minute cookie)
   * or a still-valid reauth cookie from a prior confirmation.
   */
  async requirePasswordOrRecentReauth(
    req: Request,
    res: Response,
    userId: string,
    password?: string | null
  ): Promise<{ expiresAt: number }> {
    if (password && password.length > 0) {
      await authService.verifyPassword(userId, password)
      return this.issueCookie(userId, res)
    }

    const ok = await this.hasValidCookie(req, userId)
    if (!ok) {
      throw new AuthError('Password confirmation required', 'REAUTH_REQUIRED', 401)
    }

    // Sliding window: refresh TTL while still within the prior window
    return this.issueCookie(userId, res)
  }
}

export const reauthService = new ReauthService()
