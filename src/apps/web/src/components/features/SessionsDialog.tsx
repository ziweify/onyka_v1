import { createPortal } from 'react-dom'
import { IoCloseOutline, IoPhonePortraitOutline } from 'react-icons/io5'
import { useTranslation } from 'react-i18next'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { SessionsManager } from './SessionsManager'

interface SessionsDialogProps {
  isOpen: boolean
  onClose: () => void
  onSessionsChanged?: () => void
}

export function SessionsDialog({ isOpen, onClose, onSessionsChanged }: SessionsDialogProps) {
  const { t } = useTranslation()
  const focusTrapRef = useFocusTrap(isOpen)

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
        aria-labelledby="sessions-dialog-title"
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              <IoPhonePortraitOutline className="w-5 h-5" />
            </div>
            <h2
              id="sessions-dialog-title"
              className="text-lg font-semibold text-[var(--color-text-primary)] truncate"
            >
              {t('sessions.title')}
            </h2>
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
        <SessionsManager onSessionRevoked={onSessionsChanged} />
      </div>
    </div>,
    document.body
  )
}
