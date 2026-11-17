import { and, desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db, schema } from '../db/index.js'
import { decrypt } from '../utils/crypto.js'
import type {
  NoteShareLink,
  NoteShareLinkPermission,
  NoteShareLinkStatus,
  NoteShareLinkWithNote,
} from '@onyka/shared'

const { noteShareLinks, notes } = schema

function pathFor(token: string): string {
  return `/s/${token}`
}

function mapRow(row: typeof noteShareLinks.$inferSelect): NoteShareLink {
  return {
    id: row.id,
    token: row.token,
    noteId: row.noteId,
    ownerId: row.ownerId,
    permission: row.permission as NoteShareLinkPermission,
    hasPassword: Boolean(row.passwordHash),
    expiresAt: row.expiresAt ?? null,
    maxViews: row.maxViews ?? null,
    viewCount: row.viewCount,
    label: row.label ?? null,
    allowGuestComments: Boolean(row.allowGuestComments),
    status: row.status as NoteShareLinkStatus,
    lastAccessedAt: row.lastAccessedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    path: pathFor(row.token),
  }
}

export class NoteShareLinkRepository {
  async create(input: {
    noteId: string
    ownerId: string
    permission?: NoteShareLinkPermission
    passwordHash?: string | null
    expiresAt?: Date | null
    maxViews?: number | null
    label?: string | null
    allowGuestComments?: boolean
  }): Promise<NoteShareLink> {
    const now = new Date()
    const id = nanoid()
    const token = nanoid(12)
    await db.insert(noteShareLinks).values({
      id,
      token,
      noteId: input.noteId,
      ownerId: input.ownerId,
      permission: input.permission ?? 'view',
      passwordHash: input.passwordHash ?? null,
      expiresAt: input.expiresAt ?? null,
      maxViews: input.maxViews ?? null,
      viewCount: 0,
      label: input.label ?? null,
      allowGuestComments: Boolean(input.allowGuestComments),
      status: 'active',
      lastAccessedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    const created = await this.findById(id)
    if (!created) throw new Error('Failed to create share link')
    return created
  }

  async findById(id: string): Promise<NoteShareLink | null> {
    const rows = await db.select().from(noteShareLinks).where(eq(noteShareLinks.id, id)).limit(1)
    return rows[0] ? mapRow(rows[0]) : null
  }

  async findByToken(token: string): Promise<(NoteShareLink & { passwordHash: string | null }) | null> {
    const rows = await db
      .select()
      .from(noteShareLinks)
      .where(eq(noteShareLinks.token, token))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    return { ...mapRow(row), passwordHash: row.passwordHash ?? null }
  }

  async listByNote(noteId: string, ownerId: string): Promise<NoteShareLink[]> {
    const rows = await db
      .select()
      .from(noteShareLinks)
      .where(and(eq(noteShareLinks.noteId, noteId), eq(noteShareLinks.ownerId, ownerId)))
      .orderBy(desc(noteShareLinks.createdAt))
    return rows.map(mapRow)
  }

  async listByOwner(ownerId: string): Promise<NoteShareLinkWithNote[]> {
    const rows = await db
      .select({
        link: noteShareLinks,
        noteTitle: notes.title,
      })
      .from(noteShareLinks)
      .innerJoin(notes, eq(notes.id, noteShareLinks.noteId))
      .where(eq(noteShareLinks.ownerId, ownerId))
      .orderBy(desc(noteShareLinks.createdAt))

    return rows.map(({ link, noteTitle }) => {
      let title = noteTitle
      try {
        title = decrypt(noteTitle)
      } catch {
        title = '[Decryption error]'
      }
      return { ...mapRow(link), noteTitle: title }
    })
  }

  async update(
    id: string,
    ownerId: string,
    patch: {
      passwordHash?: string | null
      expiresAt?: Date | null
      maxViews?: number | null
      label?: string | null
      allowGuestComments?: boolean
      status?: NoteShareLinkStatus
      permission?: NoteShareLinkPermission
    }
  ): Promise<NoteShareLink | null> {
    const existing = await db
      .select()
      .from(noteShareLinks)
      .where(and(eq(noteShareLinks.id, id), eq(noteShareLinks.ownerId, ownerId)))
      .limit(1)
    if (!existing[0]) return null

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (patch.passwordHash !== undefined) updateData.passwordHash = patch.passwordHash
    if (patch.expiresAt !== undefined) updateData.expiresAt = patch.expiresAt
    if (patch.maxViews !== undefined) updateData.maxViews = patch.maxViews
    if (patch.label !== undefined) updateData.label = patch.label
    if (patch.allowGuestComments !== undefined) {
      updateData.allowGuestComments = Boolean(patch.allowGuestComments)
    }
    if (patch.status !== undefined) updateData.status = patch.status
    if (patch.permission !== undefined) updateData.permission = patch.permission

    await db.update(noteShareLinks).set(updateData).where(eq(noteShareLinks.id, id))
    return this.findById(id)
  }

  async recordAccess(id: string): Promise<void> {
    const now = new Date()
    const rows = await db.select().from(noteShareLinks).where(eq(noteShareLinks.id, id)).limit(1)
    const row = rows[0]
    if (!row) return
    await db
      .update(noteShareLinks)
      .set({
        viewCount: row.viewCount + 1,
        lastAccessedAt: now,
        updatedAt: now,
      })
      .where(eq(noteShareLinks.id, id))
  }
}

export const noteShareLinkRepository = new NoteShareLinkRepository()
