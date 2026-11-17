import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import { noteRepository } from '../repositories/note.repository.js'
import { pageRepository } from '../repositories/page.repository.js'
import { noteUploadRepository } from '../repositories/note-upload.repository.js'
import { noteAttachmentRepository } from '../repositories/note-attachment.repository.js'
import { searchService } from './search.service.js'
import { attachmentsService } from './attachments.service.js'
import { slugifyHeading } from '../utils/slugify.js'
import type { Note } from '@onyka/shared'

export type ImportFormat = 'md' | 'html'

export class ImportServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ImportServiceError'
  }
}

marked.use({
  renderer: {
    heading({ text, depth }: { text: string; depth: number }) {
      const id = slugifyHeading(text)
      return `<h${depth} id="${id}">${text}</h${depth}>\n`
    },
  },
})

function extractTitleFromHtml(html: string): string | null {
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleTag) {
    const t = titleTag[1].replace(/<[^>]+>/g, '').trim()
    if (t) return t
  }
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (!match) return null
  return match[1].replace(/<[^>]+>/g, '').trim() || null
}

/** Full saved pages (SingleFile etc.) should be kept as snapshots, not TipTap HTML. */
export function isFullPageHtml(html: string): boolean {
  const head = html.slice(0, 8000).toLowerCase()
  if (head.includes('data-single-file') || head.includes('singlefile-')) return true
  if (head.includes('<!-- singlefile')) return true
  const hasHtml = /<html[\s>]/i.test(html)
  const hasHead = /<head[\s>]/i.test(html)
  const hasStyle = /<style[\s>]/i.test(html)
  if (hasHtml && hasHead && hasStyle) return true
  if (hasHtml && hasHead && html.length > 80_000) return true
  return false
}

