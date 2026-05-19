import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import { noteRepository } from '../repositories/note.repository.js'
import { pageRepository } from '../repositories/page.repository.js'
import { noteUploadRepository } from '../repositories/note-upload.repository.js'
import { noteAttachmentRepository } from '../repositories/note-attachment.repository.js'
import { searchService } from './search.service.js'
import { slugifyHeading } from '../utils/slugify.js'
import type { Note } from '@onyka/shared'

export type ImportFormat = 'md' | 'html'

export class ImportServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
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
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (!match) return null
  return match[1].replace(/<[^>]+>/g, '').trim() || null
}

export class ImportService {
  async importNote(
    ownerId: string,
    input: {
      format: ImportFormat
      content: string
      title?: string
      folderId?: string | null
    }
  ): Promise<Note> {
    const raw = input.content?.trim()
    if (!raw) {
      throw new ImportServiceError('Content is required', 'CONTENT_REQUIRED', 400)
    }

    let html: string
    if (input.format === 'md') {
      html = DOMPurify.sanitize(marked.parse(raw) as string)
    } else {
      html = DOMPurify.sanitize(raw)
    }

    const title =
      input.title?.trim() ||
      (input.format === 'md' ? this.titleFromMarkdown(raw) : extractTitleFromHtml(html)) ||
      'Imported note'

    const note = await noteRepository.create(ownerId, {
      title,
      content: html,
      folderId: input.folderId ?? null,
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

  private titleFromMarkdown(md: string): string | null {
    const line = md.split('\n').find((l) => /^#\s+/.test(l))
    if (!line) return null
    return line.replace(/^#\s+/, '').trim() || null
  }
}

export const importService = new ImportService()
