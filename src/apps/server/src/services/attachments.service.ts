import {
  existsSync,
  mkdirSync,
  unlinkSync,
  statSync,
  readFileSync,
  writeFileSync,
  openSync,
  closeSync,
  writeSync,
} from 'fs'
import { join, dirname, resolve } from 'path'
import { createHash } from 'crypto'
import { env } from '../config/env.js'
import { attachmentRepository } from '../repositories/attachment.repository.js'
import { uploadSessionRepository } from '../repositories/upload-session.repository.js'
import { noteAttachmentRepository } from '../repositories/note-attachment.repository.js'
import { shareRepository } from '../repositories/share.repository.js'
import { noteRepository } from '../repositories/note.repository.js'
import { encryptBuffer, decryptBuffer } from '../utils/crypto.js'
import type { Attachment, CreateUploadSessionInput } from '@onyka/shared'

const dataDir = resolve(dirname(env.DATABASE_URL))
const ATTACHMENTS_ROOT = join(dataDir, 'attachments')

if (!existsSync(ATTACHMENTS_ROOT)) {
  mkdirSync(ATTACHMENTS_ROOT, { recursive: true, mode: 0o755 })
}

export class AttachmentsServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'AttachmentsServiceError'
  }
}

function noteDir(noteId: string): string {
  const dir = join(ATTACHMENTS_ROOT, 'notes', noteId)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o755 })
  }
  return dir
}

function uploadingPath(noteId: string, attachmentId: string): string {
  return join(noteDir(noteId), `${attachmentId}.uploading`)
}

function finalPath(noteId: string, attachmentId: string): string {
  return join(noteDir(noteId), attachmentId)
}

function sanitizeAttachmentId(id: string): string | null {
  const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, '')
  return sanitized === id ? sanitized : null
}

export class AttachmentsService {
  constructor() {
    void uploadSessionRepository.deleteExpired()
  }

  private async assertNoteEdit(noteId: string, userId: string): Promise<void> {
    const note = await noteRepository.findById(noteId)
    if (!note) {
      throw new AttachmentsServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }
    if (note.ownerId === userId) return
    const canEdit = await shareRepository.hasAccess(userId, noteId, 'note', 'edit')
    if (!canEdit) {
      throw new AttachmentsServiceError('Access denied', 'ACCESS_DENIED', 403)
    }
  }

  private async assertNoteRead(noteId: string, userId: string): Promise<void> {
    const note = await noteRepository.findById(noteId)
    if (!note) {
      throw new AttachmentsServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }
    if (note.ownerId === userId) return
    const canRead = await shareRepository.hasAccess(userId, noteId, 'note', 'read')
    if (!canRead) {
      throw new AttachmentsServiceError('Access denied', 'ACCESS_DENIED', 403)
    }
  }

  async listForNote(noteId: string, userId: string): Promise<Attachment[]> {
    await this.assertNoteRead(noteId, userId)
    return attachmentRepository.listForNote(noteId)
  }

  async createSession(
    noteId: string,
    userId: string,
    input: CreateUploadSessionInput
  ): Promise<{ session: import('@onyka/shared').UploadSessionInfo; attachment: Attachment }> {
    await this.assertNoteEdit(noteId, userId)

    if (!input.originalName?.trim()) {
      throw new AttachmentsServiceError('Invalid file name', 'INVALID_INPUT', 400)
    }
    if (input.totalSize < 0 || !Number.isFinite(input.totalSize)) {
      throw new AttachmentsServiceError('Invalid file size', 'INVALID_INPUT', 400)
    }
    if (!input.fingerprint?.trim()) {
      throw new AttachmentsServiceError('Fingerprint required', 'INVALID_INPUT', 400)
    }

    const attachment = await attachmentRepository.create({
      homeNoteId: noteId,
      originalName: input.originalName.trim(),
      mimeType: input.mimeType || 'application/octet-stream',
      size: input.totalSize,
      fingerprint: input.fingerprint,
      ownerId: userId,
      status: 'uploading',
    })

    await attachmentRepository.linkToNote(noteId, attachment.id)

    const tempPath = uploadingPath(noteId, attachment.id)
    if (existsSync(tempPath)) {
      unlinkSync(tempPath)
    }
    writeFileSync(tempPath, Buffer.alloc(0))

    const session = await uploadSessionRepository.create({
      attachmentId: attachment.id,
      ownerId: userId,
      homeNoteId: noteId,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      totalSize: input.totalSize,
      fingerprint: input.fingerprint,
    })

    return { session, attachment }
  }

