import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  IoCloseOutline,
  IoRefreshOutline,
  IoAddOutline,
  IoGitCompareOutline,
  IoDocumentTextOutline,
} from 'react-icons/io5'
import type { NotePage, NoteVersion, NoteVersionSummary } from '@onyka/shared'
import { pagesApi } from '@/services/api'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { formatRelativeTime } from '@/utils/format'
import { buildTextDiff, type DiffLine } from '@/utils/textDiff'
interface VersionHistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
  noteId: string
  pageId?: string | null
  noteTitle: string
  currentPageTitle: string
  currentContent: string
  canEdit: boolean
  onRestored: (page: NotePage, noteTitle?: string) => void
}

type PanelMode = 'preview' | 'diff'

const ACTION_KEYS: Record<string, string> = {
  manual: 'versions.action_manual',
  checkpoint: 'versions.action_checkpoint',
  before_restore: 'versions.action_before_restore',
  restore: 'versions.action_restore',
}

function DiffView({ lines }: { lines: DiffLine[] }) {
  if (lines.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)] p-4">—</p>
    )
  }
  return (
    <pre className="text-xs font-mono leading-relaxed p-3 overflow-auto max-h-[50vh]">
      {lines.map((line, i) => (
        <span
          key={`${i}-${line.type}-${line.text.slice(0, 20)}`}
          className={`block whitespace-pre-wrap break-words px-2 py-0.5 rounded-sm ${
            line.type === 'added'
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : line.type === 'removed'
                ? 'bg-red-500/15 text-red-700 dark:text-red-300 line-through opacity-80'
                : 'text-[var(--color-text-secondary)]'
          }`}
        >
          {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
          {line.text || ' '}
        </span>
      ))}
    </pre>
  )
}

