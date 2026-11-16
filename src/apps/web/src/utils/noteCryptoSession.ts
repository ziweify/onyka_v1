import { useNoteEncryptionStore } from '@/stores/noteEncryption'
import { decryptPayload, encryptPlaintext, isEncryptedPayload } from '@/utils/noteCrypto'

/**
 * Seal plaintext for upload. Encrypted notes never send plaintext to the server.
 * Returns null if the note is locked client-side (no DEK) — caller must skip the write.
 */
export async function sealNoteContent(
  noteId: string,
  plain: string,
  isEncrypted: boolean
): Promise<string | null> {
  if (!isEncrypted) return plain
  const dek = useNoteEncryptionStore.getState().getDek(noteId)
  if (!dek) return null
  useNoteEncryptionStore.getState().touch(noteId)
  return encryptPlaintext(plain, dek)
}

/** Open ciphertext for local editing. Returns '' when locked (no DEK). */
export async function openNoteContent(
  noteId: string,
  raw: string,
  isEncrypted: boolean
): Promise<string> {
  const needsDecrypt = isEncrypted || isEncryptedPayload(raw)
  if (!needsDecrypt) return raw
  const dek = useNoteEncryptionStore.getState().getDek(noteId)
  if (!dek) return isEncryptedPayload(raw) ? '' : raw
  useNoteEncryptionStore.getState().touch(noteId)
  if (!isEncryptedPayload(raw)) return raw
  return decryptPayload(raw, dek)
}
