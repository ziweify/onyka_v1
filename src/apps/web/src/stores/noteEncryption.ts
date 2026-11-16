import { create } from 'zustand'
import type { NoteEncryptionMeta } from '@onyka/shared'

export const ENCRYPTION_IDLE_MS = 5 * 60 * 1000 // 5 minutes

interface SessionEntry {
  dek: CryptoKey
  meta: NoteEncryptionMeta
  lastActive: number
}

interface NoteEncryptionState {
  /** noteId → unlocked session (DEK only in memory, never persisted) */
  sessions: Record<string, SessionEntry>
  /**
   * Bumps whenever any DEK is dropped so UI can scrub decrypted plaintext
   * (editor buffers, refs, TipTap docs) from RAM as best-effort GC.
   */
  wipeGeneration: number
  unlock: (noteId: string, dek: CryptoKey, meta: NoteEncryptionMeta) => void
  touch: (noteId: string) => void
  getDek: (noteId: string) => CryptoKey | null
  hasSession: (noteId: string) => boolean
  lockNote: (noteId: string) => void
  clearAll: () => void
  sweepIdle: () => void
}

const wipeListeners = new Set<() => void>()

/** Subscribe to DEK wipe events (idle / hide / logout / manual lock). */
export function onEncryptionWipe(listener: () => void): () => void {
  wipeListeners.add(listener)
  return () => wipeListeners.delete(listener)
}

function notifyWipe(): void {
  for (const listener of wipeListeners) {
    try {
      listener()
    } catch {
      /* ignore listener errors */
    }
  }
}

function bumpWipe(
  set: (fn: (s: NoteEncryptionState) => Partial<NoteEncryptionState>) => void
): void {
  set((s) => ({ wipeGeneration: s.wipeGeneration + 1 }))
  notifyWipe()
}

export const useNoteEncryptionStore = create<NoteEncryptionState>((set, get) => ({
  sessions: {},
  wipeGeneration: 0,

  unlock: (noteId, dek, meta) => {
    set((s) => ({
      sessions: {
        ...s.sessions,
        [noteId]: { dek, meta, lastActive: Date.now() },
      },
    }))
  },

  touch: (noteId) => {
    const entry = get().sessions[noteId]
    if (!entry) return
    set((s) => ({
      sessions: {
        ...s.sessions,
        [noteId]: { ...entry, lastActive: Date.now() },
      },
    }))
  },

  getDek: (noteId) => {
    const entry = get().sessions[noteId]
    if (!entry) return null
    if (Date.now() - entry.lastActive > ENCRYPTION_IDLE_MS) {
      get().lockNote(noteId)
      return null
    }
    return entry.dek
  },

  hasSession: (noteId) => get().getDek(noteId) != null,

  lockNote: (noteId) => {
    const had = Boolean(get().sessions[noteId])
    set((s) => {
      const next = { ...s.sessions }
      delete next[noteId]
      return { sessions: next }
    })
    if (had) bumpWipe(set)
  },

  clearAll: () => {
    const had = Object.keys(get().sessions).length > 0
    set({ sessions: {} })
    if (had) bumpWipe(set)
  },

  sweepIdle: () => {
    const now = Date.now()
    const cur = get().sessions
    let changed = false
    const next: Record<string, SessionEntry> = {}
    for (const [id, entry] of Object.entries(cur)) {
      if (now - entry.lastActive <= ENCRYPTION_IDLE_MS) next[id] = entry
      else changed = true
    }
    if (changed) {
      set({ sessions: next })
      bumpWipe(set)
    }
  },
}))

let listenersBound = false

/** Bind once: wipe all DEKs on close / hide / unload; sweep idle on a timer. */
export function bindEncryptionSessionGuards(): void {
  if (listenersBound || typeof window === 'undefined') return
  listenersBound = true

  const wipe = () => useNoteEncryptionStore.getState().clearAll()

  // Highest hygiene: any leave of the page context drops keys from RAM
  window.addEventListener('pagehide', wipe)
  window.addEventListener('beforeunload', wipe)
  // Page Lifecycle API (Chromium) — drop keys when the tab is frozen
  window.addEventListener('freeze', wipe as EventListener)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') wipe()
  })
  window.setInterval(() => {
    useNoteEncryptionStore.getState().sweepIdle()
  }, 15_000)
}
