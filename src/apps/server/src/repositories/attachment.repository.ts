import { and, asc, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'
import type { Attachment, AttachmentStatus } from '@onyka/shared'

const { attachments, noteAttachments } = schema

export class AttachmentRepository {
  async findById(id: string) {
    const row = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1)
    return row[0] ?? null
  }

  async getById(id: string): Promise<Attachment | null> {
    const row = await this.findById(id)
    return row ? this.map(row) : null
  }

  async listByHomeNote(homeNoteId: string): Promise<Attachment[]> {
    const rows = await db
      .select()
      .from(attachments)
      .where(eq(attachments.homeNoteId, homeNoteId))
      .orderBy(asc(attachments.createdAt))

    return rows.map((r) => this.map(r))
  }

  async create(input: {
    homeNoteId: string
    originalName: string
    mimeType: string
    size: number
    fingerprint: string
    ownerId: string
    status?: AttachmentStatus
  }): Promise<Attachment> {
    const id = nanoid()
    const now = new Date()
    await db.insert(attachments).values({
      id,
      homeNoteId: input.homeNoteId,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: input.size,
      fingerprint: input.fingerprint,
      ownerId: input.ownerId,
      status: input.status ?? 'uploading',
      createdAt: now,
    })
    return {
      id,
      homeNoteId: input.homeNoteId,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: input.size,
      fingerprint: input.fingerprint,
      status: input.status ?? 'uploading',
      createdAt: now,
      downloadUrl: `/api/attachments/${id}/download`,
    }
  }

  async updateStatus(id: string, status: AttachmentStatus, size?: number): Promise<void> {
    await db
      .update(attachments)
      .set({
        status,
        ...(size !== undefined ? { size } : {}),
      })
      .where(eq(attachments.id, id))
  }

  async delete(id: string): Promise<void> {
    await db.delete(attachments).where(eq(attachments.id, id))
  }

  async linkToNote(noteId: string, attachmentId: string): Promise<void> {
    await db
      .insert(noteAttachments)
      .values({ noteId, attachmentId })
      .onConflictDoNothing()
  }

  async syncNoteLinks(noteId: string, attachmentIds: string[]): Promise<void> {
    const existing = await db
      .select({ attachmentId: noteAttachments.attachmentId })
      .from(noteAttachments)
      .where(eq(noteAttachments.noteId, noteId))

    const existingSet = new Set(existing.map((r) => r.attachmentId))
    const nextSet = new Set(attachmentIds)

    const toInsert = attachmentIds.filter((id) => !existingSet.has(id))
    const toDelete = [...existingSet].filter((id) => !nextSet.has(id))

    if (toDelete.length > 0) {
      await db
        .delete(noteAttachments)
        .where(
          and(eq(noteAttachments.noteId, noteId), inArray(noteAttachments.attachmentId, toDelete))
        )
    }

    if (toInsert.length > 0) {
      await db
        .insert(noteAttachments)
        .values(toInsert.map((attachmentId) => ({ noteId, attachmentId })))
        .onConflictDoNothing()
    }
  }

  /** Home note attachments plus any linked from content refs. */
  async listForNote(noteId: string): Promise<Attachment[]> {
    const homeRows = await db
      .select()
      .from(attachments)
      .where(eq(attachments.homeNoteId, noteId))

    const linked = await db
      .select({ attachment: attachments })
      .from(noteAttachments)
      .innerJoin(attachments, eq(attachments.id, noteAttachments.attachmentId))
      .where(eq(noteAttachments.noteId, noteId))

    const byId = new Map<string, Attachment>()
    for (const r of homeRows) {
      byId.set(r.id, this.map(r))
    }
    for (const r of linked) {
      byId.set(r.attachment.id, this.map(r.attachment))
    }
    return [...byId.values()].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    )
  }

  private map(row: typeof attachments.$inferSelect): Attachment {
    return {
      id: row.id,
      homeNoteId: row.homeNoteId,
      originalName: row.originalName,
      mimeType: row.mimeType,
      size: row.size,
      fingerprint: row.fingerprint,
      status: row.status as AttachmentStatus,
      createdAt: row.createdAt,
      downloadUrl: `/api/attachments/${row.id}/download`,
    }
  }
}

export const attachmentRepository = new AttachmentRepository()
