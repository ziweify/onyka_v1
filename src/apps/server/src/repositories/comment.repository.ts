import { eq, desc, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'
import { SHARE_GUEST_USER_ID } from '../db/schema.js'
import { encrypt, decrypt } from '../utils/crypto.js'
import type { Comment, CommentWithUser, CommentWithReplies } from '@onyka/shared'

const { noteComments, users } = schema

function displayUser(
  row: {
    id: string
    username: string
    name: string
    avatarUrl: string | null
    avatarColor: string | null
  } | null,
  comment: Comment
): CommentWithUser['user'] {
  if (comment.isGuest) {
    const nick = comment.guestName?.trim() || 'Guest'
    return {
      id: SHARE_GUEST_USER_ID,
      username: nick,
      name: nick,
      avatarColor: 'blue',
    }
  }
  if (!row) {
    return {
      id: comment.userId,
      username: 'unknown',
      name: 'Unknown',
      avatarColor: 'blue',
    }
  }
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    avatarUrl: row.avatarUrl ?? undefined,
    avatarColor: row.avatarColor ?? undefined,
  }
}

export class CommentRepository {
  async findById(id: string): Promise<Comment | null> {
    const result = await db.select().from(noteComments).where(eq(noteComments.id, id)).limit(1)
    return result[0] ? this.mapToComment(result[0]) : null
  }

  async findByIdWithUser(id: string): Promise<CommentWithUser | null> {
    const result = await db
      .select({
        comment: noteComments,
        user: {
          id: users.id,
          username: users.username,
          name: users.name,
          avatarUrl: users.avatarUrl,
          avatarColor: users.avatarColor,
        },
      })
      .from(noteComments)
      .leftJoin(users, eq(noteComments.userId, users.id))
      .where(eq(noteComments.id, id))
      .limit(1)

    if (!result[0]) return null
    const comment = this.mapToComment(result[0].comment)
    return {
      ...comment,
      user: displayUser(result[0].user, comment),
    }
  }

  async findByNoteId(noteId: string): Promise<CommentWithReplies[]> {
    const allComments = await db
      .select({
        comment: noteComments,
        user: {
          id: users.id,
          username: users.username,
          name: users.name,
          avatarUrl: users.avatarUrl,
          avatarColor: users.avatarColor,
        },
      })
      .from(noteComments)
      .leftJoin(users, eq(noteComments.userId, users.id))
      .where(eq(noteComments.noteId, noteId))
      .orderBy(desc(noteComments.createdAt))

    const commentMap = new Map<string, CommentWithReplies>()
    const topLevelComments: CommentWithReplies[] = []

    for (const row of allComments) {
      const base = this.mapToComment(row.comment)
      const comment: CommentWithReplies = {
        ...base,
        user: displayUser(row.user, base),
        replies: [],
      }
      commentMap.set(comment.id, comment)
    }

    for (const row of allComments) {
      const comment = commentMap.get(row.comment.id)!
      if (row.comment.parentId) {
        const parent = commentMap.get(row.comment.parentId)
        if (parent) {
          parent.replies.push(comment)
        }
      } else {
        topLevelComments.push(comment)
      }
    }

    for (const comment of commentMap.values()) {
      comment.replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    }

    return topLevelComments
  }

  async countByNoteId(noteId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(noteComments)
      .where(eq(noteComments.noteId, noteId))
    return result[0]?.count ?? 0
  }

  async create(
    noteId: string,
    userId: string,
    content: string,
    parentId?: string,
    guest?: { guestName: string | null; shareLinkId: string }
  ): Promise<Comment> {
    const id = nanoid()
    const now = new Date()

    await db.insert(noteComments).values({
      id,
      noteId,
      userId,
      guestName: guest?.guestName ?? null,
      shareLinkId: guest?.shareLinkId ?? null,
      parentId: parentId ?? null,
      content: encrypt(content),
      createdAt: now,
      updatedAt: now,
    })

    return {
      id,
      noteId,
      userId,
      parentId: parentId ?? null,
      content,
      guestName: guest?.guestName ?? null,
      shareLinkId: guest?.shareLinkId ?? null,
      isGuest: userId === SHARE_GUEST_USER_ID,
      createdAt: now,
      updatedAt: now,
    }
  }

  async update(id: string, content: string): Promise<Comment | null> {
    const now = new Date()
    await db.update(noteComments).set({ content: encrypt(content), updatedAt: now }).where(eq(noteComments.id, id))
    return this.findById(id)
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(noteComments).where(eq(noteComments.id, id))
    return result.changes > 0
  }

  async deleteByNoteId(noteId: string): Promise<number> {
    const result = await db.delete(noteComments).where(eq(noteComments.noteId, noteId))
    return result.changes
  }

  private mapToComment(row: typeof noteComments.$inferSelect): Comment {
    const userId = row.userId
    const guestName = row.guestName ?? null
    return {
      id: row.id,
      noteId: row.noteId,
      userId,
      parentId: row.parentId,
      content: decrypt(row.content),
      guestName,
      shareLinkId: row.shareLinkId ?? null,
      isGuest: userId === SHARE_GUEST_USER_ID || Boolean(guestName && row.shareLinkId),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}

export const commentRepository = new CommentRepository()
