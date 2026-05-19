export type AttachmentStatus = 'uploading' | 'ready'
export type UploadSessionStatus = 'active' | 'completed' | 'aborted'

export interface Attachment {
  id: string
  homeNoteId: string
  originalName: string
  mimeType: string
  size: number
  fingerprint: string
  status: AttachmentStatus
  createdAt: Date
  downloadUrl: string
}

export interface UploadSessionInfo {
  sessionId: string
  attachmentId: string
  totalSize: number
  receivedBytes: number
  fingerprint: string
  expiresAt: Date
}

export interface CreateUploadSessionInput {
  originalName: string
  mimeType: string
  totalSize: number
  fingerprint: string
}
