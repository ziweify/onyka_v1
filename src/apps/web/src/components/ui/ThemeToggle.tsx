import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoMoonOutline, IoSunnyOutline, IoCheckmarkOutline } from 'react-icons/io5'
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
  const buttonRef = useRef<HTMLButtonElement>(null)
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
    if (!isOpen || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const popoverHeight = 360
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
  const label = t('theme.style_picker_title')

  const popover = (
    <div className="rounded-2xl border p-4 w-[280px] floating-panel">
      <p className="text-[13px] font-medium text-[var(--color-text-primary)] mb-3">
        {t('theme.style_picker_title')}
      </p>

      <div className="flex p-1 rounded-lg bg-[var(--color-bg-tertiary)] mb-4">
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            theme === 'light'
              ? 'bg-[var(--color-bg-primary)] text-[var(--color-accent)] shadow-sm'
              : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <IoSunnyOutline className="w-3.5 h-3.5" />
          {t('settings.theme_light')}
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            theme === 'dark'
              ? 'bg-[var(--color-bg-primary)] text-[var(--color-accent)] shadow-sm'
              : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
          }`}
        >
          <IoMoonOutline className="w-3.5 h-3.5" />
          {t('settings.theme_dark')}
        </button>
      </div>

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
              autoFolderColors
                ? 'bg-[var(--color-accent)]'
                : 'bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]'
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

  return (
    <div className={collapsed ? 'relative group/theme' : 'relative'} ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`
          group relative flex items-center justify-center
          text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
          transition-all duration-200 ease-out
          ${collapsed
            ? 'p-2'
            : 'w-8 h-8 rounded-xl bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-elevated)]'
          }
          ${isOpen ? 'text-[var(--color-accent)]' : ''}
        `}
        aria-label={label}
        title={collapsed ? undefined : label}
      >
        <div className={`relative ${collapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]'}`}>
          <IoSunnyOutline
            className={`
              absolute inset-0 w-full h-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
              ${theme === 'dark'
                ? 'opacity-100 rotate-0 scale-100'
                : 'opacity-0 -rotate-180 scale-50'
              }
            `}
          />
          <IoMoonOutline
            className={`
              absolute inset-0 w-full h-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]
              ${theme === 'light'
                ? 'opacity-100 rotate-0 scale-100'
                : 'opacity-0 rotate-180 scale-50'
              }
            `}
          />
        </div>
      </button>
      {collapsed && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] shadow-lg text-xs font-medium text-[var(--color-text-primary)] whitespace-nowrap opacity-0 scale-95 pointer-events-none group-hover/theme:opacity-100 group-hover/theme:scale-100 transition-all duration-200 delay-150">
          {label}
        </div>
      )}

      {isOpen &&
        createPortal(
          <div
            ref={portalRef}
            className={`fixed z-[9999] ${collapsed ? 'animate-scale-in' : 'animate-slide-up'}`}
            style={{ top: popoverPosition.top, left: popoverPosition.left }}
          >
            {popover}
          </div>,
          document.body
        )}
    </div>
  )
}
