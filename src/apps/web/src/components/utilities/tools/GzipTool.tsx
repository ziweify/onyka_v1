import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { gzipCompressToBase64, gzipDecompressFromBase64 } from '../codecUtils'
import { CopyButton, ToolActions, ToolButton, ToolError, ToolField } from '../ToolShell'

export function GzipTool() {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const compress = async () => {
    setBusy(true)
    setError(null)
    try {
      setOutput(await gzipCompressToBase64(input))
    } catch {
      setError(t('utilities.gzip_unsupported'))
    } finally {
      setBusy(false)
    }
  }

  const decompress = async () => {
    setBusy(true)
    setError(null)
    try {
      setOutput(await gzipDecompressFromBase64(input))
    } catch {
      setError(t('utilities.gzip_error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <ToolActions>
        <ToolButton primary disabled={busy} onClick={() => void compress()}>
          {t('utilities.gzip_compress')}
        </ToolButton>
        <ToolButton disabled={busy} onClick={() => void decompress()}>
          {t('utilities.gzip_decompress')}
        </ToolButton>
        <CopyButton text={output} />
      </ToolActions>
      <p className="text-[10px] text-[var(--color-text-tertiary)]">{t('utilities.gzip_hint')}</p>
      <ToolError message={error} />
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-2">
        <ToolField label={t('utilities.input')} value={input} onChange={setInput} />
        <ToolField label={t('utilities.output')} value={output} onChange={setOutput} />
      </div>
    </div>
  )
}
