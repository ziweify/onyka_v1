import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  detectBrowserTranslatorSupport,
  resolveLangs,
  translateText,
  type TranslateDirection,
  type TranslatePair,
} from '../translateUtils'
import { CopyButton, SwapIOButton, SwapIOFields, ToolActions, ToolButton, ToolError } from '../ToolShell'

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

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <ToolActions>
        {PAIRS.map((id) => (
          <ToolButton key={id} primary={pair === id} onClick={() => setPair(id)}>
            {t(`utilities.translate_pair_${id.replace('-', '_')}`)}
          </ToolButton>
        ))}
        <SwapIOButton
          input={input}
          output={output}
          disabled={busy}
          label={`${langs.sourceLabel} ↔ ${langs.targetLabel}`}
          onSwap={(nextIn, nextOut) => {
            setDirection((d) => (d === 'from-zh' ? 'to-zh' : 'from-zh'))
            setInput(nextIn)
            setOutput(nextOut)
            setError(null)
            setEngineHint('')
          }}
        />
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

      <SwapIOFields
        inputLabel={`${t('utilities.input')} (${langs.sourceLabel})`}
        outputLabel={`${t('utilities.output')} (${langs.targetLabel})`}
        input={input}
        output={output}
        onInputChange={setInput}
        onOutputChange={setOutput}
        disabled={busy}
        inputPlaceholder={t('utilities.translate_placeholder')}
        onSwap={(nextIn, nextOut) => {
          setDirection((d) => (d === 'from-zh' ? 'to-zh' : 'from-zh'))
          setInput(nextIn)
          setOutput(nextOut)
          setError(null)
          setEngineHint('')
        }}
      />
    </div>
  )
}
