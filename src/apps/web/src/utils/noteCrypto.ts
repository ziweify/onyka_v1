import type { NoteEncryptionMeta } from '@onyka/shared'

const ENC_PREFIX = 'ONYKAENC1.'
const PBKDF2_ITERATIONS = 600_000
const DEK_BITS = 256

function getSubtle(): SubtleCrypto {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    throw new Error('INSECURE_CONTEXT')
  }
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error('INSECURE_CONTEXT')
  return subtle
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Ensure a Uint8Array backed by ArrayBuffer for Web Crypto BufferSource typing. */
function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (bytes.buffer instanceof ArrayBuffer) {
    return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
      ? (bytes as Uint8Array<ArrayBuffer>)
      : new Uint8Array(bytes)
  }
  return new Uint8Array(bytes)
}

/** Overwrite then drop references (best-effort wipe of raw key material). */
export function wipeBytes(buf: Uint8Array | null | undefined): void {
  if (!buf) return
  buf.fill(0)
}

export function isEncryptedPayload(content: string): boolean {
  return content.startsWith(ENC_PREFIX)
}

export async function encryptPlaintext(plain: string, dek: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plain)
  const ct = new Uint8Array(
    await getSubtle().encrypt({ name: 'AES-GCM', iv }, dek, encoded)
  )
  return `${ENC_PREFIX}${bytesToB64url(iv)}.${bytesToB64url(ct)}`
}

export async function decryptPayload(payload: string, dek: CryptoKey): Promise<string> {
  if (!isEncryptedPayload(payload)) return payload
  const parts = payload.slice(ENC_PREFIX.length).split('.')
  if (parts.length !== 2) throw new Error('Invalid encrypted payload')
  const iv = b64urlToBytes(parts[0]!)
  const ct = b64urlToBytes(parts[1]!)
  const plain = await getSubtle().decrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    dek,
    asBufferSource(ct)
  )
  return new TextDecoder().decode(plain)
}

async function deriveKek(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const baseKey = await getSubtle().importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return getSubtle().deriveKey(
    {
      name: 'PBKDF2',
      salt: asBufferSource(salt),
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: DEK_BITS },
    false, // non-extractable KEK
    ['encrypt', 'decrypt']
  )
}

async function importDekNonExtractable(raw: Uint8Array): Promise<CryptoKey> {
  return getSubtle().importKey(
    'raw',
    asBufferSource(raw),
    { name: 'AES-GCM', length: DEK_BITS },
    false, // non-extractable DEK for session use
    ['encrypt', 'decrypt']
  )
}

export interface EnableEncryptionResult {
  meta: NoteEncryptionMeta
  dek: CryptoKey
}

/** First-time lock: create DEK, wrap with passphrase-derived KEK. */
export async function enableEncryption(passphrase: string): Promise<EnableEncryptionResult> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const wrapIv = crypto.getRandomValues(new Uint8Array(12))
  const rawDek = crypto.getRandomValues(new Uint8Array(32))
  // Always pass a copy into importKey — never wipe the buffer the CryptoKey may alias.
  const rawForImport = new Uint8Array(rawDek)

  const kek = await deriveKek(passphrase, salt, PBKDF2_ITERATIONS)
  const wrapped = new Uint8Array(
    await getSubtle().encrypt(
      { name: 'AES-GCM', iv: asBufferSource(wrapIv) },
      kek,
      asBufferSource(rawDek)
    )
  )
  const dek = await importDekNonExtractable(rawForImport)
  wipeBytes(rawDek)
  // Do not wipe rawForImport — some engines keep a view into the import buffer.

  return {
    dek,
    meta: {
      v: 1,
      kdf: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: bytesToB64url(salt),
      wrapIv: bytesToB64url(wrapIv),
      wrappedDek: bytesToB64url(wrapped),
    },
  }
}

/** Unlock: unwrap DEK into a non-extractable CryptoKey. */
export async function unlockWithPassphrase(
  passphrase: string,
  meta: NoteEncryptionMeta
): Promise<CryptoKey> {
  if (meta.v !== 1 || meta.kdf !== 'PBKDF2') {
    throw new Error('Unsupported encryption metadata')
  }
  const salt = b64urlToBytes(meta.salt)
  const wrapIv = b64urlToBytes(meta.wrapIv)
  const wrapped = b64urlToBytes(meta.wrappedDek)
  const kek = await deriveKek(passphrase, salt, meta.iterations)
  const rawDek = new Uint8Array(
    await getSubtle().decrypt(
      { name: 'AES-GCM', iv: asBufferSource(wrapIv) },
      kek,
      asBufferSource(wrapped)
    )
  )
  const rawForImport = new Uint8Array(rawDek)
  const dek = await importDekNonExtractable(rawForImport)
  wipeBytes(rawDek)
  return dek
}
