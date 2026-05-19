import { and, eq, lt } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'
import type { UploadSessionInfo, UploadSessionStatus } from '@onyka/shared'

const { uploadSessions } = schema

const SESSION_TTL_MS = 24 * 60 * 60 * 1000

export class UploadSessionRepository {
  async findById(id: string) {
    const row = await db.select().from(uploadSessions).where(eq(uploadSessions.id, id)).limit(1)
    return row[0] ?? null
  }

  async findActiveByAttachment(attachmentId: string) {
    const row = await db
      .select()
      .from(uploadSessions)
      .where(
        and(eq(uploadSessions.attachmentId, attachmentId), eq(uploadSessions.status, 'active'))
      )
      .limit(1)
    return row[0] ?? null
  }

  async create(input: {
    attachmentId: string
    ownerId: string
    homeNoteId: string
    originalName: string
    mimeType: string
    totalSize: number
    fingerprint: string
  }): Promise<UploadSessionInfo> {
    const id = nanoid()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
    await db.insert(uploadSessions).values({
      id,
      attachmentId: input.attachmentId,
      ownerId: input.ownerId,
      homeNoteId: input.homeNoteId,
      originalName: input.originalName,
      mimeType: input.mimeType,
      totalSize: input.totalSize,
      receivedBytes: 0,
      fingerprint: input.fingerprint,
      status: 'active',
      expiresAt,
      createdAt: now,
    })
    return {
      sessionId: id,
      attachmentId: input.attachmentId,
      totalSize: input.totalSize,
      receivedBytes: 0,
      fingerprint: input.fingerprint,
      expiresAt,
    }
  }

  async updateReceivedBytes(id: string, receivedBytes: number): Promise<void> {
    await db.update(uploadSessions).set({ receivedBytes }).where(eq(uploadSessions.id, id))
  }

  async setStatus(id: string, status: UploadSessionStatus): Promise<void> {
    await db.update(uploadSessions).set({ status }).where(eq(uploadSessions.id, id))
  }

  async deleteExpired(): Promise<number> {
    const now = new Date()
    const expired = await db
      .select({ id: uploadSessions.id })
      .from(uploadSessions)
      .where(and(eq(uploadSessions.status, 'active'), lt(uploadSessions.expiresAt, now)))

    for (const row of expired) {
      await this.setStatus(row.id, 'aborted')
    }
    return expired.length
  }

  toInfo(row: typeof uploadSessions.$inferSelect): UploadSessionInfo {
    return {
      sessionId: row.id,
      attachmentId: row.attachmentId,
      totalSize: row.totalSize,
      receivedBytes: row.receivedBytes,
      fingerprint: row.fingerprint,
      expiresAt: row.expiresAt,
    }
  }
}

export const uploadSessionRepository = new UploadSessionRepository()
