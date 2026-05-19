import type { Attachment, UploadSessionInfo } from '@onyka/shared'
import { attachmentsApi } from '@/services/api'
import { computeUploadFingerprint } from './uploadFingerprint'

/** Network chunk size only; server stores one complete file. */
export const UPLOAD_CHUNK_BYTES = 2 * 1024 * 1024

export interface ResumableUploadProgress {
  loaded: number
  total: number
  percent: number
}

export interface ResumableUploadOptions {
  noteId: string
  file: File
  onProgress?: (p: ResumableUploadProgress) => void
  signal?: AbortSignal
}

export async function uploadFileResumable(
  options: ResumableUploadOptions
): Promise<Attachment> {
  const { noteId, file, onProgress, signal } = options
  const fingerprint = await computeUploadFingerprint(file)
  const total = file.size

  const report = (loaded: number) => {
    onProgress?.({
      loaded,
      total,
      percent: total > 0 ? Math.round((loaded / total) * 100) : 100,
    })
  }

  let session: UploadSessionInfo | null = null

  const resume = await attachmentsApi.resumeSession(noteId, {
    fingerprint,
    originalName: file.name,
    totalSize: total,
  })
  session = resume.session

  if (!session) {
    const created = await attachmentsApi.createSession(noteId, {
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      totalSize: total,
      fingerprint,
    })
    session = created.session
  }

  if (signal?.aborted) {
    await attachmentsApi.abortSession(noteId, session.sessionId).catch(() => {})
    throw new DOMException('Upload aborted', 'AbortError')
  }

  let offset = session.receivedBytes
  report(offset)

  while (offset < total) {
    if (signal?.aborted) {
      await attachmentsApi.abortSession(noteId, session.sessionId).catch(() => {})
      throw new DOMException('Upload aborted', 'AbortError')
    }

    const end = Math.min(offset + UPLOAD_CHUNK_BYTES - 1, total - 1)
    const chunk = file.slice(offset, end + 1)
    const buffer = await chunk.arrayBuffer()

    const result = await attachmentsApi.uploadChunk(
      noteId,
      session.sessionId,
      fingerprint,
      offset,
      end,
      total,
      buffer
    )

    offset = result.receivedBytes
    report(offset)

    if (result.complete && result.attachment) {
      return result.attachment
    }

    if (result.complete && !result.attachment) {
      const done = await attachmentsApi.completeSession(noteId, session.sessionId, fingerprint)
      return done.attachment
    }
  }

  const done = await attachmentsApi.completeSession(noteId, session.sessionId, fingerprint)
  return done.attachment
}
