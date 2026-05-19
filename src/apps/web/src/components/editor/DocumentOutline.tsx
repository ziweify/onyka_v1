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
      className={`rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]/95 backdrop-blur-sm shadow-sm overflow-hidden flex flex-col ${
        variant === 'drawer' ? 'w-full max-h-[50vh]' : 'w-44 xl:w-52 max-h-[min(65vh,32rem)]'
      }`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors shrink-0"
      >
        <IoListOutline className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left truncate">{t('editor.outline_title')}</span>
        <span className="text-[10px] font-normal text-[var(--color-text-tertiary)]">{items.length}</span>
        {collapsed ? (
          <IoChevronDownOutline className="w-3.5 h-3.5" />
        ) : (
          <IoChevronUpOutline className="w-3.5 h-3.5" />
        )}
      </button>

      {!collapsed && (
        <>
          {items.length === 0 ? (
            <div className="px-3 pb-3 text-[11px] text-[var(--color-text-tertiary)] leading-relaxed">
              {t('editor.outline_empty')}
            </div>
          ) : (
            <ul className="px-2 pb-1 overflow-y-auto flex-1 text-[11px] leading-snug min-h-0">
              {items.map((item) => {
                const Icon = KIND_ICON[item.kind]
                const isActive = activeId === item.id
                return (
                  <li key={`${item.kind}-${item.id}-${item.pos}`}>
                    <button
                      type="button"
                      onClick={() => scrollTo(item)}
                      className={`w-full flex items-center gap-1.5 text-left py-1.5 px-2 rounded-md transition-colors truncate ${
                        isActive
                          ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-medium'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-tertiary)]'
                      }`}
                      style={{ paddingLeft: `${(item.level - 1) * 10 + 8}px` }}
                      title={item.text}
                    >
                      <Icon className="w-3 h-3 shrink-0 opacity-60" />
                      <span className="truncate">{item.text}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="border-t border-[var(--color-border-subtle)] shrink-0">
            <button
              type="button"
              onClick={() => setShowRules((s) => !s)}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-[10px] text-[var(--color-text-tertiary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            >
              <IoInformationCircleOutline className="w-3.5 h-3.5 shrink-0" />
              <span>{t('editor.outline_rules_title')}</span>
            </button>
            {showRules && (
              <ul className="px-3 pb-2.5 space-y-1 text-[10px] text-[var(--color-text-tertiary)] leading-relaxed list-disc list-inside">
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
