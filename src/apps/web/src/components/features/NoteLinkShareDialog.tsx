import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  IoCloseOutline,
  IoCopyOutline,
  IoLinkOutline,
  IoReloadOutline,
  IoTrashOutline,
} from 'react-icons/io5'
import type { NoteShareLink } from '@onyka/shared'
import { shareLinksApi, ApiException } from '@/services/api'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { toast } from '@/components/ui/Toast'

interface NoteLinkShareDialogProps {
  isOpen: boolean
  onClose: () => void
  noteId: string
  noteTitle: string
  isEncrypted?: boolean
}

type ExpiryPreset = '7d' | '1d' | 'never' | 'custom'

function absoluteShareUrl(path: string): string {
  return `${window.location.origin}${path}`
}

function formatRemain(expiresAt: string | Date | null): string | null {
  if (!expiresAt) return null
  const t = new Date(expiresAt).getTime() - Date.now()
  if (t <= 0) return '0'
  const h = Math.floor(t / 3600000)
  const m = Math.floor((t % 3600000) / 60000)
  if (h >= 48) return `${Math.floor(h / 24)}d`
  if (h >= 1) return `${h}h ${m}m`
  return `${Math.max(1, m)}m`
}

export function NoteLinkShareDialog({
  isOpen,
  onClose,
  noteId,
  noteTitle,
  isEncrypted,
}: NoteLinkShareDialogProps) {
  const { t } = useTranslation()
  const focusTrapRef = useFocusTrap(isOpen)
  const [links, setLinks] = useState<NoteShareLink[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>('7d')
  const [customExpires, setCustomExpires] = useState('')
  const [maxViews, setMaxViews] = useState('')
  const [label, setLabel] = useState('')
  const [allowGuestComments, setAllowGuestComments] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdPath, setCreatedPath] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { links: list } = await shareLinksApi.listForNote(noteId)
      setLinks(list)
    } catch {
      setLinks([])
    } finally {
      setLoading(false)
    }
  }, [noteId])

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setCreatedPath(null)
    void load()
  }, [isOpen, load])

  const expiresAtPayload = useMemo(() => {
    if (expiryPreset === 'never') return null
    if (expiryPreset === '1d') return new Date(Date.now() + 86400000).toISOString()
    if (expiryPreset === '7d') return new Date(Date.now() + 7 * 86400000).toISOString()
    if (expiryPreset === 'custom' && customExpires) {
      return new Date(customExpires).toISOString()
    }
    return undefined
  }, [expiryPreset, customExpires])

  if (!isOpen) return null

  const handleCreate = async () => {
    setError(null)
    if (isEncrypted) {
      setError(t('link_share.encrypted_blocked'))
      return
    }
    setCreating(true)
    try {
      const { link } = await shareLinksApi.create(noteId, {
        password: usePassword && password ? password : null,
        expiresAt: expiresAtPayload === undefined ? undefined : expiresAtPayload,
        maxViews: maxViews ? Number(maxViews) : null,
        label: label.trim() || null,
        allowGuestComments,
      })
      setCreatedPath(link.path)
      setPassword('')
      setLabel('')
      setMaxViews('')
      setAllowGuestComments(false)
      await load()
      toast.success(t('link_share.created'))
    } catch (err) {
      const msg =
        err instanceof ApiException
          ? err.code === 'NOTE_ENCRYPTED'
            ? t('link_share.encrypted_blocked')
            : err.message
          : t('link_share.create_failed')
      setError(msg)
    } finally {
      setCreating(false)
    }
  }

  const copyLink = async (path: string) => {
    try {
      await navigator.clipboard.writeText(absoluteShareUrl(path))
      toast.success(t('link_share.copied'))
    } catch {
      toast.error(t('link_share.copy_failed'))
    }
  }

  const revoke = async (id: string) => {
    try {
      await shareLinksApi.revoke(id)
      await load()
      toast.success(t('link_share.revoked'))
    } catch {
      toast.error(t('link_share.revoke_failed'))
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t('common.close')}
      />
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl p-5"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              <IoLinkOutline className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                {t('link_share.title')}
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">
                {noteTitle || t('editor.untitled')}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--color-bg-tertiary)]">
            <IoCloseOutline className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[var(--color-text-secondary)] mb-4 leading-relaxed">
          {t('link_share.desc')}
        </p>

        {isEncrypted ? (
          <p className="mb-4 text-xs text-[var(--color-error)]">{t('link_share.encrypted_blocked')}</p>
        ) : (
          <div className="space-y-3 mb-5 p-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)]">
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
              />
              {t('link_share.use_password')}
            </label>
            {usePassword && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('link_share.password_placeholder')}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm"
              />
            )}

            <div>
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {t('link_share.expiry')}
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {(
                  [
                    ['7d', t('link_share.expiry_7d')],
                    ['1d', t('link_share.expiry_1d')],
                    ['never', t('link_share.expiry_never')],
                    ['custom', t('link_share.expiry_custom')],
                  ] as const
                ).map(([id, labelText]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setExpiryPreset(id)}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                      expiryPreset === id
                        ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                        : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {labelText}
                  </button>
                ))}
              </div>
              {expiryPreset === 'custom' && (
                <input
                  type="datetime-local"
                  value={customExpires}
                  onChange={(e) => setCustomExpires(e.target.value)}
                  className="mt-2 w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm"
                />
              )}
            </div>

            <label className="block">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {t('link_share.max_views')}
              </span>
              <input
                type="number"
                min={1}
                value={maxViews}
                onChange={(e) => setMaxViews(e.target.value)}
                placeholder={t('link_share.max_views_placeholder')}
                className="mt-1.5 w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                {t('link_share.label')}
              </span>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('link_share.label_placeholder')}
                className="mt-1.5 w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-sm"
              />
            </label>

            <label className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={allowGuestComments}
                onChange={(e) => setAllowGuestComments(e.target.checked)}
              />
              <span>
                {t('link_share.allow_guest_comments')}
                <span className="block text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                  {t('link_share.allow_guest_comments_hint')}
                </span>
              </span>
            </label>

            {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}

            <button
              type="button"
              disabled={creating || (usePassword && password.length < 4)}
              onClick={() => void handleCreate()}
              className="w-full py-2.5 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <IoReloadOutline className="w-4 h-4 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                t('link_share.create')
              )}
            </button>

            {createdPath && (
              <div className="flex gap-2 items-center">
                <input
                  readOnly
                  value={absoluteShareUrl(createdPath)}
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs truncate"
                />
                <button
                  type="button"
                  onClick={() => void copyLink(createdPath)}
                  className="p-2 rounded-lg bg-[var(--color-bg-tertiary)]"
                  title={t('link_share.copy')}
                >
                  <IoCopyOutline className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
            {t('link_share.existing')}
          </h3>
          {loading ? (
            <p className="text-xs text-[var(--color-text-tertiary)]">{t('common.loading')}</p>
          ) : links.length === 0 ? (
            <p className="text-xs text-[var(--color-text-tertiary)]">{t('link_share.empty')}</p>
          ) : (
            <ul className="space-y-2">
              {links.map((link) => {
                const remain = formatRemain(link.expiresAt)
                const inactive = link.status !== 'active'
                return (
                  <li
                    key={link.id}
                    className={`p-3 rounded-xl border border-[var(--color-border-subtle)] ${
                      inactive ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 text-xs text-[var(--color-text-secondary)] space-y-0.5">
                        <p className="font-medium text-[var(--color-text-primary)] truncate">
                          {link.label || link.path}
                        </p>
                        <p>
                          {link.hasPassword ? t('link_share.with_password') : t('link_share.no_password')}
                          {link.allowGuestComments
                            ? ` · ${t('link_share.guest_comments_on')}`
                            : ''}
                          {' · '}
                          {link.maxViews != null
                            ? t('link_share.views_used', {
                                used: link.viewCount,
                                max: link.maxViews,
                              })
                            : t('link_share.views_open', { count: link.viewCount })}
                          {remain != null && ` · ${t('link_share.remain', { time: remain })}`}
                          {inactive && ` · ${t('link_share.status_revoked')}`}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {!inactive && (
                          <button
                            type="button"
                            onClick={() => void copyLink(link.path)}
                            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)]"
                            title={t('link_share.copy')}
                          >
                            <IoCopyOutline className="w-4 h-4" />
                          </button>
                        )}
                        {!inactive && (
                          <button
                            type="button"
                            onClick={() => void revoke(link.id)}
                            className="p-1.5 rounded-lg hover:bg-[var(--color-error)]/10 text-[var(--color-error)]"
                            title={t('link_share.revoke')}
                          >
                            <IoTrashOutline className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
