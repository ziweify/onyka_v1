import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { base64ToUtf8, utf8ToBase64 } from '../codecUtils'
import { CopyButton, SwapIOButton, SwapIOFields, ToolActions, ToolButton, ToolError } from '../ToolShell'

type Mode = 'url' | 'base64'

export function StringCodecTool() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('base64')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const swap = (nextIn: string, nextOut: string) => {
    setInput(nextIn)
    setOutput(nextOut)
    setError(null)
  }

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
        <SwapIOButton input={input} output={output} onSwap={swap} />
        <CopyButton text={output} />
      </ToolActions>
      <ToolError message={error} />
      <SwapIOFields
        inputLabel={t('utilities.input')}
        outputLabel={t('utilities.output')}
        input={input}
        output={output}
        onInputChange={setInput}
        onOutputChange={setOutput}
        onSwap={swap}
      />
    </div>
  )
}
