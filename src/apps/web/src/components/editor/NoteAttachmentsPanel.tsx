import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  IoAttachOutline,
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoCloudUploadOutline,
  IoCopyOutline,
  IoDownloadOutline,
  IoTrashOutline,
  IoCloseCircleOutline,
} from 'react-icons/io5'
import type { Attachment } from '@onyka/shared'
import { attachmentsApi, ApiException } from '@/services/api'
import { uploadFileResumable, type ResumableUploadProgress } from '@/utils/resumableUpload'

interface NoteAttachmentsPanelProps {
  noteId: string
  canEdit: boolean
  open: boolean
  variant?: 'sidebar' | 'drawer'
  embedded?: boolean
  onCountChange?: (count: number) => void
}

interface UploadingItem {
  id: string
  name: string
  progress: ResumableUploadProgress
  error?: string
  abort: AbortController
}

function attachmentIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼'
  if (mime.includes('pdf')) return '📄'
  if (mime.includes('zip') || mime.includes('compressed')) return '📦'
  if (mime.startsWith('video/')) return '🎬'
  if (mime.startsWith('audio/')) return '🎵'
  return '📎'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function NoteAttachmentsPanel({
  noteId,
  canEdit,
  open,
  variant = 'sidebar',
  embedded = false,
  onCountChange,
}: NoteAttachmentsPanelProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [uploading, setUploading] = useState<UploadingItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { attachments } = await attachmentsApi.list(noteId)
      const ready = attachments.filter((a) => a.status === 'ready')
      setItems(ready)
      onCountChange?.(ready.length)
    } catch {
      setItems([])
      onCountChange?.(0)
    } finally {
      setLoading(false)
    }
  }, [noteId, onCountChange])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const startUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!canEdit) return
      for (const file of [...files]) {
        const abort = new AbortController()
        const tempId = `up-${Date.now()}-${Math.random()}`
        setUploading((u) => [
          ...u,
          {
            id: tempId,
            name: file.name,
            progress: { loaded: 0, total: file.size, percent: 0 },
            abort,
          },
        ])
        try {
          await uploadFileResumable({
            noteId,
            file,
            signal: abort.signal,
            onProgress: (p) => {
              setUploading((prev) =>
                prev.map((x) => (x.id === tempId ? { ...x, progress: p } : x))
              )
            },
          })
          setUploading((prev) => prev.filter((x) => x.id !== tempId))
          await load()
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            setUploading((prev) => prev.filter((x) => x.id !== tempId))
            continue
          }
          const message =
            err instanceof ApiException
              ? err.code === 'FILE_CHANGED'
                ? t('attachments.file_changed')
                : err.message
              : t('attachments.upload_failed')
          setUploading((prev) =>
            prev.map((x) => (x.id === tempId ? { ...x, error: message } : x))
          )
        }
      }
    },
    [canEdit, noteId, load, t]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length > 0) void startUpload(e.dataTransfer.files)
    },
    [startUpload]
  )

  const copyLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(attachmentsApi.copyLink(id))
    } catch {
      await navigator.clipboard.writeText(attachmentsApi.downloadUrl(id))
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('attachments.delete_confirm'))) return
    await attachmentsApi.delete(id)
    await load()
  }

  if (!open) return null

  const shellClass = embedded
    ? 'flex flex-col flex-1 min-h-0 overflow-hidden'
    : `document-outline-panel note-attachments-panel rounded-xl backdrop-blur-sm overflow-hidden flex flex-col ${
        variant === 'drawer' ? 'w-full max-h-[50vh]' : 'w-44 xl:w-56 max-h-[min(65vh,32rem)]'
      }`

  const body = (
    <div className={shellClass}>
      {!embedded && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="document-outline-header w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-semibold transition-colors shrink-0"
        >
          <IoAttachOutline className="document-outline-header-icon w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left truncate">{t('attachments.title')}</span>
          <span className="document-outline-count text-[10px] tabular-nums">{items.length}</span>
          {collapsed ? (
            <IoChevronDownOutline className="w-3.5 h-3.5 opacity-70" />
          ) : (
            <IoChevronUpOutline className="w-3.5 h-3.5 opacity-70" />
          )}
        </button>
      )}

      {(!collapsed || embedded) && (
        <>
          {canEdit && (
            <div
              className={`mx-2 mb-2 rounded-lg border border-dashed px-3 py-3 text-center transition-colors ${
                dragOver
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'border-[var(--color-border-subtle)]'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) void startUpload(e.target.files)
                  e.target.value = ''
                }}
              />
              <IoCloudUploadOutline className="w-5 h-5 mx-auto mb-1 text-[var(--color-text-tertiary)]" />
              <p className="text-[10px] text-[var(--color-text-tertiary)] leading-snug mb-2">
                {t('attachments.drop_hint')}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] font-medium px-2 py-1 rounded-md bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
              >
                {t('attachments.upload')}
              </button>
            </div>
          )}

          {uploading.length > 0 && (
            <ul className="px-2 pb-2 space-y-1.5 shrink-0">
              {uploading.map((u) => (
                <li
                  key={u.id}
                  className="rounded-md px-2 py-1.5 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-subtle)]"
                >
                  <div className="flex items-center gap-1.5 text-[10px] min-w-0">
                    <span className="truncate flex-1" title={u.name}>
                      {u.name}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-[var(--color-text-tertiary)] hover:text-[var(--color-error)]"
                      onClick={() => u.abort.abort()}
                      title={t('attachments.cancel')}
                    >
                      <IoCloseCircleOutline className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {u.error ? (
                    <p className="text-[9px] text-[var(--color-error)] mt-1">{u.error}</p>
                  ) : (
                    <div className="mt-1 h-1 rounded-full bg-[var(--color-border-subtle)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--color-accent)] transition-all"
                        style={{ width: `${u.progress.percent}%` }}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {loading ? (
            <p className="document-outline-empty px-3 pb-3 text-[11px]">{t('common.loading')}</p>
          ) : items.length === 0 && uploading.length === 0 ? (
            <p className="document-outline-empty px-3 pb-3 text-[11px] leading-relaxed">
              {t('attachments.empty')}
            </p>
          ) : (
            <ul className="px-2 py-1 overflow-y-auto flex-1 text-[11px] min-h-0 space-y-0.5">
              {items.map((att) => (
                <li
                  key={att.id}
                  className="group rounded-md px-2 py-1.5 hover:bg-[var(--color-bg-tertiary)] border border-transparent hover:border-[var(--color-border-subtle)]"
                >
                  <div className="flex items-start gap-1.5 min-w-0">
                    <span className="shrink-0 text-sm leading-none pt-0.5">
                      {attachmentIcon(att.mimeType)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="truncate font-medium text-[var(--color-text-primary)]"
                        title={att.originalName}
                      >
                        {att.originalName}
                      </p>
                      <p className="text-[9px] text-[var(--color-text-tertiary)] tabular-nums">
                        {formatBytes(att.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 mt-1 opacity-80 group-hover:opacity-100">
                    <a
                      href={attachmentsApi.downloadUrl(att.id)}
                      download={att.originalName}
                      className="p-1 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
                      title={t('attachments.download')}
                    >
                      <IoDownloadOutline className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => void copyLink(att.id)}
                      className="p-1 rounded hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]"
                      title={t('attachments.copy_link')}
                    >
                      <IoCopyOutline className="w-3.5 h-3.5" />
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(att.id)}
                        className="p-1 rounded hover:bg-[var(--color-error)]/15 text-[var(--color-text-secondary)] hover:text-[var(--color-error)]"
                        title={t('common.delete')}
                      >
                        <IoTrashOutline className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )

  if (embedded) {
    return <div className="flex-1 min-h-0 overflow-hidden">{body}</div>
  }

  if (variant === 'drawer') {
    return <nav aria-label={t('attachments.title')}>{body}</nav>
  }

  return (
    <nav
      className="hidden lg:block absolute right-2 xl:right-4 top-16 z-10"
      aria-label={t('attachments.title')}
    >
      {body}
    </nav>
  )
}
