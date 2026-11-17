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
  /** When true, visitors with a valid share-access token may post anonymous comments. */
  allowGuestComments: boolean
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
  allowGuestComments?: boolean
  /** P1: only view is accepted */
  permission?: NoteShareLinkPermission
}

export interface NoteShareLinkUpdateInput {
  password?: string | null
  clearPassword?: boolean
  expiresAt?: string | null
  maxViews?: number | null
  label?: string | null
  allowGuestComments?: boolean
  status?: NoteShareLinkStatus
}

/** Public author card shown on shared / forum-style pages. */
export interface PublicShareAuthor {
  username: string
  name: string
  avatarUrl?: string
  avatarColor?: string
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
  allowGuestComments: boolean
  author: PublicShareAuthor
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
  allowGuestComments: boolean
  author: PublicShareAuthor
  /** Note updatedAt for floor-1 timestamp */
  updatedAt: Date
}
