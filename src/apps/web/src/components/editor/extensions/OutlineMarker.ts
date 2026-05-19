import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { nanoid } from 'nanoid'
import { slugifyHeading } from '@/utils/slugify'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    outlineMarker: {
      insertOutlineMarker: (attrs?: { label?: string; level?: number }) => ReturnType
    }
  }
}

const outlineMarkerIdKey = new PluginKey('outlineMarkerIds')

export const OutlineMarker = Node.create({
  name: 'outlineMarker',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('id'),
        renderHTML: (attrs: { id?: string | null }) => (attrs.id ? { id: attrs.id } : {}),
      },
      label: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-label') || el.textContent || '',
        renderHTML: (attrs: { label?: string }) => ({ 'data-label': attrs.label || '' }),
      },
      level: {
        default: 2,
        parseHTML: (el: HTMLElement) => {
          const v = parseInt(el.getAttribute('data-level') || '2', 10)
          return Number.isFinite(v) ? Math.min(4, Math.max(1, v)) : 2
        },
        renderHTML: (attrs: { level?: number }) => ({ 'data-level': String(attrs.level ?? 2) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="outline-marker"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'outline-marker',
        class: 'outline-marker-block',
        id: node.attrs.id,
        'data-label': node.attrs.label,
        'data-level': node.attrs.level,
      }),
      ['span', { class: 'outline-marker-chip' }, `📍 ${node.attrs.label || ''}`],
    ]
  },

  addCommands() {
    return {
      insertOutlineMarker:
        (attrs) =>
        ({ commands }) => {
          const label = attrs?.label?.trim() || '新章节'
          const id = slugifyHeading(label) || nanoid(8)
          return commands.insertContent({
            type: this.name,
            attrs: {
              id,
              label,
              level: attrs?.level ?? 2,
            },
          })
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: outlineMarkerIdKey,
        appendTransaction: (_transactions, _oldState, newState) => {
          const tr = newState.tr
          let changed = false
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'outlineMarker') return
            if (node.attrs.id) return
            const label = (node.attrs.label as string) || 'section'
            const id = slugifyHeading(label) || nanoid(8)
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, id })
            changed = true
          })
          return changed ? tr : null
        },
      }),
    ]
  },
})
