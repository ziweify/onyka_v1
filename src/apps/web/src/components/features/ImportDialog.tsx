import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { IoCloseOutline, IoCloudUploadOutline } from 'react-icons/io5'
import { notesApi } from '@/services/api'
import { useFocusTrap } from '@/hooks/useFocusTrap'

interface ImportDialogProps {
  isOpen: boolean
  onClose: () => void
  folderId?: string | null
  onImported: (noteId: string, title: string) => void
}

function detectFormat(filename: string, text: string): 'md' | 'html' {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md'
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html'
  if (/^\s*</.test(text)) return 'html'
  return 'md'
}

export function ImportDialog({ isOpen, onClose, folderId, onImported }: ImportDialogProps) {
  const { t } = useTranslation()
  const focusTrapRef = useFocusTrap(isOpen)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setError(null)
    setImporting(true)
    try {
      const text = await file.text()
      const format = detectFormat(file.name, text)
      const titleFromFile = file.name.replace(/\.(md|markdown|html?|txt)$/i, '').trim()
      const { note } = await notesApi.import({
        format,
        content: text,
        title: titleFromFile || undefined,
        folderId: folderId ?? null,
      })
      onImported(note.id, note.title)
      onClose()
    } catch {
      setError(t('import.error'))
    } finally {
      setImporting(false)
    }
  }

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
        className="relative w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('import.title')}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--color-bg-tertiary)]">
            <IoCloseOutline className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">{t('import.description')}</p>
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
          <span className="text-xs text-[var(--color-text-tertiary)]">.md, .html, .txt</span>
        </button>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>
    </div>,
    document.body
  )
}
