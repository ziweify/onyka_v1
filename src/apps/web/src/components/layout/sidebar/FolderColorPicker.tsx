import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { IoCloseOutline } from 'react-icons/io5'
import { ACCENT_COLORS, useThemeStore } from '@/stores/theme'
import { isFolderColorId } from '@/utils/folderColor'

interface FolderColorPickerProps {
  selectedColor: string | null
  onSelect: (color: string | null) => void
  onClose: () => void
  anchor?: { x: number; y: number }
}

export function FolderColorPicker({ selectedColor, onSelect, onClose, anchor }: FolderColorPickerProps) {
  const { t } = useTranslation()
  const theme = useThemeStore((s) => s.theme)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const left = Math.min(anchor?.x ?? 80, window.innerWidth - 220)
  const top = Math.min(anchor?.y ?? 80, window.innerHeight - 200)

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] w-[200px] border rounded-xl p-3 floating-panel animate-scale-in"
      style={{ left, top }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
          {t('sidebar.folder_color')}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          <IoCloseOutline className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-5 gap-1.5 mb-2">
        {ACCENT_COLORS.map((color) => {
          const hex = theme === 'dark' ? color.dark : color.light
          const selected = selectedColor === color.id
          return (
            <button
              key={color.id}
              type="button"
              title={t(`theme.colors.${color.id}`, color.name)}
              onClick={() => onSelect(color.id)}
              className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 ${
                selected ? 'ring-2 ring-[var(--color-text-primary)] ring-offset-2 ring-offset-[var(--color-bg-elevated)]' : ''
              }`}
              style={{ backgroundColor: hex }}
            />
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`w-full h-7 rounded-lg text-[11px] border transition-colors ${
          !isFolderColorId(selectedColor)
            ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent)]/10'
            : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
        }`}
      >
        {t('sidebar.folder_color_default')}
      </button>
    </div>,
    document.body
  )
}
