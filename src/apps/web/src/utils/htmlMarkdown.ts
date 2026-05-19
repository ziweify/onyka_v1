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
  const raw = marked.parse(markdown, { async: false }) as string
  return cleanMarkdownHtml(raw)
}

export function htmlToMarkdown(html: string): string {
  if (!html?.trim()) return ''
  return turndown.turndown(html)
}
