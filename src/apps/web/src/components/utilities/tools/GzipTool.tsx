import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { gzipCompressToBase64, gzipDecompressFromBase64 } from '../codecUtils'
import { CopyButton, SwapIOButton, SwapIOFields, ToolActions, ToolButton, ToolError } from '../ToolShell'

export function GzipTool() {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const swap = (nextIn: string, nextOut: string) => {
    setInput(nextIn)
    setOutput(nextOut)
    setError(null)
  }

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
        <SwapIOButton input={input} output={output} disabled={busy} onSwap={swap} />
        <CopyButton text={output} />
      </ToolActions>
      <p className="text-[10px] text-[var(--color-text-tertiary)]">{t('utilities.gzip_hint')}</p>
      <ToolError message={error} />
      <SwapIOFields
        inputLabel={t('utilities.input')}
        outputLabel={t('utilities.output')}
        input={input}
        output={output}
        onInputChange={setInput}
        onOutputChange={setOutput}
        onSwap={swap}
        disabled={busy}
      />
    </div>
  )
}
