const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export function utf8ToBase64(text: string): string {
  const bytes = textEncoder.encode(text)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

export function base64ToUtf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return textDecoder.decode(bytes)
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.replace(/\s/g, ''))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

export async function shaDigest(algo: 'SHA-1' | 'SHA-256' | 'SHA-512', text: string): Promise<string> {
  const buf = await crypto.subtle.digest(algo, textEncoder.encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function gzipCompressToBase64(text: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('CompressionStream unsupported')
  }
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  const buffer = await new Response(stream).arrayBuffer()
  return bytesToBase64(new Uint8Array(buffer))
}

export async function gzipDecompressFromBase64(base64: string): Promise<string> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream unsupported')
  }
  const bytes = base64ToBytes(base64)
  const copy = new Uint8Array(bytes)
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('gzip'))
  return textDecoder.decode(await new Response(stream).arrayBuffer())
}

export async function aesGcmEncrypt(plain: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, textEncoder.encode(plain))
  const packed = new Uint8Array(salt.length + iv.length + cipher.byteLength)
  packed.set(salt, 0)
  packed.set(iv, salt.length)
  packed.set(new Uint8Array(cipher), salt.length + iv.length)
  return bytesToBase64(packed)
}

export async function aesGcmDecrypt(payload: string, password: string): Promise<string> {
  const packed = base64ToBytes(payload)
  if (packed.length < 28) throw new Error('Invalid payload')
  const salt = packed.slice(0, 16)
  const iv = packed.slice(16, 28)
  const data = packed.slice(28)
  const key = await deriveKey(password, salt)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return textDecoder.decode(plain)
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  const saltCopy = new Uint8Array(salt)
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltCopy, iterations: 100_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export function generatePassword(options: {
  length: number
  upper: boolean
  lower: boolean
  digits: boolean
  symbols: boolean
}): string {
  const pools: string[] = []
  if (options.upper) pools.push('ABCDEFGHJKLMNPQRSTUVWXYZ')
  if (options.lower) pools.push('abcdefghijkmnopqrstuvwxyz')
  if (options.digits) pools.push('23456789')
  if (options.symbols) pools.push('!@#$%^&*-_=+?')
  if (pools.length === 0) return ''

  const all = pools.join('')
  const bytes = crypto.getRandomValues(new Uint8Array(options.length))
  const chars: string[] = []
  // Ensure at least one from each selected pool
  pools.forEach((pool, i) => {
    if (i < options.length) {
      chars[i] = pool[bytes[i] % pool.length]
    }
  })
  for (let i = pools.length; i < options.length; i++) {
    chars[i] = all[bytes[i] % all.length]
  }
  // Shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
