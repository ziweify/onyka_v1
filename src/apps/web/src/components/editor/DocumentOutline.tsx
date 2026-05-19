import { useEffect, useState, useCallback, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import {
  IoListOutline,
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoInformationCircleOutline,
  IoBookmarkOutline,
  IoPricetagOutline,
  IoTextOutline,
} from 'react-icons/io5'
import {
  collectOutlineItems,
  scrollToOutlineItem,
  OUTLINE_RULE_HINTS,
  type OutlineItem,
  type OutlineItemKind,
} from '@/utils/documentOutline'

interface DocumentOutlineProps {
  editor: Editor | null
  open: boolean
  onToggle?: () => void
  variant?: 'sidebar' | 'drawer'
}

const KIND_ICON: Record<OutlineItemKind, typeof IoTextOutline> = {
  heading: IoTextOutline,
  marker: IoBookmarkOutline,
  rule: IoPricetagOutline,
}

function outlineItemLevelClass(item: OutlineItem): string {
  if (item.kind === 'heading') {
    const lvl = Math.min(3, Math.max(1, item.level))
    return `document-outline-item--h${lvl}`
  }
  if (item.kind === 'marker') return 'document-outline-item--marker'
  return 'document-outline-item--rule'
}

function findActiveItem(items: OutlineItem[], scrollRoot: HTMLElement | null): string | null {
  if (!scrollRoot || items.length === 0) return items[0]?.id ?? null

  const rootTop = scrollRoot.getBoundingClientRect().top + 80
  let active: string | null = items[0]?.id ?? null

  for (const item of items) {
    const el = scrollRoot.querySelector(`#${CSS.escape(item.id)}`)
    if (el) {
      const top = el.getBoundingClientRect().top
      if (top <= rootTop) active = item.id
    }
  }
  return active
}

export function DocumentOutline({ editor, open, variant = 'sidebar' }: DocumentOutlineProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<OutlineItem[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const scrollRootRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!editor) {
      setItems([])
      return
    }

    const update = () => setItems(collectOutlineItems(editor))
    update()
    editor.on('update', update)
    editor.on('selectionUpdate', update)
    return () => {
      editor.off('update', update)
      editor.off('selectionUpdate', update)
    }
  }, [editor])

  useEffect(() => {
    if (!editor || !open) return
    scrollRootRef.current =
      (editor.view.dom.closest('.editor-scroll-container') as HTMLElement | null) ?? editor.view.dom

    const root = scrollRootRef.current
    const onScroll = () => setActiveId(findActiveItem(items, root))
    onScroll()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [editor, open, items])

  const scrollTo = useCallback(
    (item: OutlineItem) => {
      if (!editor) return
      scrollToOutlineItem(editor, item)
      setActiveId(item.id)
    },
    [editor]
  )

  if (!open || !editor) return null

  const panel = (
    <div
      className={`document-outline-panel rounded-xl backdrop-blur-sm overflow-hidden flex flex-col ${
        variant === 'drawer' ? 'w-full max-h-[50vh]' : 'w-44 xl:w-52 max-h-[min(65vh,32rem)]'
      }`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="document-outline-header w-full flex items-center gap-2 px-3 py-2.5 text-[11px] font-semibold transition-colors shrink-0"
      >
        <IoListOutline className="document-outline-header-icon w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left truncate">{t('editor.outline_title')}</span>
        <span className="document-outline-count text-[10px] tabular-nums">{items.length}</span>
        {collapsed ? (
          <IoChevronDownOutline className="w-3.5 h-3.5 opacity-70" />
        ) : (
          <IoChevronUpOutline className="w-3.5 h-3.5 opacity-70" />
        )}
      </button>

      {!collapsed && (
        <>
          {items.length === 0 ? (
            <div className="document-outline-empty px-3 pb-3 text-[11px] leading-relaxed">
              {t('editor.outline_empty')}
            </div>
          ) : (
            <ul className="px-2 py-1 overflow-y-auto flex-1 text-[11px] leading-snug min-h-0">
              {items.map((item) => {
                const Icon = KIND_ICON[item.kind]
                const isActive = activeId === item.id
                return (
                  <li key={`${item.kind}-${item.id}-${item.pos}`}>
                    <button
                      type="button"
                      onClick={() => scrollTo(item)}
                      className={`document-outline-item ${outlineItemLevelClass(item)} w-full flex items-center gap-1.5 text-left py-1.5 px-2 rounded-md transition-colors truncate ${
                        isActive ? 'is-active' : ''
                      }`}
                      style={{ paddingLeft: `${(item.level - 1) * 10 + 8}px` }}
                      title={item.text}
                    >
                      {item.kind === 'heading' ? (
                        <span className="document-outline-level-badge">H{item.level}</span>
                      ) : (
                        <Icon className="document-outline-item-icon w-3 h-3 shrink-0" />
                      )}
                      <span className="truncate">{item.text}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="document-outline-rules shrink-0 border-t">
            <button
              type="button"
              onClick={() => setShowRules((s) => !s)}
              className="document-outline-rules-toggle w-full flex items-center gap-1.5 px-3 py-2 text-[10px] transition-colors"
            >
              <IoInformationCircleOutline className="w-3.5 h-3.5 shrink-0" />
              <span>{t('editor.outline_rules_title')}</span>
            </button>
            {showRules && (
              <ul className="document-outline-empty px-3 pb-2.5 space-y-1 text-[10px] leading-relaxed list-disc list-inside">
                {OUTLINE_RULE_HINTS.map((key) => (
                  <li key={key}>{t(key)}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )

  if (variant === 'drawer') {
    return <nav aria-label={t('editor.outline_title')}>{panel}</nav>
  }

  return (
    <nav
      className="hidden lg:block absolute right-2 xl:right-4 top-16 z-10"
      aria-label={t('editor.outline_title')}
    >
      {panel}
    </nav>
  )
}
