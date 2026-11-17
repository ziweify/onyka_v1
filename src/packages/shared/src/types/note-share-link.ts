export type NoteShareLinkPermission = 'view' | 'edit'
export type NoteShareLinkStatus = 'active' | 'revoked'

export interface NoteShareLink {
  id: string
  token: string
  noteId: string
  ownerId: string
  permission: NoteShareLinkPermission
  hasPassword: boolean
  expiresAt: Date | null
  maxViews: number | null
  viewCount: number
  label: string | null
  status: NoteShareLinkStatus
  lastAccessedAt: Date | null
  createdAt: Date
  updatedAt: Date
  /** Absolute path for the guest URL, e.g. /s/xK9mQ2pL */
  path: string
}

export interface NoteShareLinkWithNote extends NoteShareLink {
  noteTitle: string
}

export interface NoteShareLinkCreateInput {
  password?: string | null
  /** ISO date string; omit for default (7 days); null for no expiry */
  expiresAt?: string | null
  maxViews?: number | null
  label?: string | null
  /** P1: only view is accepted */
  permission?: NoteShareLinkPermission
}

export interface NoteShareLinkUpdateInput {
  password?: string | null
  clearPassword?: boolean
  expiresAt?: string | null
  maxViews?: number | null
  label?: string | null
  status?: NoteShareLinkStatus
}

export interface PublicShareLinkMeta {
  token: string
  noteTitle: string
  permission: NoteShareLinkPermission
  needsPassword: boolean
  expiresAt: Date | null
  maxViews: number | null
  viewCount: number
  status: NoteShareLinkStatus
  remainingViews: number | null
  isExpired: boolean
  isExhausted: boolean
}

export interface PublicSharePage {
  id: string
  title: string
  content: string
  position: number
}

export interface PublicShareContent {
  noteTitle: string
  pages: PublicSharePage[]
  permission: NoteShareLinkPermission
  expiresAt: Date | null
  maxViews: number | null
  viewCount: number
  remainingViews: number | null
}
