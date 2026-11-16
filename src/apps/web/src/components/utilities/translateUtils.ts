export type TranslatePair = 'zh-en' | 'zh-ja' | 'zh-ko'
export type TranslateDirection = 'from-zh' | 'to-zh'

export type TranslateEngine = 'browser' | 'online'

const PAIR_LANGS: Record<
  TranslatePair,
  { zh: string; other: string; otherLabel: string }
> = {
  'zh-en': { zh: 'zh', other: 'en', otherLabel: 'EN' },
  'zh-ja': { zh: 'zh', other: 'ja', otherLabel: 'JA' },
  'zh-ko': { zh: 'zh', other: 'ko', otherLabel: 'KO' },
}

/** MyMemory uses region tags for Chinese. */
const ONLINE_LANG: Record<string, string> = {
  zh: 'zh-CN',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
}

declare global {
  interface Window {
    Translator?: {
      availability: (options: {
        sourceLanguage: string
        targetLanguage: string
      }) => Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>
      create: (options: {
        sourceLanguage: string
        targetLanguage: string
      }) => Promise<{ translate: (text: string) => Promise<string> }>
    }
  }
}

export function resolveLangs(pair: TranslatePair, direction: TranslateDirection) {
  const cfg = PAIR_LANGS[pair]
  if (direction === 'from-zh') {
    return { source: cfg.zh, target: cfg.other, sourceLabel: 'ZH', targetLabel: cfg.otherLabel }
  }
  return { source: cfg.other, target: cfg.zh, sourceLabel: cfg.otherLabel, targetLabel: 'ZH' }
}

export async function detectBrowserTranslatorSupport(
  sourceLanguage: string,
  targetLanguage: string
): Promise<'available' | 'downloadable' | 'unavailable'> {
  if (typeof window === 'undefined' || !window.Translator) return 'unavailable'
  try {
    const status = await window.Translator.availability({ sourceLanguage, targetLanguage })
    if (status === 'available' || status === 'downloadable' || status === 'downloading') {
      return status === 'downloading' ? 'downloadable' : status
    }
    return 'unavailable'
  } catch {
    return 'unavailable'
  }
}

export async function translateWithBrowser(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  if (!window.Translator) throw new Error('browser_unavailable')
  const translator = await window.Translator.create({ sourceLanguage, targetLanguage })
  return translator.translate(text)
}

/** Split text into chunks under MyMemory's practical query limit. */
function chunkText(text: string, maxLen = 450): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.length <= maxLen) return [trimmed]

  const chunks: string[] = []
  const parts = trimmed.split(/(\n+)/)
  let buf = ''
  for (const part of parts) {
    if ((buf + part).length > maxLen && buf) {
      chunks.push(buf)
      buf = part
    } else {
      buf += part
    }
  }
  if (buf) chunks.push(buf)

  // Hard-split any remaining oversized chunk
  const final: string[] = []
  for (const c of chunks) {
    if (c.length <= maxLen) {
      final.push(c)
      continue
    }
    for (let i = 0; i < c.length; i += maxLen) final.push(c.slice(i, i + maxLen))
  }
  return final
}

export async function translateOnline(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  const source = ONLINE_LANG[sourceLanguage] || sourceLanguage
  const target = ONLINE_LANG[targetLanguage] || targetLanguage
  const chunks = chunkText(text)
  if (chunks.length === 0) return ''

  const results: string[] = []
  for (const chunk of chunks) {
    const url =
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}` +
      `&langpair=${encodeURIComponent(`${source}|${target}`)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`online_http_${res.status}`)
    const data = (await res.json()) as {
      responseStatus?: number
      responseData?: { translatedText?: string }
      responseDetails?: string
    }
    if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
      throw new Error(data.responseDetails || 'online_failed')
    }
    // MyMemory sometimes returns QUOTA EXCEEDED in the text itself
    const translated = data.responseData.translatedText
    if (/MYMEMORY WARNING/i.test(translated)) {
      throw new Error('online_quota')
    }
    results.push(translated)
  }
  return results.join('')
}

export async function translateText(options: {
  text: string
  pair: TranslatePair
  direction: TranslateDirection
  preferOffline: boolean
}): Promise<{ text: string; engine: TranslateEngine }> {
  const { source, target } = resolveLangs(options.pair, options.direction)
  const input = options.text.trim()
  if (!input) return { text: '', engine: 'online' }

  if (options.preferOffline) {
    const support = await detectBrowserTranslatorSupport(source, target)
    if (support === 'available' || support === 'downloadable') {
      try {
        const text = await translateWithBrowser(input, source, target)
        return { text, engine: 'browser' }
      } catch {
        // fall through to online
      }
    }
  }

  const text = await translateOnline(input, source, target)
  return { text, engine: 'online' }
}
