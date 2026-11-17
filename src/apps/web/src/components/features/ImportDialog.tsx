import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { IoCloseOutline, IoCloudUploadOutline } from 'react-icons/io5'
import { notesApi, ApiException } from '@/services/api'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { ConfirmDialog } from './ConfirmDialog'
import { toast } from '@/components/ui/Toast'

interface ImportDialogProps {
  isOpen: boolean
  onClose: () => void
  folderId?: string | null
  /** Display path for the destination folder (e.g. "Work / Docs") */
  folderLabel?: string
  onImported: (noteId: string, title: string) => void
}

function detectFormat(filename: string, text: string): 'md' | 'html' {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html'
  if (/^\s*</.test(text)) return 'html'
  return 'md'
}

interface PendingImport {
  format: 'md' | 'html'
  content: string
  title: string
}

export function ImportDialog({
  isOpen,
  onClose,
  folderId,
  folderLabel,
  onImported,
}: ImportDialogProps) {
  const { t } = useTranslation()
  const focusTrapRef = useFocusTrap(isOpen)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingOverwrite, setPendingOverwrite] = useState<PendingImport | null>(null)

  const runImport = async (payload: PendingImport, overwrite: boolean) => {
    setImporting(true)
    setError(null)
    try {
      const { note } = await notesApi.import({
        format: payload.format,
        content: payload.content,
        title: payload.title || undefined,
        folderId: folderId ?? null,
        overwrite,
      })
      setPendingOverwrite(null)
      onImported(note.id, note.title)
      if (overwrite) {
        toast.success(t('import.overwrite_done', { title: note.title || payload.title }))
      } else {
        toast.success(t('import.success', { title: note.title || payload.title }))
      }
      onClose()
    } catch (err) {
      if (!overwrite && err instanceof ApiException && err.code === 'NAME_CONFLICT') {
        setPendingOverwrite(payload)
        return
      }
      if (err instanceof ApiException && err.code === 'NOTE_ENCRYPTED') {
        setError(t('import.error_encrypted'))
        setPendingOverwrite(null)
        return
      }
      console.error('[import] failed', err)
      setError(t('import.error'))
      setPendingOverwrite(null)
    } finally {
      setImporting(false)
    }
  }

  const handleFile = async (file: File) => {
    setError(null)
    setPendingOverwrite(null)
    setImporting(true)
    try {
      const text = await file.text()
      const format = detectFormat(file.name, text)
      const titleFromFile = file.name.replace(/\.(md|markdown|html?|txt)$/i, '').trim()
      if (format === 'html' && text.length > 40_000_000) {
        setError(t('import.error_too_large'))
        return
      }
      const payload: PendingImport = {
        format,
        content: text,
        title: titleFromFile || (format === 'html' ? '网页快照' : 'Imported note'),
      }
      await runImport(payload, false)
    } catch (err) {
      console.error('[import] failed', err)
      setError(t('import.error'))
      setImporting(false)
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
          className="relative w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {t('import.title')}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-[var(--color-bg-tertiary)]"
            >
              <IoCloseOutline className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">
            {t('import.description')}
          </p>
          {folderLabel != null && folderLabel !== '' && (
            <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
              {t('import.destination')}:{' '}
              <span className="font-medium text-[var(--color-text-secondary)]">{folderLabel}</span>
            </p>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.html,.htm,.txt,text/markdown,text/html"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
            className="w-full flex flex-col items-center gap-2 py-8 rounded-xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-50"
          >
            <IoCloudUploadOutline className="w-10 h-10 text-[var(--color-accent)]" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {importing ? t('common.loading') : t('import.choose_file')}
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              .md, .html（含 SingleFile）, .txt
            </span>
          </button>
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingOverwrite)}
        onClose={() => {
          if (importing) return
          setPendingOverwrite(null)
        }}
        onConfirm={() => {
          if (!pendingOverwrite) return
          void runImport(pendingOverwrite, true)
        }}
        title={t('import.overwrite_title')}
        message={t('import.overwrite_message', {
          title: pendingOverwrite?.title || '',
          folder: folderLabel || t('editor.path_root'),
        })}
        confirmLabel={t('import.overwrite_confirm')}
        cancelLabel={t('common.cancel')}
        variant="warning"
        isLoading={importing}
      />
    </>,
    document.body
  )
}