export function VersionHistoryDrawer({
  isOpen,
  onClose,
  noteId,
  pageId: pageIdProp,
  noteTitle,
  currentPageTitle,
  currentContent,
  canEdit,
  onRestored,
}: VersionHistoryDrawerProps) {
  const { t, i18n } = useTranslation()
  const focusTrapRef = useFocusTrap(isOpen)

  const [resolvedPageId, setResolvedPageId] = useState<string | null>(pageIdProp ?? null)
  const [resolvingPage, setResolvingPage] = useState(false)
  const [versions, setVersions] = useState<NoteVersionSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [compareId, setCompareId] = useState<string | null>(null)
  const [detail, setDetail] = useState<NoteVersion | null>(null)
  const [compareDetail, setCompareDetail] = useState<NoteVersion | null>(null)
  const [panelMode, setPanelMode] = useState<PanelMode>('preview')
  const [restoring, setRestoring] = useState(false)
  const [creating, setCreating] = useState(false)

  const loadList = useCallback(async (targetPageId: string) => {
    setLoading(true)
    try {
      const { versions: list } = await pagesApi.listVersions(targetPageId)
      setVersions(list)
      setSelectedId((prev) =>
        prev && list.some((v) => v.id === prev) ? prev : list[0]?.id ?? null
      )
    } catch {
      setVersions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setResolvedPageId(pageIdProp ?? null)
      setSelectedId(null)
      setCompareId(null)
      setDetail(null)
      setCompareDetail(null)
      setPanelMode('preview')
      setVersions([])
      return
    }
    let cancelled = false
    setResolvingPage(true)
    ;(async () => {
      let pid = pageIdProp ?? null
      if (!pid) {
        try {
          const { pages } = await pagesApi.list(noteId)
          pid = pages[0]?.id ?? null
        } catch {
          pid = null
        }
      }
      if (!cancelled) {
        setResolvedPageId(pid)
        setResolvingPage(false)
        if (pid) void loadList(pid)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, noteId, pageIdProp, loadList])

  useEffect(() => {
    if (!isOpen || !selectedId) {
      setDetail(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { version } = await pagesApi.getVersion(selectedId)
        if (!cancelled) setDetail(version)
      } catch {
        if (!cancelled) setDetail(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, selectedId])

  useEffect(() => {
    if (!isOpen || !compareId || panelMode !== 'diff') {
      setCompareDetail(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { version } = await pagesApi.getVersion(compareId)
        if (!cancelled) setCompareDetail(version)
      } catch {
        if (!cancelled) setCompareDetail(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen, compareId, panelMode])

  const diffLines = useMemo(() => {
    if (panelMode !== 'diff' || !detail) return []
    const newer = compareDetail ?? {
      content: currentContent,
      pageTitle: currentPageTitle,
      noteTitle,
    } as Pick<NoteVersion, 'content'>
    const older = detail
    return buildTextDiff(older.content, newer.content)
  }, [panelMode, detail, compareDetail, currentContent, currentPageTitle, noteTitle])

  const handleCreateSnapshot = async () => {
    if (!resolvedPageId) return
    setCreating(true)
    try {
      await pagesApi.createVersion(resolvedPageId, { action: 'manual' })
      await loadList(resolvedPageId)
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async () => {
    if (!selectedId || !canEdit || !resolvedPageId) return
    const ok = window.confirm(t('versions.restore_confirm'))
    if (!ok) return
    setRestoring(true)
    try {
      const { page } = await pagesApi.restoreVersion(selectedId)
      const restored = versions.find((v) => v.id === selectedId)
      onRestored(page, restored?.noteTitle)
      await loadList(resolvedPageId)
    } finally {
      setRestoring(false)
    }
  }

  if (!isOpen) return null

  if (resolvingPage || (loading && !resolvedPageId)) {
    return createPortal(
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label={t('common.close')} />
        <div className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-6 py-8 text-sm text-[var(--color-text-secondary)]">
          {t('common.loading')}
        </div>
      </div>,
      document.body
    )
  }

  if (!resolvedPageId) {
    return createPortal(
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label={t('common.close')} />
        <div className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6 max-w-sm text-center">
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">{t('versions.no_page')}</p>
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg bg-[var(--color-accent)] text-white text-sm">
            {t('common.close')}
          </button>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-stretch justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <aside
        ref={focusTrapRef}
        className="relative w-full max-w-3xl h-full bg-[var(--color-bg-secondary)] border-l border-[var(--color-border)] shadow-2xl flex flex-col animate-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-history-title"
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border-subtle)] shrink-0">
          <div className="min-w-0">
            <h2 id="version-history-title" className="text-base font-semibold text-[var(--color-text-primary)]">
              {t('versions.title')}
            </h2>
            <p className="text-xs text-[var(--color-text-tertiary)] truncate">
              {currentPageTitle || t('editor.untitled')}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && (
              <button
                type="button"
                onClick={() => void handleCreateSnapshot()}
                disabled={creating}
                className="h-8 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border-subtle)] disabled:opacity-50"
              >
                <IoAddOutline className="w-3.5 h-3.5" />
                {t('versions.save_snapshot')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
            >
              <IoCloseOutline className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex min-h-0">
          <div className="w-56 sm:w-64 border-r border-[var(--color-border-subtle)] flex flex-col shrink-0">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
              {t('versions.list_heading')}
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="px-3 py-4 text-xs text-[var(--color-text-secondary)]">{t('common.loading')}</p>
              ) : versions.length === 0 ? (
                <p className="px-3 py-4 text-xs text-[var(--color-text-secondary)]">{t('versions.empty')}</p>
              ) : (
                <ul className="py-1">
                  {versions.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(v.id)
                          setPanelMode('preview')
                        }}
                        className={`w-full text-left px-3 py-2.5 border-l-2 transition-colors ${
                          selectedId === v.id
                            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/8'
                            : 'border-transparent hover:bg-[var(--color-bg-tertiary)]'
                        }`}
                      >
                        <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                          {formatRelativeTime(v.createdAt, i18n.language, t)}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                          {t(ACTION_KEYS[v.action] ?? 'versions.action_manual')}
                          {' · '}
                          {v.createdBy.name || v.createdBy.username}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-tertiary)]">
                          {v.wordCount} {t('editor.info_words').toLowerCase()}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--color-border-subtle)] shrink-0">
              <button
                type="button"
                onClick={() => setPanelMode('preview')}
                className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1 ${
                  panelMode === 'preview'
                    ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                }`}
              >
                <IoDocumentTextOutline className="w-3.5 h-3.5" />
                {t('versions.preview')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPanelMode('diff')
                  if (!compareId && versions.length > 1 && selectedId) {
                    const other = versions.find((v) => v.id !== selectedId)
                    if (other) setCompareId(other.id)
                  }
                }}
                disabled={!selectedId}
                className={`h-7 px-2.5 rounded-md text-xs font-medium flex items-center gap-1 disabled:opacity-40 ${
                  panelMode === 'diff'
                    ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                }`}
              >
                <IoGitCompareOutline className="w-3.5 h-3.5" />
                {t('versions.diff')}
              </button>
            </div>

            {panelMode === 'diff' && selectedId && (
              <div className="px-3 py-2 flex flex-wrap items-center gap-2 text-xs border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)]/50">
                <span className="text-[var(--color-text-tertiary)]">{t('versions.compare_old')}</span>
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="h-7 px-2 rounded-md bg-[var(--color-bg-tertiary)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] max-w-[140px]"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {formatRelativeTime(v.createdAt, i18n.language, t)}
                    </option>
                  ))}
                </select>
                <span className="text-[var(--color-text-tertiary)]">{t('versions.compare_new')}</span>
                <select
                  value={compareId ?? 'current'}
                  onChange={(e) =>
                    setCompareId(e.target.value === 'current' ? null : e.target.value)
                  }
                  className="h-7 px-2 rounded-md bg-[var(--color-bg-tertiary)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] max-w-[140px]"
                >
                  <option value="current">{t('versions.current')}</option>
                  {versions
                    .filter((v) => v.id !== selectedId)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {formatRelativeTime(v.createdAt, i18n.language, t)}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {panelMode === 'preview' ? (
                detail ? (
                  <article className="p-4 prose prose-sm max-w-none fluid-editor-content">
                    <div
                      className="text-[var(--color-text-primary)]"
                      dangerouslySetInnerHTML={{ __html: detail.content }}
                    />
                  </article>
                ) : (
                  <p className="p-4 text-sm text-[var(--color-text-secondary)]">
                    {selectedId ? t('common.loading') : t('versions.select_hint')}
                  </p>
                )
              ) : (
                <div>
                  <p className="px-3 pt-2 text-[10px] text-[var(--color-text-tertiary)]">
                    {t('versions.diff_plain_hint')}
                  </p>
                  <DiffView lines={diffLines} />
                </div>
              )}
            </div>

            {canEdit && selectedId && panelMode === 'preview' && (
              <footer className="px-4 py-3 border-t border-[var(--color-border-subtle)] shrink-0">
                <button
                  type="button"
                  onClick={() => void handleRestore()}
                  disabled={restoring}
                  className="w-full h-9 rounded-lg text-sm font-medium flex items-center justify-center gap-2 bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  <IoRefreshOutline className="w-4 h-4" />
                  {restoring ? t('common.loading') : t('versions.restore')}
                </button>
              </footer>
            )}
          </div>
        </div>
      </aside>
    </div>,
    document.body
  )
}
