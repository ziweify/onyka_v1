import { marked } from 'marked'
import TurndownService from 'turndown'
import { slugifyHeading } from './slugify'

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
})

turndown.addRule('onykaNoteLink', {
  filter: (node: HTMLElement) =>
    node.nodeName === 'A' &&
    (node as HTMLAnchorElement).getAttribute('href')?.startsWith('onyka://note/') === true,
  replacement: (_content: string, node: HTMLElement) => {
    const href = (node as HTMLAnchorElement).getAttribute('href') || ''
    const text = (node as HTMLAnchorElement).textContent || href
    return `[${text}](${href})`
  },
})

marked.use({
  renderer: {
    heading({ text, depth }: { text: string; depth: number }) {
      const id = slugifyHeading(text)
      return `<h${depth} id="${id}">${text}</h${depth}>\n`
    },
  },
})

/** Clean HTML from marked for TipTap — preserve heading ids */
export function cleanMarkdownHtml(html: string): string {
  let cleaned = html
    .replace(/\s*<\/?thead>\s*/g, '')
    .replace(/\s*<\/?tbody>\s*/g, '')
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/<code([^>]*)>([\s\S]*?)\n<\/code>/g, '<code$1>$2</code>')

  cleaned = cleaned.replace(/<(td|th)>((?:(?!<\/?(?:p|h[1-6]|ul|ol|blockquote|pre)[ >])[\s\S])*?)<\/\1>/g,
    '<$1><p>$2</p></$1>')

  return cleaned
}

export function markdownToHtml(markdown: string): string {
  // If buffer still has turndown-style escapes, clean them before parse
  const raw = marked.parse(unescapeFalseMarkdownEscapes(markdown), { async: false }) as string
  return cleanMarkdownHtml(raw)
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&gt;/gi, '>')
    .replace(/&lt;/gi, '<')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
}

function stripTagsKeepText(html: string): string {
  return decodeBasicEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
}

/** True when lines look like Markdown source (ATX, fences, tables, quotes…). */
export function looksLikeMarkdownSource(text: string): boolean {
  const lines = text.split('\n')
  let score = 0
  for (const line of lines) {
    const t = line.trim()
    if (/^#{1,6}\s+\S/.test(t)) score += 3
    else if (/^>\s?/.test(t)) score += 2
    else if (/^```/.test(t)) score += 4
    else if (/^\|(.+\|)+$/.test(t)) score += 2
    else if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) score += 2
    else if (/^([-*+]|\d+\.)\s+\S/.test(t)) score += 1
    else if (/\*\*[^*]+\*\*|`[^`]+`/.test(t)) score += 1
  }
  return score >= 4
}

/**
 * TipTap often stores pasted Markdown as consecutive <p>…</p> lines.
 * Recover the original source instead of running turndown (which escapes # > `).
 */
function extractMarkdownFromParagraphHtml(html: string): string | null {
  const trimmed = html.trim()
  if (!trimmed) return null

  const tags = trimmed.match(/<\/?[a-z][^>]*>/gi) || []
  if (tags.length === 0) {
    const plain = decodeBasicEntities(trimmed)
    return looksLikeMarkdownSource(plain) ? plain : null
  }

  const structural = tags.filter((t) => !/^<\/?(p|br|span|div)\b/i.test(t))
  // Allow a little inline noise; reject real rich structure (h1/ul/pre/table…)
  if (structural.length > Math.max(2, tags.length * 0.15)) return null

  const paras: string[] = []
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(trimmed)) !== null) {
    const line = stripTagsKeepText(m[1]).replace(/\n+/g, ' ').trimEnd()
    paras.push(line)
  }

  if (paras.length < 2) return null

  // Preserve blank lines between blocks (empty <p></p> or whitespace-only)
  const text = paras.join('\n').replace(/[ \t]+\n/g, '\n')
  if (!looksLikeMarkdownSource(text)) return null
  return text
}

/** Undo turndown false escapes like \# \> \` \`\`\` 1\. in headings */
export function unescapeFalseMarkdownEscapes(md: string): string {
  return md
    .replace(/^\\(#{1,6})(\s)/gm, '$1$2')
    .replace(/^\\([>*+\-])(\s)/gm, '$1$2')
    .replace(/^\\(---|\*\*\*|___)$/gm, '$1')
    .replace(/^(\\`){3,}([^\n`]*)/gm, (_all, _ticks: string, info: string) => {
      const count = (_all.match(/\\`/g) || []).length
      // \```lang → ```lang
      if (count >= 3) return '```' + info.replace(/\\`/g, '`')
      return _all
    })
    .replace(/\\`/g, '`')
    .replace(/\\\|/g, '|')
    .replace(/^(#{1,6}\s+\d+)\\(\.)/gm, '$1$2')
    .replace(/\\([.#\[\]()])/g, '$1')
}

function softenTurndownOutput(md: string): string {
  return unescapeFalseMarkdownEscapes(md)
    // turndown pads list markers with extra spaces: "-   item" → "- item"
    .replace(/^(\s*[-*+])\s{2,}/gm, '$1 ')
}

export function htmlToMarkdown(html: string): string {
  if (!html?.trim()) return ''

  const fromParagraphs = extractMarkdownFromParagraphHtml(html)
  if (fromParagraphs != null) {
    return unescapeFalseMarkdownEscapes(fromParagraphs)
  }

  return softenTurndownOutput(turndown.turndown(html))
}