  /**
   * Resume or continue upload. Fingerprint must match session; offset must match received_bytes.
   */
  async appendChunk(
    sessionId: string,
    userId: string,
    fingerprint: string,
    offset: number,
    data: Buffer
  ): Promise<{ receivedBytes: number; complete: boolean }> {
    const sessionRow = await uploadSessionRepository.findById(sessionId)
    if (!sessionRow || sessionRow.status !== 'active') {
      throw new AttachmentsServiceError('Upload session not found', 'SESSION_NOT_FOUND', 404)
    }
    if (sessionRow.ownerId !== userId) {
      throw new AttachmentsServiceError('Access denied', 'ACCESS_DENIED', 403)
    }
    if (sessionRow.expiresAt < new Date()) {
      throw new AttachmentsServiceError('Upload session expired', 'SESSION_EXPIRED', 410)
    }
    if (sessionRow.fingerprint !== fingerprint) {
      throw new AttachmentsServiceError(
        'File changed since upload started. Please upload again.',
        'FILE_CHANGED',
        409
      )
    }

    if (offset !== sessionRow.receivedBytes) {
      throw new AttachmentsServiceError(
        `Expected offset ${sessionRow.receivedBytes}, got ${offset}`,
        'INVALID_OFFSET',
        409
      )
    }

    const newReceived = offset + data.length
    if (newReceived > sessionRow.totalSize) {
      throw new AttachmentsServiceError('Upload exceeds declared size', 'SIZE_MISMATCH', 400)
    }

    const tempPath = uploadingPath(sessionRow.homeNoteId, sessionRow.attachmentId)
    if (!existsSync(tempPath)) {
      throw new AttachmentsServiceError('Upload file missing', 'UPLOAD_FAILED', 500)
    }

    const fd = openSync(tempPath, 'r+')
    try {
      writeSync(fd, data, 0, data.length, offset)
    } finally {
      closeSync(fd)
    }

    await uploadSessionRepository.updateReceivedBytes(sessionId, newReceived)

    const complete = newReceived === sessionRow.totalSize
    return { receivedBytes: newReceived, complete }
  }

  async completeSession(
    sessionId: string,
    userId: string,
    fingerprint: string
  ): Promise<Attachment> {
    const sessionRow = await uploadSessionRepository.findById(sessionId)
    if (!sessionRow) {
      throw new AttachmentsServiceError('Upload session not found', 'SESSION_NOT_FOUND', 404)
    }
    if (sessionRow.ownerId !== userId) {
      throw new AttachmentsServiceError('Access denied', 'ACCESS_DENIED', 403)
    }
    if (sessionRow.fingerprint !== fingerprint) {
      throw new AttachmentsServiceError(
        'File changed since upload started. Please upload again.',
        'FILE_CHANGED',
        409
      )
    }
    if (sessionRow.receivedBytes !== sessionRow.totalSize) {
      throw new AttachmentsServiceError('Upload incomplete', 'UPLOAD_INCOMPLETE', 400)
    }

    const attachment = await attachmentRepository.findById(sessionRow.attachmentId)
    if (!attachment) {
      throw new AttachmentsServiceError('Attachment not found', 'NOT_FOUND', 404)
    }

    const tempPath = uploadingPath(sessionRow.homeNoteId, sessionRow.attachmentId)
    const destPath = finalPath(sessionRow.homeNoteId, sessionRow.attachmentId)

    if (!existsSync(tempPath)) {
      throw new AttachmentsServiceError('Upload file missing', 'UPLOAD_FAILED', 500)
    }

    const stats = statSync(tempPath)
    if (stats.size !== sessionRow.totalSize) {
      throw new AttachmentsServiceError('Size mismatch on disk', 'SIZE_MISMATCH', 400)
    }

    const plain = readFileSync(tempPath)
    const encrypted = encryptBuffer(plain)
    writeFileSync(destPath, encrypted)
    unlinkSync(tempPath)

    await attachmentRepository.updateStatus(sessionRow.attachmentId, 'ready', sessionRow.totalSize)
    await uploadSessionRepository.setStatus(sessionId, 'completed')
    await noteAttachmentRepository.syncFromPage(sessionRow.homeNoteId)

    const updated = await attachmentRepository.getById(sessionRow.attachmentId)
    if (!updated) {
      throw new AttachmentsServiceError('Attachment not found', 'NOT_FOUND', 404)
    }
    return updated
  }

