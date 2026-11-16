import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoCodeSlashOutline,
  IoColorPaletteOutline,
  IoKeyOutline,
  IoLinkOutline,
  IoLockClosedOutline,
  IoConstructOutline,
} from 'react-icons/io5'
import { useUtilityDockStore, type UtilityToolId } from '@/stores/utilityDock'
import { JsonTool } from './tools/JsonTool'
import { StringCodecTool } from './tools/StringCodecTool'
import { GzipTool } from './tools/GzipTool'
import { CryptoTool } from './tools/CryptoTool'
import { PasswordTool } from './tools/PasswordTool'
import { ColorTool } from './tools/ColorTool'

const TOOLS: { id: UtilityToolId; icon: typeof IoCodeSlashOutline; labelKey: string }[] = [
  { id: 'json', icon: IoCodeSlashOutline, labelKey: 'utilities.tool_json' },
  { id: 'string', icon: IoLinkOutline, labelKey: 'utilities.tool_string' },
  { id: 'gzip', icon: IoConstructOutline, labelKey: 'utilities.tool_gzip' },
  { id: 'crypto', icon: IoLockClosedOutline, labelKey: 'utilities.tool_crypto' },
  { id: 'password', icon: IoKeyOutline, labelKey: 'utilities.tool_password' },
  { id: 'color', icon: IoColorPaletteOutline, labelKey: 'utilities.tool_color' },
]

function ToolBody({ tool }: { tool: UtilityToolId }) {
  switch (tool) {
    case 'json':
      return <JsonTool />
    case 'string':
      return <StringCodecTool />
    case 'gzip':
      return <GzipTool />
    case 'crypto':
      return <CryptoTool />
    case 'password':
      return <PasswordTool />
    case 'color':
      return <ColorTool />
    default:
      return null
  }
}

export function UtilityDock() {
  const { t } = useTranslation()
  const { expanded, heightRatio, activeTool, setExpanded, toggleExpanded, setHeightRatio, setActiveTool } =
    useUtilityDockStore()
  const dragRef = useRef<{ startY: number; startRatio: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const onResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!dragRef.current || !containerRef.current) return
      const parent = containerRef.current.parentElement
      if (!parent) return
      const parentHeight = parent.getBoundingClientRect().height
      if (parentHeight <= 0) return
      const delta = dragRef.current.startY - e.clientY
      const next = dragRef.current.startRatio + delta / parentHeight
      setHeightRatio(next)
    },
    [setHeightRatio]
  )

  const onResizeEnd = useCallback(() => {
    dragRef.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onResizeMove)
    window.removeEventListener('mouseup', onResizeEnd)
  }, [onResizeMove])

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startRatio: heightRatio }
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onResizeMove)
    window.addEventListener('mouseup', onResizeEnd)
  }

  useEffect(() => () => onResizeEnd(), [onResizeEnd])

  return (
    <div
      ref={containerRef}
      className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col"
      style={expanded ? { height: `${Math.round(heightRatio * 1000) / 10}%` } : undefined}
    >
      {expanded && (
        <div
          onMouseDown={onResizeStart}
          className="h-1.5 cursor-row-resize shrink-0 group flex items-center justify-center hover:bg-[var(--color-accent)]/10"
          title={t('utilities.resize')}
        >
          <div className="w-10 h-0.5 rounded-full bg-[var(--color-border)] group-hover:bg-[var(--color-accent)]" />
        </div>
      )}

      <div className="flex items-center gap-1 px-2 h-9 shrink-0 border-b border-[var(--color-border-subtle)]">
        <button
          type="button"
          onClick={toggleExpanded}
          className="h-7 px-2 rounded-md text-[11px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] inline-flex items-center gap-1"
          title={expanded ? t('utilities.collapse') : t('utilities.expand')}
        >
          {expanded ? <IoChevronDownOutline className="w-3.5 h-3.5" /> : <IoChevronUpOutline className="w-3.5 h-3.5" />}
          {t('utilities.title')}
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-0.5 overflow-x-auto">
          {TOOLS.map(({ id, icon: Icon, labelKey }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTool(id)}
              className={`h-7 px-2 rounded-md text-[11px] whitespace-nowrap inline-flex items-center gap-1 transition-colors ${
                expanded && activeTool === id
                  ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                  : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t(labelKey)}</span>
            </button>
          ))}
        </div>

        {expanded && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
            title={t('utilities.collapse')}
          >
            <IoChevronDownOutline className="w-4 h-4" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="flex-1 min-h-0 overflow-hidden p-2 md:p-3">
          <ToolBody tool={activeTool} />
        </div>
      )}
    </div>
  )
}
