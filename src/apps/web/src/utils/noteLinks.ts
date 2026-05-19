export const NOTE_LINK_PREFIX = 'onyka://note/'

export function buildNoteLink(noteId: string, hash?: string): string {
  const base = `${NOTE_LINK_PREFIX}${encodeURIComponent(noteId)}`
  return hash ? `${base}#${encodeURIComponent(hash)}` : base
}

export function parseNoteLink(href: string): { noteId: string; hash?: string } | null {
  if (!href.startsWith(NOTE_LINK_PREFIX)) return null
  const rest = href.slice(NOTE_LINK_PREFIX.length)
  const hashIdx = rest.indexOf('#')
  const idPart = hashIdx >= 0 ? rest.slice(0, hashIdx) : rest
  const hashPart = hashIdx >= 0 ? rest.slice(hashIdx + 1) : ''
  try {
    const noteId = decodeURIComponent(idPart)
    if (!noteId) return null
    return {
      noteId,
      hash: hashPart ? decodeURIComponent(hashPart) : undefined,
    }
  } catch {
    return null
  }
}

export function isInPageAnchor(href: string): boolean {
  return href.startsWith('#') && href.length > 1
}

export function isAllowedLinkHref(href: string): boolean {
  if (isInPageAnchor(href)) return true
  if (href.startsWith(NOTE_LINK_PREFIX)) return true
  return (
    /^https?:\/\//i.test(href) ||
    href.startsWith('/') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  )
}
