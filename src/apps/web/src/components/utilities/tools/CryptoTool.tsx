import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { aesGcmDecrypt, aesGcmEncrypt, shaDigest } from '../codecUtils'
import { md5 } from '../md5'
import { CopyButton, ToolActions, ToolButton, ToolError, ToolField } from '../ToolShell'

type HashAlgo = 'md5' | 'sha1' | 'sha256' | 'sha512'

export function CryptoTool() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'hash' | 'aes'>('hash')
  const [algo, setAlgo] = useState<HashAlgo>('md5')
  const [input, setInput] = useState('')
  const [password, setPassword] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const runHash = async () => {
    setError(null)
    try {
      if (algo === 'md5') setOutput(md5(input))
      else if (algo === 'sha1') setOutput(await shaDigest('SHA-1', input))
      else if (algo === 'sha256') setOutput(await shaDigest('SHA-256', input))
      else setOutput(await shaDigest('SHA-512', input))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('utilities.crypto_error'))
    }
  }

  const runAes = async (mode: 'enc' | 'dec') => {
    setError(null)
    if (!password) {
      setError(t('utilities.aes_password_required'))
      return
    }
    try {
      setOutput(mode === 'enc' ? await aesGcmEncrypt(input, password) : await aesGcmDecrypt(input, password))
    } catch {
      setError(t('utilities.aes_error'))
    }
  }

  return (
    <div className="h-full flex flex-col gap-2 min-h-0">
      <ToolActions>
        <ToolButton primary={tab === 'hash'} onClick={() => setTab('hash')}>{t('utilities.hash')}</ToolButton>
        <ToolButton primary={tab === 'aes'} onClick={() => setTab('aes')}>AES-GCM</ToolButton>
        {tab === 'hash' ? (
          <>
            {(['md5', 'sha1', 'sha256', 'sha512'] as HashAlgo[]).map((id) => (
              <ToolButton key={id} primary={algo === id} onClick={() => setAlgo(id)}>
                {id.toUpperCase()}
              </ToolButton>
            ))}
            <ToolButton primary onClick={() => void runHash()}>{t('utilities.hash_run')}</ToolButton>
          </>
        ) : (
          <>
            <ToolButton primary onClick={() => void runAes('enc')}>{t('utilities.encrypt')}</ToolButton>
            <ToolButton onClick={() => void runAes('dec')}>{t('utilities.decrypt')}</ToolButton>
          </>
        )}
        <CopyButton text={output} />
      </ToolActions>
      {tab === 'aes' && (
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('utilities.aes_password')}
          className="h-7 px-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      )}
      {tab === 'hash' && (
        <p className="text-[10px] text-[var(--color-text-tertiary)]">{t('utilities.hash_hint')}</p>
      )}
      <ToolError message={error} />
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-2">
        <ToolField label={t('utilities.input')} value={input} onChange={setInput} />
        <ToolField label={t('utilities.output')} value={output} onChange={setOutput} />
      </div>
    </div>
  )
}
