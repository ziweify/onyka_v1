import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IoSwapHorizontalOutline } from 'react-icons/io5'
import {
  detectBrowserTranslatorSupport,
  resolveLangs,
  translateText,
  type TranslateDirection,
  type TranslatePair,
} from '../translateUtils'
import { CopyButton, ToolActions, ToolButton, ToolError, ToolField } from '../ToolShell'

const PAIRS: TranslatePair[] = ['zh-en', 'zh-ja', 'zh-ko']

export function TranslateTool() {
  const { t } = useTranslation()
  const [pair, setPair] = useState<TranslatePair>('zh-en')
  const [direction, setDirection] = useState<TranslateDirection>('from-zh')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [preferOffline, setPreferOffline] = useState(true)
  const [engineHint, setEngineHint] = useState<string>('')
  const [offlineStatus, setOfflineStatus] = useState<'checking' | 'ready' | 'downloadable' | 'none'>('checking')

  const langs = resolveLangs(pair, direction)

  useEffect(() => {
    let cancelled = false
    setOfflineStatus('checking')
    void detectBrowserTranslatorSupport(langs.source, langs.target).then((status) => {
      if (cancelled) return
      if (status === 'available') setOfflineStatus('ready')
      else if (status === 'downloadable') setOfflineStatus('downloadable')
      else setOfflineStatus('none')
    })
    return () => {
      cancelled = true
    }
  }, [langs.source, langs.target])

  const run = async () => {
    setBusy(true)
    setError(null)
    setEngineHint('')
    try {
      const result = await translateText({
        text: input,
        pair,
        direction,
        preferOffline,
      })
      setOutput(result.text)
      setEngineHint(
        result.engine === 'browser' ? t('utilities.translate_engine_offline') : t('utilities.translate_engine_online')
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'online_quota') setError(t('utilities.translate_quota'))
      else setError(t('utilities.translate_error'))
    } finally {
      setBusy(false)
    }
  }

  const swap = () => {
    setDirection((d) => (d === 'from-zh' ? 'to-zh' : 'from-zh'))
    setInput(output)
    setOutput(input)
    setError(null)
  }

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <ToolActions>
        {PAIRS.map((id) => (
          <ToolButton key={id} primary={pair === id} onClick={() => setPair(id)}>
            {t(`utilities.translate_pair_${id.replace('-', '_')}`)}
          </ToolButton>
        ))}
        <ToolButton onClick={swap} disabled={busy}>
          <span className="inline-flex items-center gap-1">
            <IoSwapHorizontalOutline className="w-3.5 h-3.5" />
            {langs.sourceLabel} → {langs.targetLabel}
          </span>
        </ToolButton>
        <ToolButton primary disabled={busy || !input.trim()} onClick={() => void run()}>
          {busy ? t('common.loading') : t('utilities.translate_run')}
        </ToolButton>
        <CopyButton text={output} />
      </ToolActions>

      <div className="flex flex-wrap items-center gap-3 text-[10px] text-[var(--color-text-tertiary)]">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={preferOffline}
            onChange={(e) => setPreferOffline(e.target.checked)}
          />
          {t('utilities.translate_prefer_offline')}
        </label>
        <span>
          {offlineStatus === 'ready' && t('utilities.translate_offline_ready')}
          {offlineStatus === 'downloadable' && t('utilities.translate_offline_downloadable')}
          {offlineStatus === 'none' && t('utilities.translate_offline_none')}
          {offlineStatus === 'checking' && t('common.loading')}
        </span>
        {engineHint && <span className="text-[var(--color-accent)]">{engineHint}</span>}
      </div>

      <ToolError message={error} />

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-2">
        <ToolField
          label={`${t('utilities.input')} (${langs.sourceLabel})`}
          value={input}
          onChange={setInput}
          placeholder={t('utilities.translate_placeholder')}
        />
        <ToolField
          label={`${t('utilities.output')} (${langs.targetLabel})`}
          value={output}
          onChange={setOutput}
        />
      </div>
    </div>
  )
}
