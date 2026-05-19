/** Plain-text excerpt from note HTML/JSON content for cards and thumbnails. */
export function noteContentPreview(content: string, maxLen = 140): string {
  if (!content?.trim()) return ''

  let text = content.trim()
  if (text.startsWith('{')) {
    try {
      const doc = JSON.parse(text) as { content?: Array<{ text?: string }> }
      const parts: string[] = []
      const walk = (nodes: unknown): void => {
        if (!nodes || typeof nodes !== 'object') return
        if (Array.isArray(nodes)) {
          nodes.forEach(walk)
          return
        }
        const n = nodes as Record<string, unknown>
        if (typeof n.text === 'string') parts.push(n.text)
        if (n.content) walk(n.content)
      }
      walk(doc)
      text = parts.join(' ')
    } catch {
      /* fall through */
    }
  }

  text = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen)}…`
}
