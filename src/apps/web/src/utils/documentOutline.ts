import type { Editor } from '@tiptap/react'
import { slugifyHeading } from './slugify'

export type OutlineItemKind = 'heading' | 'marker' | 'rule'

export interface OutlineItem {
  id: string
  level: number
  text: string
  pos: number
  kind: OutlineItemKind
}

type OutlineTextRule = {
  id: string
  regex: RegExp
  level: number | ((m: RegExpMatchArray) => number)
  pick: (m: RegExpMatchArray) => string
}

/** 段落行首文本规则 — 匹配则进入大纲 */
const TEXT_OUTLINE_RULES: OutlineTextRule[] = [
  {
    // Markdown ATX：# / ## / ### … 未转成 heading 节点时仍识别
    id: 'atx-heading',
    regex: /^(#{1,6})\s+(.+?)\s*$/,
    level: (m) => Math.min(6, Math.max(1, m[1].length)),
    pick: (m) => m[2].trim(),
  },
  {
    id: 'bracket-outline',
    regex: /^\[(?:大纲|outline|OUTLINE)\]\s*(.+)$/i,
    level: 2,
    pick: (m) => m[1].trim(),
  },
  {
    id: 'chinese-bracket',
    regex: /^【([^】]+)】\s*$/,
    level: 2,
    pick: (m) => m[1].trim(),
  },
  {
    id: 'colon-outline',
    regex: /^:::\s*outline\s+(.+)$/i,
    level: 2,
    pick: (m) => m[1].trim(),
  },
  {
    id: 'arrow-prefix',
    regex: /^>>\s+(.+)$/,
    level: 3,
    pick: (m) => m[1].trim(),
  },
]

export const OUTLINE_RULE_HINTS = [
  'editor.outline_rule_heading',
  'editor.outline_rule_atx',
  'editor.outline_rule_bracket',
  'editor.outline_rule_chinese',
  'editor.outline_rule_colon',
  'editor.outline_rule_arrow',
  'editor.outline_rule_marker',
] as const

function resolveLevel(rule: OutlineTextRule, match: RegExpMatchArray): number {
  return typeof rule.level === 'function' ? rule.level(match) : rule.level
}

/** 从 Markdown 源码按 ATX 标题（# ## ###）收集大纲 */
export function collectOutlineFromMarkdown(md: string): OutlineItem[] {
  const items: OutlineItem[] = []
  let offset = 0
  let inFence = false
  const lines = md.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^```/.test(trimmed) || /^~~~/.test(trimmed)) {
      inFence = !inFence
      offset += line.length + 1
      continue
    }
    if (!inFence) {
      const atx = /^(#{1,6})\s+(.+?)\s*$/.exec(trimmed)
      if (atx) {
        const text = atx[2].trim()
        if (text) {
          items.push({
            id: `md-h-${offset}`,
            level: Math.min(6, Math.max(1, atx[1].length)),
            text,
            pos: offset,
            kind: 'heading',
          })
        }
      } else {
        for (const rule of TEXT_OUTLINE_RULES) {
          if (rule.id === 'atx-heading') continue
          const match = trimmed.match(rule.regex)
          if (match) {
            const label = rule.pick(match)
            if (label) {
              items.push({
                id: `md-rule-${offset}`,
                level: resolveLevel(rule, match),
                text: label,
                pos: offset,
                kind: 'rule',
              })
            }
            break
          }
        }
      }
    }
    offset += line.length + 1
  }

  return items
}

/** 富文本模式：遍历 ProseMirror 文档节点 */
export function collectOutlineItems(editor: Editor): OutlineItem[] {
  const items: OutlineItem[] = []

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const text = node.textContent.trim()
      if (!text) return
      const id = (node.attrs.id as string | undefined) || slugifyHeading(text) || `h-${pos}`
      items.push({
        id,
        level: node.attrs.level as number,
        text,
        pos,
        kind: 'heading',
      })
      return
    }

    if (node.type.name === 'outlineMarker') {
      const label = (node.attrs.label as string) || ''
      if (!label.trim()) return
      const id = (node.attrs.id as string | undefined) || `marker-${pos}`
      items.push({
        id,
        level: (node.attrs.level as number) || 2,
        text: label.trim(),
        pos,
        kind: 'marker',
      })
      return
    }

    if (node.type.name === 'paragraph') {
      const text = node.textContent.trim()
      if (!text) return
      for (const rule of TEXT_OUTLINE_RULES) {
        const match = text.match(rule.regex)
        if (match) {
          const label = rule.pick(match)
          if (label) {
            items.push({
              id: `rule-${pos}`,
              level: resolveLevel(rule, match),
              text: label,
              pos,
              kind: 'rule',
            })
          }
          break
        }
      }
    }
  })

  return items
}

export function scrollToOutlineItem(editor: Editor, item: OutlineItem) {
  if (editor.isDestroyed) return
  try {
    editor.chain().focus().setTextSelection(item.pos + 1).run()

    const root =
      (editor.view.dom.closest('.editor-scroll-container') as HTMLElement | null) ?? editor.view.dom

    const byId = root.querySelector(`#${CSS.escape(item.id)}`)
    if (byId) {
      byId.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    const dom = editor.view.domAtPos(item.pos + 1)
    const el =
      dom.node instanceof HTMLElement
        ? dom.node
        : dom.node.parentElement
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch {
    /* editor view may be unmounted */
  }
}

export type MarkdownOutlineScroller = {
  scrollToPos: (pos: number) => void
}

/** 在 Markdown 源码编辑器中跳到大纲项对应字符偏移 */
export function scrollMarkdownToOutlinePos(scroller: MarkdownOutlineScroller, pos: number) {
  scroller.scrollToPos(pos)
}
