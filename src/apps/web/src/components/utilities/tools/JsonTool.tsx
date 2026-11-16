import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyButton, SwapIOButton, SwapIOFields, ToolActions, ToolButton, ToolError } from '../ToolShell'

export function JsonTool() {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const swap = (nextIn: string, nextOut: string) => {
    setInput(nextIn)
    setOutput(nextOut)
    setError(null)
  }

  const run = (mode: 'format' | 'minify' | 'validate') => {
    setError(null)
    try {
      const parsed = JSON.parse(input)
      if (mode === 'validate') {
        setOutput(t('utilities.json_valid'))
        return
      }
      setOutput(mode === 'format' ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('utilities.json_invalid'))
      if (mode === 'validate') setOutput(t('utilities.json_invalid'))
    }
  }

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <ToolActions>
        <ToolButton primary onClick={() => run('format')}>{t('utilities.json_format')}</ToolButton>
        <ToolButton onClick={() => run('minify')}>{t('utilities.json_minify')}</ToolButton>
        <ToolButton onClick={() => run('validate')}>{t('utilities.json_validate')}</ToolButton>
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
        inputPlaceholder="{}"
      />
    </div>
  )
}
