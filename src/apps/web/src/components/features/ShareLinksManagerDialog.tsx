import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  IoCloseOutline,
  IoCopyOutline,
  IoLinkOutline,
  IoTrashOutline,
} from 'react-icons/io5'
import type { NoteShareLinkWithNote } from '@onyka/shared'
import { shareLinksApi } from '@/services/api'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { toast } from '@/components/ui/Toast'

interface ShareLinksManagerDialogProps {
  isOpen: boolean
  onClose: () => void
}

function absoluteShareUrl(path: string): string {
  return `${window.location.origin}${path}`
}

export function ShareLinksManagerDialog({ isOpen, onClose }: ShareLinksManagerDialogProps) {
  const { t } = useTranslation()
  const focusTrapRef = useFocusTrap(isOpen)
  const [links, setLinks] = useState<NoteShareLinkWithNote[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { links: list } = await shareLinksApi.listMine()
      setLinks(list)
    } catch {
      setLinks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) void load()
  }, [isOpen, load])

  if (!isOpen) return null

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
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              <IoLinkOutline className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                {t('link_share.manage_title')}
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                {t('link_share.manage_desc')}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--color-bg-tertiary)]">
            <IoCloseOutline className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">{t('common.loading')}</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-[var(--color-text-tertiary)]">{t('link_share.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {links.map((link) => {
              const inactive = link.status !== 'active'
              return (
                <li
                  key={link.id}
                  className={`p-3 rounded-xl border border-[var(--color-border-subtle)] ${
                    inactive ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 text-xs space-y-0.5">
                      <p className="font-medium text-sm text-[var(--color-text-primary)] truncate">
                        {link.noteTitle || t('editor.untitled')}
                      </p>
                      <p className="text-[var(--color-text-secondary)] truncate">
                        {link.label || link.path}
                      </p>
                      <p className="text-[var(--color-text-tertiary)]">
                        {link.hasPassword ? t('link_share.with_password') : t('link_share.no_password')}
                        {' · '}
                        {link.maxViews != null
                          ? t('link_share.views_used', {
                              used: link.viewCount,
                              max: link.maxViews,
                            })
                          : t('link_share.views_open', { count: link.viewCount })}
                        {inactive && ` · ${t('link_share.status_revoked')}`}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {!inactive && (
                        <button
                          type="button"
                          onClick={() => void copyLink(link.path)}
                          className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)]"
                        >
                          <IoCopyOutline className="w-4 h-4" />
                        </button>
                      )}
                      {!inactive && (
                        <button
                          type="button"
                          onClick={() => void revoke(link.id)}
                          className="p-1.5 rounded-lg hover:bg-[var(--color-error)]/10 text-[var(--color-error)]"
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
    </div>,
    document.body
  )
}
