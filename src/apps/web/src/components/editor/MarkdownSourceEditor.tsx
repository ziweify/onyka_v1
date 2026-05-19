import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { IoCheckmarkOutline, IoCloseOutline } from 'react-icons/io5'
import { htmlToMarkdown, markdownToHtml } from '@/utils/htmlMarkdown'

interface MarkdownSourceEditorProps {
  htmlContent: string
  onApply: (html: string) => void
  onCancel: () => void
  readOnly?: boolean
}

export function MarkdownSourceEditor({
  htmlContent,
  onApply,
  onCancel,
  readOnly = false,
}: MarkdownSourceEditorProps) {
  const { t } = useTranslation()
  const [markdown, setMarkdown] = useState(() => htmlToMarkdown(htmlContent))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMarkdown(htmlToMarkdown(htmlContent))
    setError(null)
  }, [htmlContent])

  const handleApply = () => {
    try {
      const html = markdownToHtml(markdown)
      onApply(html)
    } catch {
      setError(t('editor.markdown_invalid'))
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 editor-writing-surface">
      <div className="flex items-center justify-between gap-2 px-4 md:px-8 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]">
        <span className="text-[11px] font-medium text-[var(--color-text-tertiary)]">
          {t('editor.markdown_mode')}
        </span>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCancel}
              className="h-7 px-2.5 rounded-lg text-[11px] flex items-center gap-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <IoCloseOutline className="w-3.5 h-3.5" />
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="h-7 px-2.5 rounded-lg text-[11px] flex items-center gap-1 bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
            >
              <IoCheckmarkOutline className="w-3.5 h-3.5" />
              {t('editor.markdown_apply')}
            </button>
          </div>
        )}
      </div>
      <textarea
        value={markdown}
        onChange={(e) => {
          setMarkdown(e.target.value)
          setError(null)
        }}
        readOnly={readOnly}
        spellCheck={false}
        className="flex-1 w-full resize-none bg-transparent text-[var(--color-text-primary)] font-mono text-sm leading-relaxed px-4 md:px-8 py-4 focus:outline-none min-h-[200px]"
        placeholder={t('editor.markdown_placeholder')}
      />
      {error && (
        <p className="px-4 md:px-8 pb-2 text-xs text-red-500">{error}</p>
      )}
    </div>
  )
}
