import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { setLanguageWithServer, getCurrentLanguage } from '@/i18n'
import type { Language } from '@onyka/shared'

const LANGUAGES: { code: Language; flag: string; short: string }[] = [
  { code: 'zh', flag: '🇨🇳', short: '中文' },
  { code: 'en', flag: '🇬🇧', short: 'EN' },
  { code: 'fr', flag: '🇫🇷', short: 'FR' },
]

interface LanguageSwitcherProps {
  collapsed?: boolean
}

export function LanguageSwitcher({ collapsed = false }: LanguageSwitcherProps) {
  const { t } = useTranslation()
  const currentLang = getCurrentLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = LANGUAGES.find((l) => l.code === currentLang) ?? LANGUAGES[0]

  useEffect(() => {
    if (!open) return
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  const select = (code: Language) => {
    setLanguageWithServer(code)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`
          group relative flex items-center justify-center gap-1
          transition-all duration-200 ease-out
          ${collapsed
            ? 'p-2'
            : 'h-8 px-2 rounded-xl bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-elevated)] min-w-[4.5rem]'
          }
        `}
        aria-label={t('settings.language')}
        title={t('settings.language')}
      >
        <span className={collapsed ? 'text-[17px] leading-none' : 'text-[15px] leading-none'}>
          {current.flag}
        </span>
        {!collapsed && (
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            {current.short}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`
            absolute z-50 py-1 rounded-xl border border-[var(--color-border-subtle)]
            bg-[var(--color-bg-elevated)] shadow-lg min-w-[7.5rem]
            ${collapsed ? 'left-full top-1/2 -translate-y-1/2 ml-2' : 'right-0 top-full mt-1'}
          `}
          role="menu"
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              role="menuitem"
              onClick={() => select(lang.code)}
              className={`
                w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
                ${currentLang === lang.code
                  ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                }
              `}
            >
              <span className="text-base leading-none">{lang.flag}</span>
              <span className="flex-1 truncate">{t(`settings.languages.${lang.code}`)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
