import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IoOpenOutline, IoRefreshOutline } from 'react-icons/io5'
import { attachmentsApi } from '@/services/api'

interface WebSnapshotViewerProps {
  attachmentId: string
  title?: string
  /** Override download URL (e.g. public share-link attachment endpoint). */
  downloadUrl?: string
  /** Extra classes on the outer frame (e.g. share page full-bleed height). */
  className?: string
  /** Iframe / content pane min-height override. */
  frameClassName?: string
  /**
   * Size the iframe to the snapshot document height so the parent page can
   * scroll (forum / share layout). Editor pane mode keeps internal scroll.
   */
  autoHeight?: boolean
}

function measureDocHeight(doc: Document | null | undefined): number {
  if (!doc) return 0
  const el = doc.documentElement
  const body = doc.body
  return Math.max(
    el?.scrollHeight ?? 0,
    el?.offsetHeight ?? 0,
    body?.scrollHeight ?? 0,
    body?.offsetHeight ?? 0,
    320
  )
}

export function WebSnapshotViewer({
  attachmentId,
  title,
  downloadUrl,
  className,
  frameClassName,
  autoHeight = false,
}: WebSnapshotViewerProps) {
  const { t } = useTranslation()
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)
  const [docHeight, setDocHeight] = useState(480)
  const iframeRef = useRef<HTMLIFrameElement>(null)

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
        const url = downloadUrl || attachmentsApi.downloadUrl(attachmentId)
        const response = await fetch(url, {
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
  }, [attachmentId, downloadUrl, reloadToken, t])

  const syncHeight = useCallback(() => {
    if (!autoHeight) return
    const doc = iframeRef.current?.contentDocument
    const next = measureDocHeight(doc)
    if (next > 0) setDocHeight(next)
  }, [autoHeight])

  useEffect(() => {
    if (!autoHeight || !blobUrl) return

    const iframe = iframeRef.current
    if (!iframe) return

    let ro: ResizeObserver | null = null
    let mo: MutationObserver | null = null
    let cancelled = false

    const attachObservers = () => {
      if (cancelled) return
      syncHeight()
      const doc = iframe.contentDocument
      if (!doc) return

      try {
        ro = new ResizeObserver(() => syncHeight())
        if (doc.documentElement) ro.observe(doc.documentElement)
        if (doc.body) ro.observe(doc.body)
      } catch {
        /* ignore */
      }

      try {
        mo = new MutationObserver(() => syncHeight())
        mo.observe(doc.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        })
      } catch {
        /* ignore */
      }

      doc.querySelectorAll('img').forEach((img) => {
        if (!img.complete) {
          img.addEventListener('load', syncHeight, { once: true })
          img.addEventListener('error', syncHeight, { once: true })
        }
      })
    }

    const onLoad = () => attachObservers()
    iframe.addEventListener('load', onLoad)
    // Already loaded (bfcache / cached blob)
    if (iframe.contentDocument?.readyState === 'complete') {
      attachObservers()
    }

    const onWinResize = () => syncHeight()
    window.addEventListener('resize', onWinResize)

    return () => {
      cancelled = true
      iframe.removeEventListener('load', onLoad)
      window.removeEventListener('resize', onWinResize)
      ro?.disconnect()
      mo?.disconnect()
    }
  }, [autoHeight, blobUrl, syncHeight, reloadToken])

  const reload = () => setReloadToken((n) => n + 1)

  const skipDefaultMinH =
    autoHeight ||
    className?.includes('min-h-0') ||
    className?.includes('!min-h-0')

  return (
    <div
      className={`flex flex-col rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-bg-primary)] ${
        autoHeight ? '' : 'h-full'
      } ${skipDefaultMinH ? '' : 'min-h-[60vh]'} ${className ?? ''}`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
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

      <div
        className={
          autoHeight
            ? `relative bg-white ${frameClassName ?? ''}`
            : `relative flex-1 bg-white ${frameClassName ?? 'min-h-[min(70vh,720px)]'}`
        }
        style={autoHeight ? { height: docHeight } : undefined}
      >
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
            ref={iframeRef}
            title={title || t('import.snapshot_title')}
            src={blobUrl}
            className={
              autoHeight
                ? 'block w-full border-0'
                : 'absolute inset-0 w-full h-full border-0'
            }
            style={autoHeight ? { height: docHeight } : undefined}
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            onLoad={syncHeight}
          />
        )}
      </div>
    </div>
  )
}
