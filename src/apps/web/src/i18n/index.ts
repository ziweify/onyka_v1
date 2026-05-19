/**
 * Onyka 前端国际化入口（ziweify 定制）
 * 最近修改: 2026-05-19 11:22:33 +0800 — 用于验证 src/ 已纳入 Git 版本管理
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from './locales/fr.json'
import en from './locales/en.json'
import zh from './locales/zh.json'
import type { Language } from '@onyka/shared'

// Get saved language from localStorage or default to Chinese
const savedLanguage = (localStorage.getItem('onyka-language') || 'zh') as Language

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      zh: { translation: zh },
    },
    lng: savedLanguage,
    fallbackLng: ['zh', 'en'],
    interpolation: {
      escapeValue: false // React already escapes
    },
    react: {
      useSuspense: false
    }
  })

// Function to change language and persist locally
export function setLanguage(lang: Language) {
  i18n.changeLanguage(lang)
  localStorage.setItem('onyka-language', lang)
}

// Function to change language and persist to server (for authenticated users)
// Always applies the change locally first, then persists to server as best-effort.
// This ensures the switcher works even on unauthenticated pages (login).
export async function setLanguageWithServer(lang: Language): Promise<boolean> {
  setLanguage(lang)
  try {
    const response = await fetch('/api/auth/language', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang }),
      credentials: 'include',
    })
    return response.ok
  } catch {
    return false
  }
}

// Function to load language from server (for authenticated users)
export async function loadLanguageFromServer(): Promise<Language | null> {
  try {
    const response = await fetch('/api/auth/language', {
      credentials: 'include',
    })
    if (response.ok) {
      const data = await response.json()
      if (data.language) {
        setLanguage(data.language)
        return data.language
      }
    }
    return null
  } catch {
    return null
  }
}

export function getCurrentLanguage(): Language {
  return (i18n.language || 'zh') as Language
}

const SUPPORTED_LANGUAGES: Language[] = ['en', 'fr', 'zh']

/** Prefer browser local choice, then user profile, then Chinese default. */
export function resolveUserLanguage(user?: { language?: Language } | null): Language {
  const saved = localStorage.getItem('onyka-language') as Language | null
  if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved
  if (user?.language && SUPPORTED_LANGUAGES.includes(user.language)) return user.language
  return 'zh'
}

export default i18n
