import { SignJWT, jwtVerify } from 'jose'
import { noteShareLinkRepository } from '../repositories/note-share-link.repository.js'
import { noteRepository } from '../repositories/note.repository.js'
import { pageRepository } from '../repositories/page.repository.js'
import { passwordService } from './password.service.js'
import { env } from '../config/env.js'
import type {
  NoteShareLink,
  NoteShareLinkCreateInput,
  NoteShareLinkUpdateInput,
  NoteShareLinkWithNote,
  PublicShareContent,
  PublicShareLinkMeta,
} from '@onyka/shared'

export class NoteShareLinkServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'NoteShareLinkServiceError'
  }
}

const DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000
const SHARE_ACCESS_TTL = '2h'

function remainingViews(maxViews: number | null, viewCount: number): number | null {
  if (maxViews == null) return null
  return Math.max(0, maxViews - viewCount)
}

function isExpired(expiresAt: Date | null): boolean {
  return Boolean(expiresAt && expiresAt.getTime() <= Date.now())
}

function isExhausted(maxViews: number | null, viewCount: number): boolean {
  return maxViews != null && viewCount >= maxViews
}

export class NoteShareLinkService {
  private readonly secret = new TextEncoder().encode(env.JWT_SECRET)

  async create(noteId: string, ownerId: string, input: NoteShareLinkCreateInput): Promise<NoteShareLink> {
    const note = await noteRepository.findById(noteId)
    if (!note || note.ownerId !== ownerId || note.isDeleted) {
      throw new NoteShareLinkServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }
    if (note.isEncrypted) {
      throw new NoteShareLinkServiceError(
        'Encrypted notes cannot be shared via public links',
        'NOTE_ENCRYPTED',
        400
      )
    }

    let expiresAt: Date | null
    if (input.expiresAt === null) {
      expiresAt = null
    } else if (input.expiresAt === undefined) {
      expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_MS)
    } else {
      expiresAt = new Date(input.expiresAt)
      if (Number.isNaN(expiresAt.getTime())) {
        throw new NoteShareLinkServiceError('Invalid expiresAt', 'INVALID_EXPIRES', 400)
      }
    }

    let passwordHash: string | null = null
    if (input.password) {
      if (input.password.length < 4) {
        throw new NoteShareLinkServiceError('Password must be at least 4 characters', 'WEAK_PASSWORD', 400)
      }
      passwordHash = await passwordService.hash(input.password)
    }

    const maxViews =
      input.maxViews === undefined || input.maxViews === null
        ? null
        : Math.max(1, Math.floor(input.maxViews))

