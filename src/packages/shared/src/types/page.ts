/** Page editor / document type */
export type NotePageMode = 'text' | 'markdown'

export interface NotePage {
  id: string
  noteId: string
  title: string
  content: string
  /** `text` = rich TipTap; `markdown` = MD source with Cursor-style highlighting */
  mode: NotePageMode
  position: number
  isLocked: boolean
  isDeleted: boolean
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface NotePageCreateInput {
  title?: string
  content?: string
  mode?: NotePageMode
  position?: number
}

export interface NotePageUpdateInput {
  title?: string
  content?: string
  mode?: NotePageMode
  isLocked?: boolean
}

export interface NotePageReorderInput {
  newPosition: number
}
