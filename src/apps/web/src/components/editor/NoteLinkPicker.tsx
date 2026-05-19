import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { IoSearchOutline, IoDocumentTextOutline } from 'react-icons/io5'
import { notesApi, type SearchResult } from '@/services/api'
import { buildNoteLink } from '@/utils/noteLinks'

interface NoteLinkPickerProps {
  onSelect: (href: string, label: string) => void
  onCancel: () => void
  excludeNoteId?: string
}

export function NoteLinkPicker({ onSelect, onCancel, excludeNoteId }: NoteLinkPickerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const { results: list } = await notesApi.search(q.trim())
      setResults(list.filter((r) => r.id !== excludeNoteId).slice(0, 12))
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [excludeNoteId])

  useEffect(() => {
    const timer = setTimeout(() => void search(query), 250)
    return () => clearTimeout(timer)
  }, [query, search])

  return (
    <div className="flex flex-col gap-2 min-w-[220px] max-w-[280px]">
      <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-subtle)]">
        <IoSearchOutline className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('editor.note_link_search')}
          className="flex-1 bg-transparent text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none min-w-0"
          autoFocus
        />
      </div>
      <ul className="max-h-48 overflow-y-auto text-xs">
        {loading && (
          <li className="px-2 py-2 text-[var(--color-text-tertiary)]">{t('common.loading')}</li>
        )}
        {!loading && results.length === 0 && query.trim() && (
          <li className="px-2 py-2 text-[var(--color-text-tertiary)]">{t('editor.note_link_empty')}</li>
        )}
        {results.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className="w-full flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] text-left transition-colors"
              onClick={() => onSelect(buildNoteLink(r.id), r.title || t('editor.untitled'))}
            >
              <IoDocumentTextOutline className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--color-accent)]" />
              <span className="text-[var(--color-text-primary)] line-clamp-2">{r.title || t('editor.untitled')}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onCancel}
        className="text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] self-end px-1"
      >
        {t('common.cancel')}
      </button>
    </div>
  )
}