  async abortSession(sessionId: string, userId: string): Promise<void> {
    const sessionRow = await uploadSessionRepository.findById(sessionId)
    if (!sessionRow) return
    if (sessionRow.ownerId !== userId) {
      throw new AttachmentsServiceError('Access denied', 'ACCESS_DENIED', 403)
    }

    await uploadSessionRepository.setStatus(sessionId, 'aborted')
    const tempPath = uploadingPath(sessionRow.homeNoteId, sessionRow.attachmentId)
    if (existsSync(tempPath)) unlinkSync(tempPath)

    const att = await attachmentRepository.findById(sessionRow.attachmentId)
    if (att?.status === 'uploading') {
      await attachmentRepository.delete(sessionRow.attachmentId)
    }
  }

  async getSessionForResume(
    noteId: string,
    userId: string,
    fingerprint: string,
    originalName: string,
    totalSize: number
  ): Promise<import('@onyka/shared').UploadSessionInfo | null> {
    await this.assertNoteEdit(noteId, userId)

    const list = await attachmentRepository.listByHomeNote(noteId)
    for (const att of list) {
      if (
        att.status === 'uploading' &&
        att.fingerprint === fingerprint &&
        att.originalName === originalName &&
        att.size === totalSize
      ) {
        const sessionRow = await uploadSessionRepository.findActiveByAttachment(att.id)
        if (sessionRow && sessionRow.fingerprint === fingerprint) {
          return uploadSessionRepository.toInfo(sessionRow)
        }
      }
    }
    return null
  }

  async download(
    attachmentId: string,
    userId: string,
    isAdmin: boolean
  ): Promise<{ buffer: Buffer; mimeType: string; originalName: string }> {
    const safeId = sanitizeAttachmentId(attachmentId)
    if (!safeId) {
      throw new AttachmentsServiceError('Invalid attachment id', 'NOT_FOUND', 404)
    }

    const row = await attachmentRepository.findById(safeId)
    if (!row || row.status !== 'ready') {
      throw new AttachmentsServiceError('Attachment not found', 'NOT_FOUND', 404)
    }

    if (row.ownerId !== userId && !isAdmin) {
      const hasAccess = await shareRepository.hasAccessToAttachment(userId, safeId)
      if (!hasAccess) {
        throw new AttachmentsServiceError('Access denied', 'ACCESS_DENIED', 403)
      }
    }

    const filePath = finalPath(row.homeNoteId, safeId)
    if (!existsSync(filePath)) {
      throw new AttachmentsServiceError('File not found', 'NOT_FOUND', 404)
    }

    const data = readFileSync(filePath)
    const buffer = decryptBuffer(data)

    return {
      buffer,
      mimeType: row.mimeType,
      originalName: row.originalName,
    }
  }

  async delete(attachmentId: string, userId: string, isAdmin: boolean): Promise<void> {
    const safeId = sanitizeAttachmentId(attachmentId)
    if (!safeId) {
      throw new AttachmentsServiceError('Invalid attachment id', 'NOT_FOUND', 404)
    }

    const row = await attachmentRepository.findById(safeId)
    if (!row) {
      throw new AttachmentsServiceError('Attachment not found', 'NOT_FOUND', 404)
    }

    if (row.ownerId !== userId && !isAdmin) {
      const note = await noteRepository.findById(row.homeNoteId)
      if (!note) {
        throw new AttachmentsServiceError('Access denied', 'ACCESS_DENIED', 403)
      }
      const canEdit = await shareRepository.hasAccess(userId, row.homeNoteId, 'note', 'edit')
      if (!canEdit) {
        throw new AttachmentsServiceError('Access denied', 'ACCESS_DENIED', 403)
      }
    }

    const uploading = uploadingPath(row.homeNoteId, safeId)
    const final = finalPath(row.homeNoteId, safeId)
    if (existsSync(uploading)) unlinkSync(uploading)
    if (existsSync(final)) unlinkSync(final)

    await attachmentRepository.delete(safeId)
    await noteAttachmentRepository.syncFromPage(row.homeNoteId)
  }

}

export const attachmentsService = new AttachmentsService()

/** Client-side fingerprint algorithm (documented for parity). */
export function serverFingerprintFromParts(size: number, lastModified: number, sampleHash: string): string {
  return createHash('sha256')
    .update(`${size}:${lastModified}:${sampleHash}`)
    .digest('hex')
}
