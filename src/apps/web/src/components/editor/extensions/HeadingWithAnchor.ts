import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { slugifyHeading } from '@/utils/slugify'

const headingIdPluginKey = new PluginKey('headingAnchorIds')

function ensureHeadingIds(doc: import('@tiptap/pm/model').Node) {
  const used = new Set<string>()
  const fixes: { pos: number; id: string }[] = []

  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return
    const text = node.textContent
    let id = (node.attrs.id as string | null) || ''
    if (!id) {
      const base = slugifyHeading(text)
      id = base
      let n = 2
      while (used.has(id)) {
        id = `${base}-${n++}`
      }
    } else {
      let candidate = id
      let n = 2
      while (used.has(candidate)) {
        candidate = `${id}-${n++}`
      }
      id = candidate
    }
    used.add(id)
    if (node.attrs.id !== id) {
      fixes.push({ pos, id })
    }
  })

  return fixes
}

/** Auto-assign stable ids to headings for TOC and in-page anchor links */
export const HeadingWithAnchor = Extension.create({
  name: 'headingWithAnchor',

  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          id: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('id'),
            renderHTML: (attributes: { id?: string | null }) => {
              if (!attributes.id) return {}
              return { id: attributes.id }
            },
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: headingIdPluginKey,
        appendTransaction: (_transactions, _oldState, newState) => {
          const fixes = ensureHeadingIds(newState.doc)
          if (fixes.length === 0) return null

          const tr = newState.tr
          let changed = false
          for (let i = fixes.length - 1; i >= 0; i--) {
            const { pos, id } = fixes[i]
            const node = newState.doc.nodeAt(pos)
            if (node?.type.name === 'heading' && node.attrs.id !== id) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, id })
              changed = true
            }
          }
          return changed ? tr : null
        },
      }),
    ]
  },
})
