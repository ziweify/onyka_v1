import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { IoLockClosedOutline, IoTimeOutline } from 'react-icons/io5'
import type { PublicShareContent, PublicShareLinkMeta } from '@onyka/shared'
import { shareLinksApi, ApiException } from '@/services/api'

function useCountdown(expiresAt: string | Date | null | undefined) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!expiresAt) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  return useMemo(() => {
    if (!expiresAt) return null
    const ms = new Date(expiresAt).getTime() - now
    if (ms <= 0) return { expired: true, label: '0:00:00' }
    const total = Math.floor(ms / 1000)
    const d = Math.floor(total / 86400)
    const h = Math.floor((total % 86400) / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    const hh = String(h).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    const ss = String(s).padStart(2, '0')
    return {
      expired: false,
      label: d > 0 ? `${d}d ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`,
    }
  }, [expiresAt, now])
}

export function SharedNotePage() {
  const { token = '' } = useParams<{ token: string }>()
  const { t } = useTranslation()
  const [meta, setMeta] = useState<PublicShareLinkMeta | null>(null)
  const [content, setContent] = useState<PublicShareContent | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [activePage, setActivePage] = useState(0)

  const countdown = useCountdown(content?.expiresAt ?? meta?.expiresAt ?? null)

  const loadMeta = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { meta: m } = await shareLinksApi.getPublicMeta(token)
      setMeta(m)
      if (
        m.status === 'active' &&
        !m.needsPassword &&
        !m.isExpired &&
        !m.isExhausted
      ) {
        const opened = await shareLinksApi.openPublic(token)
        setContent(opened.content)
      }
    } catch (err) {
      setError(
        err instanceof ApiException ? err.message : t('link_share.guest_unavailable')
      )
    } finally {
      setLoading(false)
    }
  }, [token, t])

  useEffect(() => {
    if (token) void loadMeta()
  }, [token, loadMeta])

  const handleUnlock = async () => {
    setOpening(true)
    setError(null)
    try {
      const opened = await shareLinksApi.openPublic(token, password)
      setContent(opened.content)
      setMeta((m) =>
        m
          ? {
              ...m,
              viewCount: opened.content.viewCount,
              remainingViews: opened.content.remainingViews,
            }
          : m
      )
    } catch (err) {
      if (err instanceof ApiException && err.code === 'INVALID_PASSWORD') {
        setError(t('link_share.wrong_password'))
      } else if (err instanceof ApiException) {
        setError(err.message)
      } else {
        setError(t('link_share.guest_unavailable'))
      }
    } finally {
      setOpening(false)
    }
  }

  const unavailable =
    error ||
    (meta &&
      (meta.status !== 'active' || meta.isExpired || meta.isExhausted || countdown?.expired))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (unavailable && !content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] p-6">
        <div className="max-w-sm w-full text-center space-y-3">
          <IoLockClosedOutline className="w-10 h-10 mx-auto text-[var(--color-text-tertiary)]" />
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {t('link_share.guest_unavailable')}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {error ||
              (meta?.isExpired || countdown?.expired
                ? t('link_share.guest_expired')
                : meta?.isExhausted
                  ? t('link_share.guest_exhausted')
                  : t('link_share.guest_revoked'))}
          </p>
        </div>
      </div>
    )
  }

  if (meta?.needsPassword && !content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] p-6">
        <div className="max-w-sm w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 space-y-4">
          <div className="text-center space-y-1">
            <IoLockClosedOutline className="w-8 h-8 mx-auto text-[var(--color-accent)]" />
            <h1 className="text-base font-semibold text-[var(--color-text-primary)]">
              {meta.noteTitle || t('editor.untitled')}
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t('link_share.guest_password_hint')}
            </p>
          </div>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleUnlock()
            }}
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm"
            placeholder={t('link_share.password_placeholder')}
          />
          {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
          <button
            type="button"
            disabled={opening || password.length < 1}
            onClick={() => void handleUnlock()}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white disabled:opacity-50"
          >
            {opening ? t('common.loading') : t('link_share.guest_open')}
          </button>
        </div>
      </div>
    )
  }

  if (!content) return null

  const page = content.pages[activePage] ?? content.pages[0]

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]">
      <header className="sticky top-0 z-10 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/95 backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">
              {t('link_share.guest_badge')}
            </p>
            <h1 className="text-lg font-semibold truncate">
              {content.noteTitle || t('editor.untitled')}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)]">
            {countdown && !countdown.expired && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--color-bg-tertiary)]">
                <IoTimeOutline className="w-3.5 h-3.5" />
                {t('link_share.countdown', { time: countdown.label })}
              </span>
            )}
            {content.remainingViews != null && (
              <span className="px-2 py-1 rounded-lg bg-[var(--color-bg-tertiary)]">
                {t('link_share.remaining_views', { count: content.remainingViews })}
              </span>
            )}
          </div>
        </div>
      </header>

      {content.pages.length > 1 && (
        <div className="max-w-3xl mx-auto px-4 pt-3 flex gap-1 overflow-x-auto">
          {content.pages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActivePage(i)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${
                i === activePage
                  ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              {p.title || t('pages.untitled', { defaultValue: `Page ${i + 1}` })}
            </button>
          ))}
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-6">
        <article
          className="prose prose-sm dark:prose-invert max-w-none fluid-editor-content"
          dangerouslySetInnerHTML={{ __html: page?.content || '' }}
        />
      </main>
    </div>
  )
}
