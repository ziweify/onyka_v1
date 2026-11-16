import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { base64ToUtf8, utf8ToBase64 } from '../codecUtils'
import { CopyButton, ToolActions, ToolButton, ToolError, ToolField } from '../ToolShell'

type Mode = 'url' | 'base64'

export function StringCodecTool() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('base64')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const encode = () => {
    setError(null)
    try {
      setOutput(mode === 'url' ? encodeURIComponent(input) : utf8ToBase64(input))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('utilities.codec_error'))
    }
  }

  const decode = () => {
    setError(null)
    try {
      setOutput(mode === 'url' ? decodeURIComponent(input) : base64ToUtf8(input))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('utilities.codec_error'))
    }
  }

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <ToolActions>
        <ToolButton primary={mode === 'base64'} onClick={() => setMode('base64')}>Base64</ToolButton>
        <ToolButton primary={mode === 'url'} onClick={() => setMode('url')}>URL</ToolButton>
        <ToolButton primary onClick={encode}>{t('utilities.encode')}</ToolButton>
        <ToolButton onClick={decode}>{t('utilities.decode')}</ToolButton>
        <CopyButton text={output} />
      </ToolActions>
      <ToolError message={error} />
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-2">
        <ToolField label={t('utilities.input')} value={input} onChange={setInput} />
        <ToolField label={t('utilities.output')} value={output} onChange={setOutput} />
      </div>
    </div>
  )
}
