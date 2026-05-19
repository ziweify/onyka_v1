/** Must match server expectations: sha256(size:lastModified:sha256(sampleBytes)) */

const SAMPLE_HEAD = 64 * 1024
const SAMPLE_TAIL = 64 * 1024

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function readSlice(file: File, start: number, length: number): Promise<ArrayBuffer> {
  const slice = file.slice(start, start + length)
  return slice.arrayBuffer()
}

export async function computeUploadFingerprint(file: File): Promise<string> {
  const size = file.size
  const lastModified = file.lastModified

  let sample: ArrayBuffer
  if (size === 0) {
    sample = new ArrayBuffer(0)
  } else if (size <= SAMPLE_HEAD + SAMPLE_TAIL) {
    sample = await file.arrayBuffer()
  } else {
    const head = await readSlice(file, 0, SAMPLE_HEAD)
    const tail = await readSlice(file, size - SAMPLE_TAIL, SAMPLE_TAIL)
    const combined = new Uint8Array(SAMPLE_HEAD + SAMPLE_TAIL)
    combined.set(new Uint8Array(head), 0)
    combined.set(new Uint8Array(tail), SAMPLE_HEAD)
    sample = combined.buffer
  }

  const sampleHash = await sha256Hex(sample)
  const payload = `${size}:${lastModified}:${sampleHash}`
  const enc = new TextEncoder().encode(payload)
  return sha256Hex(enc.buffer)
}
