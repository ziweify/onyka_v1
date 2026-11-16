import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoMoonOutline, IoSunnyOutline, IoColorWandOutline, IoCheckmarkOutline } from 'react-icons/io5'
import { useTranslation } from 'react-i18next'
import { useThemeStore, THEME_BASES } from '@/stores/theme'

interface ThemeToggleProps {
  collapsed?: boolean
}

export function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const { t } = useTranslation()
  const {
    theme,
    setTheme,
    getCurrentThemeBase,
    setThemeBase,
    autoFolderColors,
    setAutoFolderColors,
  } = useThemeStore()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)
  const moreBtnRef = useRef<HTMLButtonElement>(null)
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (!containerRef.current?.contains(target) && !portalRef.current?.contains(target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !moreBtnRef.current) return
    const rect = moreBtnRef.current.getBoundingClientRect()
    const popoverHeight = 340
    const popoverWidth = 280

    let top: number
    let left: number

    if (collapsed) {
      top = rect.top + rect.height / 2 - popoverHeight / 2
      left = rect.right + 8
      if (left + popoverWidth > window.innerWidth - 16) {
        left = rect.left - popoverWidth - 8
      }
    } else {
      top = rect.top - popoverHeight - 8
      left = rect.left
      if (left < 16) left = 16
      if (left + popoverWidth > window.innerWidth - 16) {
        left = window.innerWidth - popoverWidth - 16
      }
      if (top < 16) top = rect.bottom + 8
    }

    if (top < 16) top = 16
    if (top + popoverHeight > window.innerHeight - 16) {
      top = window.innerHeight - popoverHeight - 16
    }

    setPopoverPosition({ top, left })
  }, [isOpen, collapsed, theme])

  const currentThemeBase = getCurrentThemeBase()
  const availableThemes = THEME_BASES.filter((item) => item.mode === theme)

  const btnBase = collapsed
    ? 'p-1.5 rounded-md'
    : 'w-7 h-7 rounded-lg'
  const activeCls = 'bg-[var(--color-bg-primary)] text-[var(--color-accent)] shadow-sm'
  const idleCls = 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'

  const popover = (
    <div className="rounded-2xl border p-4 w-[280px] floating-panel">
      <p className="text-[13px] font-medium text-[var(--color-text-primary)] mb-3">
        {t('theme.style_picker_title')}
      </p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {availableThemes.map((themeOption) => {
          const isSelected = currentThemeBase === themeOption.id
          return (
            <button
              key={`${themeOption.mode}-${themeOption.id}`}
              type="button"
              onClick={() => setThemeBase(themeOption.id)}
              className={`
                group relative flex flex-col rounded-lg overflow-hidden text-left
                transition-all duration-150
                ${isSelected
                  ? 'ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-[var(--color-bg-elevated)]'
                  : 'hover:ring-1 hover:ring-[var(--color-border)]'
                }
              `}
            >
              <div
                className="relative aspect-[4/3] w-full"
                style={{ backgroundColor: themeOption.preview.bg }}
              >
                <div
                  className="absolute left-1 top-1 bottom-1 w-2 rounded-sm opacity-25"
                  style={{ backgroundColor: themeOption.preview.text }}
                />
                <div className="absolute left-4 top-2 right-1.5 space-y-1">
                  <div
                    className="h-1 w-3/4 rounded-full opacity-80"
                    style={{ backgroundColor: themeOption.preview.text }}
                  />
                  <div
                    className="h-0.5 w-full rounded-full opacity-30"
                    style={{ backgroundColor: themeOption.preview.text }}
                  />
                </div>
                <div
                  className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: themeOption.preview.accent }}
                />
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ backgroundColor: themeOption.preview.accent }}
                    >
                      <IoCheckmarkOutline className="h-3 w-3 text-white" />
                    </div>
                  </div>
                )}
              </div>
              <div
                className="py-1 px-1 text-[10px] font-medium text-center truncate"
                style={{
                  backgroundColor: themeOption.preview.bg,
                  color: themeOption.preview.text,
                }}
              >
                {themeOption.name}
              </div>
            </button>
          )
        })}
      </div>

      <div className="pt-3 border-t border-[var(--color-border-subtle)]">
        <button
          type="button"
          onClick={() => setAutoFolderColors(!autoFolderColors)}
          className="w-full flex items-start gap-3 text-left rounded-xl px-2.5 py-2 hover:bg-[var(--color-bg-tertiary)] transition-colors"
        >
          <div
            className={`mt-0.5 w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${
              autoFolderColors ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                autoFolderColors ? 'left-[18px]' : 'left-0.5'
              }`}
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-[var(--color-text-primary)]">
              {t('theme.auto_folder_colors')}
            </p>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 leading-snug">
              {t('theme.auto_folder_colors_desc')}
            </p>
          </div>
        </button>
      </div>
    </div>
  )

  if (collapsed) {
    return (
      <div className="relative group/theme flex flex-col items-center gap-1" ref={containerRef}>
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label={theme === 'dark' ? t('settings.theme_light') : t('settings.theme_dark')}
        >
          <div className="relative w-5 h-5">
            <IoSunnyOutline
              className={`absolute inset-0 w-full h-full transition-all duration-500 ${
                theme === 'dark' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-180 scale-50'
              }`}
            />
            <IoMoonOutline
              className={`absolute inset-0 w-full h-full transition-all duration-500 ${
                theme === 'light' ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-180 scale-50'
              }`}
            />
          </div>
        </button>
        <button
          ref={moreBtnRef}
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className={`p-2 transition-colors ${
            isOpen || autoFolderColors
              ? 'text-[var(--color-accent)]'
              : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'
          }`}
          aria-label={t('theme.style_picker_title')}
        >
          <IoColorWandOutline className="w-5 h-5" />
        </button>
        {isOpen &&
          createPortal(
            <div
              ref={portalRef}
              className="fixed z-[9999] animate-scale-in"
              style={{ top: popoverPosition.top, left: popoverPosition.left }}
            >
              {popover}
            </div>,
            document.body
          )}
      </div>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center p-0.5 rounded-xl bg-[var(--color-bg-tertiary)]">
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`${btnBase} flex items-center justify-center transition-all duration-150 ${
            theme === 'light' ? activeCls : idleCls
          }`}
          aria-label={t('settings.theme_light')}
          title={t('settings.theme_light')}
        >
          <IoSunnyOutline className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`${btnBase} flex items-center justify-center transition-all duration-150 ${
            theme === 'dark' ? activeCls : idleCls
          }`}
          aria-label={t('settings.theme_dark')}
          title={t('settings.theme_dark')}
        >
          <IoMoonOutline className="w-3.5 h-3.5" />
        </button>
        <button
          ref={moreBtnRef}
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className={`${btnBase} flex items-center justify-center transition-all duration-150 ${
            isOpen ? activeCls : idleCls
          }`}
          aria-label={t('theme.style_picker_title')}
          title={t('theme.style_picker_title')}
        >
          <IoColorWandOutline className="w-3.5 h-3.5" />
        </button>
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={portalRef}
            className="fixed z-[9999] animate-slide-up"
            style={{ top: popoverPosition.top, left: popoverPosition.left }}
          >
            {popover}
          </div>,
          document.body
        )}
    </div>
  )
}
