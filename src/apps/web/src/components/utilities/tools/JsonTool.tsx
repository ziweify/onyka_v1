import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyButton, ToolActions, ToolButton, ToolError, ToolField } from '../ToolShell'

export function JsonTool() {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

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
        <CopyButton text={output} />
      </ToolActions>
      <ToolError message={error} />
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-2">
        <ToolField label={t('utilities.input')} value={input} onChange={setInput} placeholder="{}" />
        <ToolField label={t('utilities.output')} value={output} onChange={setOutput} />
      </div>
    </div>
  )
}
