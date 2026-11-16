import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  IoCloseOutline,
  IoEyeOffOutline,
  IoEyeOutline,
  IoLockClosedOutline,
  IoReloadOutline,
} from 'react-icons/io5'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import {
  enableEncryption,
  unlockWithPassphrase,
} from '@/utils/noteCrypto'
import type { NoteEncryptionMeta } from '@onyka/shared'

interface NoteLockDialogProps {
  isOpen: boolean
  mode: 'enable' | 'unlock'
  noteTitle?: string
  meta?: NoteEncryptionMeta | null
  onClose: () => void
  onUnlocked: (dek: CryptoKey, meta: NoteEncryptionMeta) => void | Promise<void>
}

export function NoteLockDialog({
  isOpen,
  mode,
  noteTitle,
  meta,
  onClose,
  onUnlocked,
}: NoteLockDialogProps) {
  const { t } = useTranslation()
  const focusTrapRef = useFocusTrap(isOpen)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!isOpen) return null

  const reset = () => {
    setPassword('')
    setConfirm('')
    setShowPassword(false)
    setError(null)
    setBusy(false)
  }

  const inputType = showPassword ? 'text' : 'password'

  const handleClose = () => {
    if (busy) return
    reset()
    onClose()
  }

  const handleSubmit = async () => {
    setError(null)
    if (!password || password.length < 8) {
      setError(t('encryption.password_too_short'))
      return
    }
    if (mode === 'enable' && password !== confirm) {
      setError(t('encryption.password_mismatch'))
      return
    }
    setBusy(true)
    try {
      if (mode === 'enable') {
        const { dek, meta: newMeta } = await enableEncryption(password)
        await onUnlocked(dek, newMeta)
      } else {
        if (!meta) throw new Error('missing meta')
        const dek = await unlockWithPassphrase(password, meta)
        await onUnlocked(dek, meta)
      }
      reset()
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[NoteLock]', mode, err)
      if (msg === 'INSECURE_CONTEXT') {
        setError(t('encryption.insecure_context'))
      } else if (mode === 'unlock') {
        setError(t('encryption.unlock_failed'))
      } else {
        setError(
          msg && msg !== 'INSECURE_CONTEXT'
            ? `${t('encryption.enable_failed')}: ${msg}`
            : t('encryption.enable_failed')
        )
      }
      setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-label={t('common.close')}
      />
      <div
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl p-6"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              <IoLockClosedOutline className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                {mode === 'enable' ? t('encryption.enable_title') : t('encryption.unlock_title')}
              </h2>
              {noteTitle && (
                <p className="text-xs text-[var(--color-text-tertiary)] truncate mt-0.5">
                  {noteTitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-[var(--color-bg-tertiary)]"
          >
            <IoCloseOutline className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[var(--color-text-secondary)] mb-4 leading-relaxed">
          {mode === 'enable' ? t('encryption.enable_desc') : t('encryption.unlock_desc')}
        </p>

        <label className="block mb-3">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            {t('encryption.password_label')}
          </span>
          <div className="relative mt-1.5">
            <input
              type={inputType}
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && mode === 'unlock') void handleSubmit()
              }}
              className="w-full px-3 py-2 pr-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              placeholder={t('encryption.password_placeholder')}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
              title={showPassword ? t('encryption.hide_password') : t('encryption.show_password')}
              aria-label={showPassword ? t('encryption.hide_password') : t('encryption.show_password')}
            >
              {showPassword ? (
                <IoEyeOffOutline className="w-4 h-4" />
              ) : (
                <IoEyeOutline className="w-4 h-4" />
              )}
            </button>
          </div>
        </label>

        {mode === 'enable' && (
          <label className="block mb-3">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t('encryption.confirm_label')}
            </span>
            <div className="relative mt-1.5">
              <input
                type={inputType}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSubmit()
                }}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                placeholder={t('encryption.confirm_placeholder')}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
                title={showPassword ? t('encryption.hide_password') : t('encryption.show_password')}
                aria-label={showPassword ? t('encryption.hide_password') : t('encryption.show_password')}
              >
                {showPassword ? (
                  <IoEyeOffOutline className="w-4 h-4" />
                ) : (
                  <IoEyeOutline className="w-4 h-4" />
                )}
              </button>
            </div>
          </label>
        )}

        {error && <p className="mb-3 text-xs text-[var(--color-error)]">{error}</p>}

        <div className="flex gap-2 mt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={busy}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <IoReloadOutline className="w-4 h-4 animate-spin" />
                {t('common.loading')}
              </>
            ) : mode === 'enable' ? (
              t('encryption.enable_confirm')
            ) : (
              t('encryption.unlock_confirm')
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
