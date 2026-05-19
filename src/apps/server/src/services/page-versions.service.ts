import { createHash } from 'crypto'
import { pageRepository } from '../repositories/page.repository.js'
import { noteRepository } from '../repositories/note.repository.js'
import { noteVersionRepository } from '../repositories/note-version.repository.js'
import { shareRepository } from '../repositories/share.repository.js'
import { noteUploadRepository } from '../repositories/note-upload.repository.js'
import { noteAttachmentRepository } from '../repositories/note-attachment.repository.js'
import { searchService } from './search.service.js'
import { env } from '../config/env.js'
import type {
  NoteVersion,
  NoteVersionAction,
  NoteVersionCreateInput,
  NoteVersionSummary,
  NotePage,
} from '@onyka/shared'

export class PageVersionsServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message)
    this.name = 'PageVersionsServiceError'
  }
}

function buildContentHash(noteTitle: string, pageTitle: string, content: string): string {
  return createHash('sha256')
    .update(`${noteTitle}\0${pageTitle}\0${content}`)
    .digest('hex')
}

export class PageVersionsService {
  async list(pageId: string, userId: string): Promise<NoteVersionSummary[]> {
    const page = await this.getPageOrThrow(pageId)
    await this.verifyNoteAccess(page.noteId, userId, 'read')
    return noteVersionRepository.listByPageId(pageId)
  }

  async get(versionId: string, userId: string): Promise<NoteVersion> {
    const version = await noteVersionRepository.findById(versionId)
    if (!version) {
      throw new PageVersionsServiceError('Version not found', 'VERSION_NOT_FOUND', 404)
    }
    await this.verifyNoteAccess(version.noteId, userId, 'read')
    return version
  }

  async createSnapshot(
    pageId: string,
    userId: string,
    input: NoteVersionCreateInput = {}
  ): Promise<NoteVersionSummary | null> {
    const page = await this.getPageOrThrow(pageId)
    await this.verifyNoteAccess(page.noteId, userId, 'edit')

    if (page.isLocked) {
      throw new PageVersionsServiceError('Page is locked', 'PAGE_LOCKED', 423)
    }

    const note = await noteRepository.findById(page.noteId)
    if (!note) {
      throw new PageVersionsServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }

    const action: NoteVersionAction = input.action ?? 'manual'
    return this.saveSnapshot({
      page,
      noteTitle: note.title,
      action,
      createdBy: userId,
      skipIfUnchanged: action === 'checkpoint' || action === 'restore',
    })
  }

  async restore(versionId: string, userId: string): Promise<NotePage> {
    const version = await noteVersionRepository.findById(versionId)
    if (!version) {
      throw new PageVersionsServiceError('Version not found', 'VERSION_NOT_FOUND', 404)
    }

    await this.verifyNoteAccess(version.noteId, userId, 'edit')

    const page = await this.getPageOrThrow(version.notePageId)
    if (page.isLocked) {
      throw new PageVersionsServiceError('Page is locked', 'PAGE_LOCKED', 423)
    }

    const note = await noteRepository.findById(version.noteId)
    if (!note) {
      throw new PageVersionsServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }

    await this.saveSnapshot({
      page,
      noteTitle: note.title,
      action: 'before_restore',
      createdBy: userId,
      skipIfUnchanged: false,
    })

    const updated = await pageRepository.update(version.notePageId, {
      title: version.pageTitle,
      content: version.content,
    })
    if (!updated) {
      throw new PageVersionsServiceError('Failed to restore', 'RESTORE_FAILED', 500)
    }

    if (note.title !== version.noteTitle) {
      await noteRepository.update(version.noteId, { title: version.noteTitle })
      searchService.indexNote({ ...note, title: version.noteTitle })
    }

    await noteUploadRepository.syncFromPage(version.noteId)
    await noteAttachmentRepository.syncFromPage(version.noteId)

    await this.saveSnapshot({
      page: updated,
      noteTitle: version.noteTitle,
      action: 'restore',
      createdBy: userId,
      skipIfUnchanged: true,
    })

    return updated
  }

  private async saveSnapshot(options: {
    page: NotePage
    noteTitle: string
    action: NoteVersionAction
    createdBy: string
    skipIfUnchanged: boolean
  }): Promise<NoteVersionSummary | null> {
    const hash = buildContentHash(options.noteTitle, options.page.title, options.page.content)

    if (options.skipIfUnchanged) {
      const latest = await noteVersionRepository.findLatestHash(options.page.id)
      if (latest === hash) return null
    }

    const summary = await noteVersionRepository.create({
      noteId: options.page.noteId,
      notePageId: options.page.id,
      noteTitle: options.noteTitle,
      pageTitle: options.page.title,
      content: options.page.content,
      contentHash: hash,
      action: options.action,
      createdBy: options.createdBy,
    })

    const retentionCutoff = new Date()
    retentionCutoff.setDate(retentionCutoff.getDate() - env.VERSION_RETENTION_DAYS)
    await noteVersionRepository.pruneOlderThan(options.page.id, retentionCutoff)
    await noteVersionRepository.pruneForPage(options.page.id, env.MAX_VERSIONS_PER_NOTE)

    return summary
  }

  private async getPageOrThrow(pageId: string) {
    const page = await pageRepository.findById(pageId)
    if (!page) {
      throw new PageVersionsServiceError('Page not found', 'PAGE_NOT_FOUND', 404)
    }
    return page
  }

  private async verifyNoteAccess(
    noteId: string,
    userId: string,
    requiredPermission: 'read' | 'edit'
  ): Promise<void> {
    const note = await noteRepository.findById(noteId)
    if (!note) {
      throw new PageVersionsServiceError('Note not found', 'NOTE_NOT_FOUND', 404)
    }
    if (note.ownerId === userId) return

    const hasAccess = await shareRepository.hasAccess(userId, noteId, 'note', requiredPermission)
    if (!hasAccess) {
      throw new PageVersionsServiceError('Access denied', 'ACCESS_DENIED', 403)
    }
  }
}

export const pageVersionsService = new PageVersionsService()
