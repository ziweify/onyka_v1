import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/index.js'
import { decrypt } from '../utils/crypto.js'
import { extractAttachmentIds } from '../utils/attachment-refs.js'
import { attachmentRepository } from './attachment.repository.js'

const { notes, notePages } = schema

export class NoteAttachmentRepository {
  async syncFromNoteContent(noteId: string, noteContent: string): Promise<void> {
    const ids = new Set(extractAttachmentIds(noteContent))

    const pageRows = await db
      .select({ content: notePages.content })
      .from(notePages)
      .where(and(eq(notePages.noteId, noteId), eq(notePages.isDeleted, false)))

    for (const row of pageRows) {
      try {
        for (const id of extractAttachmentIds(decrypt(row.content))) ids.add(id)
      } catch {
        // skip undecryptable page content
      }
    }

    const homeAttachments = await attachmentRepository.listByHomeNote(noteId)
    for (const a of homeAttachments) {
      if (a.status === 'ready') ids.add(a.id)
    }

    await attachmentRepository.syncNoteLinks(noteId, [...ids])
  }

  async syncFromPage(noteId: string): Promise<void> {
    const [noteRow] = await db
      .select({ content: notes.content })
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1)

    if (!noteRow) return
    let noteContent = ''
    try {
      noteContent = decrypt(noteRow.content)
    } catch {
      noteContent = ''
    }
    await this.syncFromNoteContent(noteId, noteContent)
  }
}

export const noteAttachmentRepository = new NoteAttachmentRepository()
