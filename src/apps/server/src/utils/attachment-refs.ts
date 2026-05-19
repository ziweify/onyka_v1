/** Extract attachment IDs from download URLs or onyka:// links in note HTML. */
const API_ATTACHMENT_RE = /\/api\/attachments\/([A-Za-z0-9_-]{10,})/g
const OYKA_ATTACHMENT_RE = /onyka:\/\/attachment\/([A-Za-z0-9_-]{10,})/gi

export function extractAttachmentIds(content: string): string[] {
  const ids = new Set<string>()
  for (const re of [API_ATTACHMENT_RE, OYKA_ATTACHMENT_RE]) {
    re.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = re.exec(content)) !== null) {
      ids.add(match[1])
    }
  }
  return [...ids]
}
