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
  collectOutlineFromMarkdown,
  scrollToOutlineItem,
  scrollMarkdownToOutlinePos,
  OUTLINE_RULE_HINTS,
  type OutlineItem,
  type OutlineItemKind,
} from '@/utils/documentOutline'

interface DocumentOutlineProps {
  editor?: Editor | null
  /** Markdown 源码模式：按 # / ## / ### 识别大纲 */
  markdownSource?: string | null
  markdownScroller?: { scrollToPos: (pos: number) => void } | null
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

export function DocumentOutline({
  editor = null,
  markdownSource = null,
  markdownScroller = null,
  open,
  variant = 'sidebar',
}: DocumentOutlineProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<OutlineItem[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const scrollRootRef = useRef<HTMLElement | null>(null)
  const mdMode = markdownSource != null
  const liveEditor = editor && !editor.isDestroyed ? editor : null

  useEffect(() => {
    if (mdMode) {
      setItems(collectOutlineFromMarkdown(markdownSource || ''))
      return
    }

    if (!liveEditor) {
      setItems([])
      return
    }

    const update = () => {
      if (liveEditor.isDestroyed) return
      setItems(collectOutlineItems(liveEditor))
    }
    update()
    liveEditor.on('update', update)
    liveEditor.on('selectionUpdate', update)
    return () => {
      liveEditor.off('update', update)
      liveEditor.off('selectionUpdate', update)
    }
  }, [liveEditor, mdMode, markdownSource])

  useEffect(() => {
    if (!open || mdMode || !liveEditor) return
    try {
      scrollRootRef.current =
        (liveEditor.view.dom.closest('.editor-scroll-container') as HTMLElement | null) ??
        liveEditor.view.dom
    } catch {
      return
    }

    const root = scrollRootRef.current
    if (!root) return
    const onScroll = () => setActiveId(findActiveItem(items, root))
    onScroll()
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [liveEditor, open, items, mdMode])

  const scrollTo = useCallback(
    (item: OutlineItem) => {
      if (mdMode && markdownScroller) {
        scrollMarkdownToOutlinePos(markdownScroller, item.pos)
        setActiveId(item.id)
        return
      }
      if (!liveEditor) return
      scrollToOutlineItem(liveEditor, item)
      setActiveId(item.id)
    },
    [liveEditor, mdMode, markdownScroller]
  )

  if (!open) return null
  if (!mdMode && !liveEditor) return null

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
              {t(mdMode ? 'editor.outline_empty_md' : 'editor.outline_empty')}
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
                {(mdMode
                  ? OUTLINE_RULE_HINTS.filter((k) => k !== 'editor.outline_rule_heading' && k !== 'editor.outline_rule_marker')
                  : OUTLINE_RULE_HINTS
                ).map((key) => (
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