function buildSnapshotMarker(attachmentId: string, title: string): string {
  const safeTitle = title.replace(/[<>&"]/g, '')
  return (
    `<div data-type="web-snapshot" data-onyka-web-snapshot="${attachmentId}">` +
    `<p><a href="onyka://attachment/${attachmentId}" data-onyka-web-snapshot="${attachmentId}">` +
    `${safeTitle || '网页快照'}</a></p>` +
    `<p data-onyka-snapshot-hint="true">此笔记为完整网页快照，样式已保留，可离线查看。</p>` +
    `</div>`
  )
}

function titlesMatch(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()
}

export class ImportService {
  async importNote(
    ownerId: string,
    input: {
      format: ImportFormat
      content: string
      title?: string
      folderId?: string | null
      overwrite?: boolean
    }
  ): Promise<Note> {
    const raw = input.content?.trim()
    if (!raw) {
      throw new ImportServiceError('Content is required', 'CONTENT_REQUIRED', 400)
    }

    const folderId = input.folderId ?? null

    // All HTML imports become offline web snapshots (preserves SingleFile styles).
    // Markdown still becomes editable TipTap notes.
    if (input.format === 'html') {
      console.info('[import] web-snapshot', {
        bytes: Buffer.byteLength(raw, 'utf8'),
        fullPage: isFullPageHtml(raw),
        title: input.title ?? null,
        overwrite: Boolean(input.overwrite),
      })
      return this.importWebSnapshot(ownerId, raw, input.title, folderId, input.overwrite)
    }

    const html = DOMPurify.sanitize(marked.parse(raw) as string)

    const title =
      input.title?.trim() ||
      (input.format === 'md' ? this.titleFromMarkdown(raw) : extractTitleFromHtml(html)) ||
      'Imported note'

    const existing = await this.findExistingByTitle(ownerId, folderId, title)
    if (existing) {
      if (!input.overwrite) {
        throw new ImportServiceError(
          'A note with this name already exists in this folder',
          'NAME_CONFLICT',
          409,
          { noteId: existing.id, title: existing.title }
        )
      }
      if (existing.isEncrypted) {
        throw new ImportServiceError(
          'Cannot overwrite an encrypted note',
          'NOTE_ENCRYPTED',
          400
        )
      }
      return this.overwriteMarkdownNote(existing, title, html)
    }

    const note = await noteRepository.create(ownerId, {
      title,
      content: html,
      folderId,
    })

    await pageRepository.create(note.id, {
      title,
      content: html,
      position: 0,
    })

    await noteUploadRepository.syncFromNoteContent(note.id, html)
    await noteAttachmentRepository.syncFromNoteContent(note.id, html)
    searchService.indexNote(note)

    return note
  }

  private async findExistingByTitle(
    ownerId: string,
    folderId: string | null,
    title: string
  ): Promise<Note | null> {
    const notes = await noteRepository.findByOwner(ownerId, {
      folderId,
      isDeleted: false,
    })
    return notes.find((n) => titlesMatch(n.title, title)) ?? null
  }

  private async overwriteMarkdownNote(
    existing: Note,
    title: string,
    html: string
  ): Promise<Note> {
    await noteRepository.update(existing.id, { title, content: html })
    const pages = await pageRepository.findByNoteId(existing.id)
    if (pages.length > 0) {
      await pageRepository.update(pages[0].id, { title, content: html })
    } else {
      await pageRepository.create(existing.id, {
        title,
        content: html,
        position: 0,
      })
    }
    await noteUploadRepository.syncFromNoteContent(existing.id, html)
    await noteAttachmentRepository.syncFromNoteContent(existing.id, html)
    const updated = await noteRepository.findById(existing.id)
    if (!updated) {
      throw new ImportServiceError('Note not found after overwrite', 'NOTE_NOT_FOUND', 500)
    }
    searchService.indexNote(updated)
    return updated
  }

  private async importWebSnapshot(
    ownerId: string,
    rawHtml: string,
    titleInput?: string,
    folderId?: string | null,
    overwrite?: boolean
  ): Promise<Note> {
    const title =
      titleInput?.trim() ||
      extractTitleFromHtml(rawHtml) ||
      '网页快照'

    const existing = await this.findExistingByTitle(ownerId, folderId ?? null, title)
    if (existing) {
      if (!overwrite) {
        throw new ImportServiceError(
          'A note with this name already exists in this folder',
          'NAME_CONFLICT',
          409,
          { noteId: existing.id, title: existing.title }
        )
      }
      if (existing.isEncrypted) {
        throw new ImportServiceError(
          'Cannot overwrite an encrypted note',
          'NOTE_ENCRYPTED',
          400
        )
      }
      return this.overwriteWebSnapshot(existing, title, rawHtml)
    }

    // Create note first so attachment can use homeNoteId
    const placeholder = '<p>正在保存网页快照…</p>'
    const note = await noteRepository.create(ownerId, {
      title,
      content: placeholder,
      folderId: folderId ?? null,
      icon: 'Globe',
    })

    const page = await pageRepository.create(note.id, {
      title,
      content: placeholder,
      position: 0,
    })

    const buffer = Buffer.from(rawHtml, 'utf8')
    const safeFileTitle = title.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'snapshot'
    const attachment = await attachmentsService.createReadyFromBuffer(note.id, ownerId, {
      originalName: `${safeFileTitle}.html`,
      mimeType: 'text/html; charset=utf-8',
      buffer,
    })

    const marker = buildSnapshotMarker(attachment.id, title)
    await noteRepository.update(note.id, { content: marker, icon: 'Globe' })
    await pageRepository.update(page.id, { content: marker, title })
    await noteAttachmentRepository.syncFromNoteContent(note.id, marker)

    const updated = await noteRepository.findById(note.id)
    if (!updated) {
      throw new ImportServiceError('Note not found after import', 'NOTE_NOT_FOUND', 500)
    }
    searchService.indexNote(updated)
    return updated
  }

  private async overwriteWebSnapshot(
    existing: Note,
    title: string,
    rawHtml: string
  ): Promise<Note> {
    const buffer = Buffer.from(rawHtml, 'utf8')
    const safeFileTitle = title.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'snapshot'
    const attachment = await attachmentsService.createReadyFromBuffer(existing.id, existing.ownerId, {
      originalName: `${safeFileTitle}.html`,
      mimeType: 'text/html; charset=utf-8',
      buffer,
    })

    const marker = buildSnapshotMarker(attachment.id, title)
    await noteRepository.update(existing.id, { title, content: marker, icon: 'Globe' })
    const pages = await pageRepository.findByNoteId(existing.id)
    if (pages.length > 0) {
      await pageRepository.update(pages[0].id, { title, content: marker })
    } else {
      await pageRepository.create(existing.id, {
        title,
        content: marker,
        position: 0,
      })
    }
    await noteAttachmentRepository.syncFromNoteContent(existing.id, marker)

    const updated = await noteRepository.findById(existing.id)
    if (!updated) {
      throw new ImportServiceError('Note not found after overwrite', 'NOTE_NOT_FOUND', 500)
    }
    searchService.indexNote(updated)
    return updated
  }

  private titleFromMarkdown(md: string): string | null {
    const line = md.split('\n').find((l) => /^#\s+/.test(l))
    if (!line) return null
    return line.replace(/^#\s+/, '').trim() || null
  }
}

export const importService = new ImportService()
