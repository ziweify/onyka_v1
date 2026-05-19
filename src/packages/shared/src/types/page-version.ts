export type NoteVersionAction = 'manual' | 'checkpoint' | 'before_restore' | 'restore'

export interface NoteVersionAuthor {
  id: string
  username: string
  name: string
}

export interface NoteVersionSummary {
  id: string
  noteId: string
  notePageId: string
  pageTitle: string
  noteTitle: string
  action: NoteVersionAction
  createdBy: NoteVersionAuthor
  createdAt: Date
  wordCount: number
}

export interface NoteVersion extends NoteVersionSummary {
  content: string
}

export interface NoteVersionCreateInput {
  action?: NoteVersionAction
}
