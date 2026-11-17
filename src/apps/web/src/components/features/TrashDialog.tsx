import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IoCloseOutline,
  IoRefreshOutline,
  IoReloadOutline,
  IoTrashOutline,
} from 'react-icons/io5'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { notesApi, ApiException } from '@/services/api'
import { useFoldersStore } from '@/stores/folders'
import { toast } from '@/components/ui/Toast'
import { ConfirmDialog } from './ConfirmDialog'
import {
  isSensitiveReauthValid,
  markSensitiveReauth,
} from '@/utils/sensitiveReauth'
import type { Note } from '@onyka/shared'

interface TrashDialogProps {
  isOpen: boolean
  onClose: () => void
  onChanged?: () => void
}

function getDaysRemaining(deletedAt: Date | null) {
  if (!deletedAt) return 30
  const deleted = deletedAt instanceof Date ? deletedAt : new Date(deletedAt)
  const diffMs = 30 * 24 * 60 * 60 * 1000 - (Date.now() - deleted.getTime())
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)))
}

export function TrashDialog({ isOpen, onClose, onChanged }: TrashDialogProps) {
  const { t } = useTranslation()
  const focusTrapRef = useFocusTrap(isOpen)
  const { fetchFolderTree } = useFoldersStore()

  const [deletedNotes, setDeletedNotes] = useState<Note[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [showEmptyDialog, setShowEmptyDialog] = useState(false)
  const [isEmptying, setIsEmptying] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [needsPassword, setNeedsPassword] = useState(true)

  const fetchDeletedNotes = useCallback(async () => {
    setIsLoading(true)
    try {
      const { notes } = await notesApi.list({ deleted: true })
      setDeletedNotes(notes)
    } catch {
      setDeletedNotes([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    void fetchDeletedNotes()
  }, [isOpen, fetchDeletedNotes])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showEmptyDialog) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose, showEmptyDialog])

  const handleRestore = async (noteId: string) => {
    const noteToRestore = deletedNotes.find((n) => n.id === noteId)
    setDeletedNotes((prev) => prev.filter((n) => n.id !== noteId))
    setRestoringId(noteId)
    try {
      await notesApi.restore(noteId)
      fetchFolderTree()
      onChanged?.()
      toast.success(t('settings.trash.restored'))
    } catch {
      if (noteToRestore) setDeletedNotes((prev) => [...prev, noteToRestore])
      toast.error(t('settings.trash.restore_error'))
    } finally {
      setRestoringId(null)
    }
  }

  const openEmptyDialog = () => {
    setNeedsPassword(!isSensitiveReauthValid())
    setPassword('')
    setPasswordError(null)
    setShowEmptyDialog(true)
  }

  const handleEmptyTrash = async () => {
    if (needsPassword && !password.trim()) {
      setPasswordError(t('settings.trash.password_required'))
      return
    }
    setIsEmptying(true)
    setPasswordError(null)
    try {
      const result = await notesApi.emptyTrash(needsPassword ? password : undefined)
      if (result.reauthExpiresAt) markSensitiveReauth(result.reauthExpiresAt)
      setDeletedNotes([])
      setShowEmptyDialog(false)
      setPassword('')
      onChanged?.()
      toast.success(t('settings.trash.emptied'))
    } catch (err) {
      if (err instanceof ApiException && err.code === 'INVALID_PASSWORD') {
        setPasswordError(t('settings.trash.password_incorrect'))
      } else if (err instanceof ApiException && err.code === 'REAUTH_REQUIRED') {
        setNeedsPassword(true)
        setPasswordError(t('settings.trash.password_required'))
      } else {
        toast.error(t('settings.trash.empty_error'))
        setShowEmptyDialog(false)
      }
    } finally {
      setIsEmptying(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
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
          aria-labelledby="trash-dialog-title"
          className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3 p-5 pb-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]">
                <IoTrashOutline className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2
                  id="trash-dialog-title"
                  className="text-lg font-semibold text-[var(--color-text-primary)] truncate"
                >
                  {t('settings.trash.title')}
                </h2>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                  {t('settings.trash.description')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {deletedNotes.length > 0 && (
                <button
                  type="button"
                  onClick={openEmptyDialog}
                  className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors"
                >
                  {t('settings.trash.empty')}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
                aria-label={t('common.close')}
              >
                <IoCloseOutline className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
            <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <IoReloadOutline className="w-5 h-5 animate-spin text-[var(--color-text-tertiary)]" />
                </div>
              ) : deletedNotes.length === 0 ? (
                <div className="text-center py-12 text-[var(--color-text-tertiary)]">
                  <IoTrashOutline className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t('settings.trash.empty_state')}</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border-subtle)] max-h-[min(50vh,28rem)] overflow-y-auto">
                  {deletedNotes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-center justify-between gap-2 p-3 hover:bg-[var(--color-bg-tertiary)] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--color-text-primary)] truncate text-sm">
                          {note.title || t('editor.untitled')}
                        </p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {t('settings.trash.days_remaining', {
                            n: getDaysRemaining(note.deletedAt),
                          })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRestore(note.id)}
                        disabled={restoringId === note.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        {restoringId === note.id ? (
                          <IoReloadOutline className="w-4 h-4 animate-spin" />
                        ) : (
                          <IoRefreshOutline className="w-4 h-4" />
                        )}
                        <span>{t('settings.trash.restore')}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showEmptyDialog}
        onClose={() => {
          if (isEmptying) return
          setShowEmptyDialog(false)
          setPassword('')
          setPasswordError(null)
        }}
        onConfirm={handleEmptyTrash}
        title={t('settings.trash.empty_confirm_title')}
        message={t('settings.trash.empty_confirm_message', { count: deletedNotes.length })}
        confirmLabel={t('settings.trash.empty')}
        isLoading={isEmptying}
      >
        {needsPassword ? (
          <div className="mt-4 text-left space-y-2">
            <label className="block text-xs text-[var(--color-text-secondary)]">
              {t('settings.trash.password_label')}
            </label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setPasswordError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleEmptyTrash()
              }}
              placeholder={t('settings.trash.password_placeholder')}
              className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm"
            />
            {passwordError && (
              <p className="text-xs text-[var(--color-error)]">{passwordError}</p>
            )}
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              {t('settings.trash.password_hint')}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
            {t('settings.trash.reauth_valid')}
          </p>
        )}
      </ConfirmDialog>
    </>,
    document.body
  )
}
