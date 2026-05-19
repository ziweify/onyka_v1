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

/** 段落行首文本规则 — 匹配则进入大纲 */
const TEXT_OUTLINE_RULES: Array<{
  id: string
  regex: RegExp
  level: number
  pick: (m: RegExpMatchArray) => string
}> = [
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
  'editor.outline_rule_bracket',
  'editor.outline_rule_chinese',
  'editor.outline_rule_colon',
  'editor.outline_rule_arrow',
  'editor.outline_rule_marker',
] as const

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
              level: rule.level,
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
  editor.chain().focus().setTextSelection(item.pos + 1).run()

  const root =
    (editor.view.dom.closest('.editor-scroll-container') as HTMLElement | null) ?? editor.view.dom

  const byId = root.querySelector(`#${CSS.escape(item.id)}`)
  if (byId) {
    byId.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }

  try {
    const dom = editor.view.domAtPos(item.pos + 1)
    const el =
      dom.node instanceof HTMLElement
        ? dom.node
        : dom.node.parentElement
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } catch {
    /* ignore */
  }
}
