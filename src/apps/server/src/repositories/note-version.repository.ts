import { eq, desc, and, lt, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'
import { encrypt, decrypt } from '../utils/crypto.js'
import { logger } from '../utils/index.js'
import type { NoteVersion, NoteVersionAction, NoteVersionSummary } from '@onyka/shared'

const { noteVersions, users } = schema

export interface CreateNoteVersionInput {
  noteId: string
  notePageId: string
  noteTitle: string
  pageTitle: string
  content: string
  contentHash: string
  action: NoteVersionAction
  createdBy: string
}

function countWords(text: string): number {
  const plain = text.replace(/<[^>]+>/g, ' ').trim()
  if (!plain) return 0
  return plain.split(/\s+/).filter(Boolean).length
}

export class NoteVersionRepository {
  async findLatestHash(notePageId: string): Promise<string | null> {
    const row = await db
      .select({ contentHash: noteVersions.contentHash })
      .from(noteVersions)
      .where(eq(noteVersions.notePageId, notePageId))
      .orderBy(desc(noteVersions.createdAt))
      .limit(1)
    return row[0]?.contentHash ?? null
  }

  async listByPageId(notePageId: string): Promise<NoteVersionSummary[]> {
    const rows = await db
      .select({
        id: noteVersions.id,
        noteId: noteVersions.noteId,
        notePageId: noteVersions.notePageId,
        noteTitle: noteVersions.noteTitle,
        pageTitle: noteVersions.pageTitle,
        content: noteVersions.content,
        action: noteVersions.action,
        createdBy: noteVersions.createdBy,
        createdAt: noteVersions.createdAt,
        authorUsername: users.username,
        authorName: users.name,
      })
      .from(noteVersions)
      .innerJoin(users, eq(noteVersions.createdBy, users.id))
      .where(eq(noteVersions.notePageId, notePageId))
      .orderBy(desc(noteVersions.createdAt))

    return rows.map((row) => {
      let pageTitle = ''
      let noteTitle = ''
      let content = ''
      try {
        pageTitle = decrypt(row.pageTitle)
        noteTitle = decrypt(row.noteTitle)
        content = decrypt(row.content)
      } catch (err) {
        logger.error('Failed to decrypt version row for list', err, { versionId: row.id })
      }
      return {
        id: row.id,
        noteId: row.noteId,
        notePageId: row.notePageId,
        pageTitle,
        noteTitle,
        action: row.action as NoteVersionAction,
        createdBy: {
          id: row.createdBy,
          username: row.authorUsername,
          name: row.authorName,
        },
        createdAt: row.createdAt,
        wordCount: countWords(content),
      }
    })
  }

  async findById(id: string): Promise<NoteVersion | null> {
    const rows = await db
      .select({
        id: noteVersions.id,
        noteId: noteVersions.noteId,
        notePageId: noteVersions.notePageId,
        noteTitle: noteVersions.noteTitle,
        pageTitle: noteVersions.pageTitle,
        content: noteVersions.content,
        action: noteVersions.action,
        createdBy: noteVersions.createdBy,
        createdAt: noteVersions.createdAt,
        authorUsername: users.username,
        authorName: users.name,
      })
      .from(noteVersions)
      .innerJoin(users, eq(noteVersions.createdBy, users.id))
      .where(eq(noteVersions.id, id))
      .limit(1)

    const row = rows[0]
    if (!row) return null

    try {
      const pageTitle = decrypt(row.pageTitle)
      const noteTitle = decrypt(row.noteTitle)
      const content = decrypt(row.content)
      return {
        id: row.id,
        noteId: row.noteId,
        notePageId: row.notePageId,
        pageTitle,
        noteTitle,
        content,
        action: row.action as NoteVersionAction,
        createdBy: {
          id: row.createdBy,
          username: row.authorUsername,
          name: row.authorName,
        },
        createdAt: row.createdAt,
        wordCount: countWords(content),
      }
    } catch (err) {
      logger.error('Failed to decrypt version', err, { versionId: id })
      return null
    }
  }

  async create(input: CreateNoteVersionInput): Promise<NoteVersionSummary> {
    const id = nanoid()
    const now = new Date()

    await db.insert(noteVersions).values({
      id,
      noteId: input.noteId,
      notePageId: input.notePageId,
      noteTitle: encrypt(input.noteTitle),
      pageTitle: encrypt(input.pageTitle),
      content: encrypt(input.content),
      contentHash: input.contentHash,
      action: input.action,
      createdBy: input.createdBy,
      createdAt: now,
    })

    const created = await this.findById(id)
    if (!created) {
      throw new Error('Failed to load created version')
    }
    const { content: _c, ...summary } = created
    return summary
  }

  async pruneForPage(notePageId: string, maxVersions: number): Promise<void> {
    if (maxVersions < 1) return

    const allRows = await db
      .select({ id: noteVersions.id })
      .from(noteVersions)
      .where(eq(noteVersions.notePageId, notePageId))
      .orderBy(desc(noteVersions.createdAt))

    const toDelete = allRows.slice(maxVersions).map((r) => r.id)
    if (toDelete.length === 0) return

    await db.delete(noteVersions).where(inArray(noteVersions.id, toDelete))
  }

  async pruneOlderThan(notePageId: string, cutoff: Date): Promise<void> {
    await db
      .delete(noteVersions)
      .where(and(eq(noteVersions.notePageId, notePageId), lt(noteVersions.createdAt, cutoff)))
  }
}

export const noteVersionRepository = new NoteVersionRepository()
