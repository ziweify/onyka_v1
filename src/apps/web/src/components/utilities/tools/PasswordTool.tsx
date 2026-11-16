import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { generatePassword } from '../codecUtils'
import { CopyButton, ToolActions, ToolButton, ToolField } from '../ToolShell'

export function PasswordTool() {
  const { t } = useTranslation()
  const [length, setLength] = useState(16)
  const [upper, setUpper] = useState(true)
  const [lower, setLower] = useState(true)
  const [digits, setDigits] = useState(true)
  const [symbols, setSymbols] = useState(true)
  const [output, setOutput] = useState('')

  const generate = () => {
    setOutput(generatePassword({ length, upper, lower, digits, symbols }))
  }

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <ToolActions>
        <label className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)]">
          {t('utilities.length')}
          <input
            type="number"
            min={4}
            max={128}
            value={length}
            onChange={(e) => setLength(Math.min(128, Math.max(4, Number(e.target.value) || 16)))}
            className="w-14 h-7 px-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-xs"
          />
        </label>
        {(
          [
            ['upper', upper, setUpper],
            ['lower', lower, setLower],
            ['digits', digits, setDigits],
            ['symbols', symbols, setSymbols],
          ] as const
        ).map(([key, value, setter]) => (
          <label key={key} className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)]">
            <input type="checkbox" checked={value} onChange={(e) => setter(e.target.checked)} />
            {t(`utilities.pwd_${key}`)}
          </label>
        ))}
        <ToolButton primary onClick={generate}>{t('utilities.generate')}</ToolButton>
        <CopyButton text={output} />
      </ToolActions>
      <ToolField label={t('utilities.output')} value={output} onChange={setOutput} rows={3} />
    </div>
  )
}