    return noteShareLinkRepository.create({
      noteId,
      ownerId,
      permission: 'view',
      passwordHash,
      expiresAt,
      maxViews,
      label: input.label?.trim() || null,
    })
  }

  async listForNote(noteId: string, ownerId: string): Promise<NoteShareLink[]> {
    const note = await noteRepository.findById(noteId)
    if (!note || note.ownerId !== ownerId) {
      throw new NoteShareLinkServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }
    return noteShareLinkRepository.listByNote(noteId, ownerId)
  }

  async listMine(ownerId: string): Promise<NoteShareLinkWithNote[]> {
    return noteShareLinkRepository.listByOwner(ownerId)
  }

  async update(id: string, ownerId: string, input: NoteShareLinkUpdateInput): Promise<NoteShareLink> {
    const patch: Parameters<typeof noteShareLinkRepository.update>[2] = {}

    if (input.clearPassword) {
      patch.passwordHash = null
    } else if (input.password !== undefined && input.password !== null) {
      if (input.password.length < 4) {
        throw new NoteShareLinkServiceError('Password must be at least 4 characters', 'WEAK_PASSWORD', 400)
      }
      patch.passwordHash = await passwordService.hash(input.password)
    }

    if (input.expiresAt !== undefined) {
      if (input.expiresAt === null) {
        patch.expiresAt = null
      } else {
        const d = new Date(input.expiresAt)
        if (Number.isNaN(d.getTime())) {
          throw new NoteShareLinkServiceError('Invalid expiresAt', 'INVALID_EXPIRES', 400)
        }
        patch.expiresAt = d
      }
    }

    if (input.maxViews !== undefined) {
      patch.maxViews =
        input.maxViews === null ? null : Math.max(1, Math.floor(input.maxViews))
    }
    if (input.label !== undefined) {
      patch.label = input.label?.trim() || null
    }
    if (input.status !== undefined) {
      patch.status = input.status
    }

    const updated = await noteShareLinkRepository.update(id, ownerId, patch)
    if (!updated) {
      throw new NoteShareLinkServiceError('Share link not found', 'LINK_NOT_FOUND', 404)
    }
    return updated
  }

  async revoke(id: string, ownerId: string): Promise<void> {
    await this.update(id, ownerId, { status: 'revoked' })
  }

  async getPublicMeta(token: string): Promise<PublicShareLinkMeta> {
    const link = await noteShareLinkRepository.findByToken(token)
    if (!link) {
      throw new NoteShareLinkServiceError('Share link not found', 'LINK_NOT_FOUND', 404)
    }
    const note = await noteRepository.findById(link.noteId)
    if (!note || note.isDeleted) {
      throw new NoteShareLinkServiceError('Share link not found', 'LINK_NOT_FOUND', 404)
    }

    const expired = isExpired(link.expiresAt)
    const exhausted = isExhausted(link.maxViews, link.viewCount)

    return {
      token: link.token,
      noteTitle: note.title,
      permission: link.permission,
      needsPassword: link.hasPassword,
      expiresAt: link.expiresAt,
      maxViews: link.maxViews,
      viewCount: link.viewCount,
      status: link.status,
      remainingViews: remainingViews(link.maxViews, link.viewCount),
      isExpired: expired,
      isExhausted: exhausted,
    }
  }

  async openPublic(
    token: string,
    password?: string
  ): Promise<{ content: PublicShareContent; accessToken: string }> {
    const link = await noteShareLinkRepository.findByToken(token)
    if (!link) {
      throw new NoteShareLinkServiceError('Share link not found', 'LINK_NOT_FOUND', 404)
    }
    if (link.status !== 'active') {
      throw new NoteShareLinkServiceError('Share link has been revoked', 'LINK_REVOKED', 410)
    }
    if (isExpired(link.expiresAt)) {
      throw new NoteShareLinkServiceError('Share link has expired', 'LINK_EXPIRED', 410)
    }
    if (isExhausted(link.maxViews, link.viewCount)) {
      throw new NoteShareLinkServiceError('Share link view limit reached', 'LINK_EXHAUSTED', 410)
    }

    if (link.passwordHash) {
      if (!password) {
        throw new NoteShareLinkServiceError('Password required', 'PASSWORD_REQUIRED', 401)
      }
      const ok = await passwordService.verify(link.passwordHash, password)
      if (!ok) {
        throw new NoteShareLinkServiceError('Incorrect password', 'INVALID_PASSWORD', 401)
      }
    }

    const note = await noteRepository.findById(link.noteId)
    if (!note || note.isDeleted) {
      throw new NoteShareLinkServiceError('Share link not found', 'LINK_NOT_FOUND', 404)
    }
    if (note.isEncrypted) {
      throw new NoteShareLinkServiceError('Shared note is encrypted', 'NOTE_ENCRYPTED', 400)
    }

    await noteShareLinkRepository.recordAccess(link.id)
    const viewCount = link.viewCount + 1

    let pages = await pageRepository.findByNoteId(note.id)
    if (pages.length === 0) {
      pages = [
        {
          id: note.id,
          noteId: note.id,
          title: note.title || 'Page 1',
          content: note.content || '',
          mode: 'text',
          position: 0,
          isLocked: false,
          isDeleted: false,
          deletedAt: null,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
        },
      ]
    }

    const content: PublicShareContent = {
      noteTitle: note.title,
      pages: pages.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        position: p.position,
      })),
      permission: link.permission,
      expiresAt: link.expiresAt,
      maxViews: link.maxViews,
      viewCount,
      remainingViews: remainingViews(link.maxViews, viewCount),
    }

    const accessToken = await new SignJWT({
      type: 'share-access',
      linkId: link.id,
      token: link.token,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(SHARE_ACCESS_TTL)
      .sign(this.secret)

    return { content, accessToken }
  }

  async verifyAccessToken(token: string, accessToken: string): Promise<boolean> {
    try {
      const { payload } = await jwtVerify(accessToken, this.secret)
      return payload.type === 'share-access' && payload.token === token
    } catch {
      return false
    }
  }
}

export const noteShareLinkService = new NoteShareLinkService()
