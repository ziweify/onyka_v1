import { and, desc, eq, gte } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'
import type { NoteAccessLog } from '@onyka/shared'

const { noteAccessLogs, users } = schema

const DEDUP_MS = 5 * 60 * 1000

export class NoteAccessRepository {
  /**
   * Record an open. Dedupes same user+note within 5 minutes
   * (still returns whether a new row was inserted).
   */
  async recordAccess(noteId: string, userId: string): Promise<{ inserted: boolean; at: Date }> {
    const at = new Date()
    const since = new Date(at.getTime() - DEDUP_MS)
    const recent = await db
      .select({ id: noteAccessLogs.id })
      .from(noteAccessLogs)
      .where(
        and(
          eq(noteAccessLogs.noteId, noteId),
          eq(noteAccessLogs.userId, userId),
          gte(noteAccessLogs.accessedAt, since)
        )
      )
      .limit(1)

    if (recent.length > 0) {
      return { inserted: false, at }
    }

    await db.insert(noteAccessLogs).values({
      id: nanoid(),
      noteId,
      userId,
      accessedAt: at,
    })
    return { inserted: true, at }
  }

  async listByNoteId(noteId: string, limit = 50): Promise<NoteAccessLog[]> {
    const capped = Math.min(Math.max(1, limit), 100)
    const rows = await db
      .select({
        id: noteAccessLogs.id,
        noteId: noteAccessLogs.noteId,
        userId: noteAccessLogs.userId,
        accessedAt: noteAccessLogs.accessedAt,
        username: users.username,
        name: users.name,
      })
      .from(noteAccessLogs)
      .innerJoin(users, eq(users.id, noteAccessLogs.userId))
      .where(eq(noteAccessLogs.noteId, noteId))
      .orderBy(desc(noteAccessLogs.accessedAt))
      .limit(capped)

    return rows.map((r) => ({
      id: r.id,
      noteId: r.noteId,
      userId: r.userId,
      username: r.username,
      name: r.name ?? undefined,
      accessedAt: r.accessedAt,
    }))
  }
}

export const noteAccessRepository = new NoteAccessRepository()
