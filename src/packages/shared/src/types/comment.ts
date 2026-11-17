export interface Comment {
  id: string
  noteId: string
  userId: string
  parentId: string | null
  content: string
  /** Display nickname when posted anonymously via a share link. */
  guestName: string | null
  shareLinkId: string | null
  /** True when authored by the synthetic share-guest account. */
  isGuest: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CommentWithUser extends Comment {
  user: {
    id: string
    username: string
    name: string
    avatarUrl?: string
    avatarColor?: string
  }
}

export interface CommentWithReplies extends CommentWithUser {
  replies: CommentWithUser[]
}

export interface CommentCreateInput {
  noteId: string
  content: string
  parentId?: string
}

export interface CommentUpdateInput {
  content: string
}

export interface CommentsResponse {
  comments: CommentWithReplies[]
}

export interface CommentResponse {
  comment: CommentWithUser
}

export interface CommentCountResponse {
  count: number
}

/** Public (share-link) guest comment create body. */
export interface PublicGuestCommentCreateInput {
  content: string
  parentId?: string
  /** Optional nickname shown as “访客 · name”. Max 40 chars. */
  guestName?: string
}
