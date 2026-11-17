import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoCloseOutline, IoEyeOutline, IoReloadOutline, IoTimeOutline } from 'react-icons/io5'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { notesApi } from '@/services/api'
import { formatNoteDateTime } from '@/utils/format'
import type { NoteAccessLog } from '@onyka/shared'

interface NoteAccessHistoryDialogProps {
  isOpen: boolean
  noteId: string
  onClose: () => void
}

export function NoteAccessHistoryDialog({
  isOpen,
  noteId,
  onClose,
}: NoteAccessHistoryDialogProps) {
  const { t, i18n } = useTranslation()
  const focusTrapRef = useFocusTrap(isOpen)
  const [logs, setLogs] = useState<NoteAccessLog[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !noteId) return
    let cancelled = false
    setLoading(true)
    void notesApi
      .accessLogs(noteId, 50)
      .then(({ logs: list }) => {
        if (!cancelled) setLogs(list)
      })
      .catch(() => {
        if (!cancelled) setLogs([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, noteId])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
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
        aria-labelledby="note-access-title"
        className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 p-5 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              <IoEyeOutline className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="note-access-title"
                className="text-lg font-semibold text-[var(--color-text-primary)] truncate"
              >
                {t('editor.access_history')}
              </h2>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">
                {t('editor.access_history_desc')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
            aria-label={t('common.close')}
          >
            <IoCloseOutline className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
          <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <IoReloadOutline className="w-5 h-5 animate-spin text-[var(--color-text-tertiary)]" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-[var(--color-text-tertiary)]">
                <IoTimeOutline className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t('editor.access_history_empty')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border-subtle)] max-h-[min(50vh,28rem)] overflow-y-auto">
                {logs.map((log) => (
                  <li key={log.id} className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {log.name || log.username}
                      </p>
                      {log.name && (
                        <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                          @{log.username}
                        </p>
                      )}
                    </div>
                    <time className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap tabular-nums">
                      {formatNoteDateTime(log.accessedAt, i18n.language)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
