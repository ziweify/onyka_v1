import { useEffect, useState, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { IoListOutline, IoChevronDownOutline, IoChevronUpOutline } from 'react-icons/io5'

export interface TocItem {
  id: string
  level: number
  text: string
  pos: number
}

function collectHeadings(editor: Editor): TocItem[] {
  const items: TocItem[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return
    const id = node.attrs.id as string | undefined
    const text = node.textContent.trim()
    if (!text) return
    items.push({
      id: id || `h-${pos}`,
      level: node.attrs.level as number,
      text,
      pos,
    })
  })
  return items
}

interface TableOfContentsProps {
  editor: Editor | null
  collapsed?: boolean
}

export function TableOfContents({ editor, collapsed: defaultCollapsed = false }: TableOfContentsProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<TocItem[]>([])
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  useEffect(() => {
    if (!editor) {
      setItems([])
      return
    }

    const update = () => setItems(collectHeadings(editor))
    update()
    editor.on('update', update)
    editor.on('selectionUpdate', update)
    return () => {
      editor.off('update', update)
      editor.off('selectionUpdate', update)
    }
  }, [editor])

  const scrollTo = useCallback(
    (item: TocItem) => {
      if (!editor) return
      editor.chain().focus().setTextSelection(item.pos + 1).run()
      const el = editor.view.dom.querySelector(`#${CSS.escape(item.id)}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [editor]
  )

  if (!editor || items.length < 2) return null

  return (
    <nav
      className="hidden lg:block absolute right-2 xl:right-4 top-20 z-10 w-40 xl:w-44 max-h-[min(60vh,28rem)]"
      aria-label={t('editor.toc_title')}
    >
      <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/95 backdrop-blur-sm shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
        >
          <IoListOutline className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1 text-left truncate">{t('editor.toc_title')}</span>
          {collapsed ? (
            <IoChevronDownOutline className="w-3.5 h-3.5" />
          ) : (
            <IoChevronUpOutline className="w-3.5 h-3.5" />
          )}
        </button>
        {!collapsed && (
          <ul className="px-2 pb-2 overflow-y-auto max-h-[min(52vh,24rem)] text-[11px] leading-snug">
            {items.map((item) => (
              <li key={`${item.id}-${item.pos}`}>
                <button
                  type="button"
                  onClick={() => scrollTo(item)}
                  className="w-full text-left py-1 px-2 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)] transition-colors truncate"
                  style={{ paddingLeft: `${(item.level - 1) * 8 + 8}px` }}
                  title={item.text}
                >
                  {item.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  )
}
