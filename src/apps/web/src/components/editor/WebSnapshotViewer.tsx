import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IoOpenOutline, IoRefreshOutline } from 'react-icons/io5'
import { attachmentsApi } from '@/services/api'

interface WebSnapshotViewerProps {
  attachmentId: string
  title?: string
}

export function WebSnapshotViewer({ attachmentId, title }: WebSnapshotViewerProps) {
  const { t } = useTranslation()
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    const load = async () => {
      setLoading(true)
      setError(null)
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      try {
        const response = await fetch(attachmentsApi.downloadUrl(attachmentId), {
          credentials: 'include',
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const blob = await response.blob()
        const htmlBlob = blob.type.includes('html')
          ? blob
          : new Blob([blob], { type: 'text/html; charset=utf-8' })
        objectUrl = URL.createObjectURL(htmlBlob)
        if (!cancelled) setBlobUrl(objectUrl)
      } catch {
        if (!cancelled) setError(t('import.snapshot_load_error'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachmentId, reloadToken, t])

  const reload = () => setReloadToken((n) => n + 1)

  return (
    <div className="flex flex-col h-full min-h-[60vh] rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg-primary)]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <span className="text-xs text-[var(--color-text-tertiary)] shrink-0">
          {t('import.snapshot_badge')}
        </span>
        <span className="text-sm text-[var(--color-text-secondary)] truncate flex-1">
          {title || t('import.snapshot_title')}
        </span>
        <button
          type="button"
          onClick={reload}
          className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
          title={t('import.snapshot_reload')}
        >
          <IoRefreshOutline className="w-4 h-4" />
        </button>
        {blobUrl && (
          <a
            href={blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
            title={t('import.snapshot_open')}
          >
            <IoOpenOutline className="w-4 h-4" />
          </a>
        )}
      </div>

      <div className="relative flex-1 min-h-[50vh] bg-white">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--color-text-tertiary)] bg-[var(--color-bg-primary)]">
            {t('common.loading')}
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-red-500 bg-[var(--color-bg-primary)] px-4 text-center">
            {error}
          </div>
        )}
        {blobUrl && !error && (
          <iframe
            title={title || t('import.snapshot_title')}
            src={blobUrl}
            className="w-full h-full min-h-[70vh] border-0"
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    </div>
  )
}
