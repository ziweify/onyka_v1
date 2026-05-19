import { create } from 'zustand'

export interface DocumentTab {
  noteId: string
  title: string
}

interface PersistedWorkspace {
  tabs: DocumentTab[]
  activeView: string
}

interface WorkspaceTabsState {
  tabs: DocumentTab[]
  /** 'home' or a note id */
  activeView: string
  openNote: (noteId: string, title?: string) => void
  closeTab: (noteId: string) => void
  goHome: () => void
  setActiveView: (view: string) => void
  updateTabTitle: (noteId: string, title: string) => void
}

const STORAGE_PREFIX = 'onyka-workspace-tabs'
const MAX_TABS = 15

let persistUserId: string | null = null

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`
}

function loadPersisted(userId: string): PersistedWorkspace | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const data = JSON.parse(raw) as PersistedWorkspace
    if (!Array.isArray(data.tabs)) return null
    const tabs = data.tabs
      .filter((t) => t?.noteId && typeof t.title === 'string')
      .slice(0, MAX_TABS)
    const activeView =
      data.activeView === 'home' || tabs.some((t) => t.noteId === data.activeView)
        ? data.activeView
        : tabs.length > 0
          ? tabs[tabs.length - 1].noteId
          : 'home'
    return { tabs, activeView }
  } catch {
    return null
  }
}

function savePersisted(userId: string, state: PersistedWorkspace) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state))
  } catch {
    /* quota or private mode */
  }
}

export function setWorkspaceTabsUser(userId: string | null) {
  persistUserId = userId
  if (!userId) {
    useWorkspaceTabsStore.setState({ tabs: [], activeView: 'home' })
    return
  }
  const saved = loadPersisted(userId)
  if (saved) {
    useWorkspaceTabsStore.setState(saved)
  } else {
    useWorkspaceTabsStore.setState({ tabs: [], activeView: 'home' })
  }
}

export function resetWorkspaceTabs() {
  persistUserId = null
  useWorkspaceTabsStore.setState({ tabs: [], activeView: 'home' })
}

export const useWorkspaceTabsStore = create<WorkspaceTabsState>((set, get) => ({
  tabs: [],
  activeView: 'home',

  openNote: (noteId, title) => {
    if (!noteId) {
      set({ activeView: 'home' })
      return
    }
    set((state) => {
      const existing = state.tabs.find((t) => t.noteId === noteId)
      let tabs = existing
        ? state.tabs.map((t) =>
            t.noteId === noteId && title ? { ...t, title: title.trim() } : t
          )
        : [...state.tabs, { noteId, title: title?.trim() || '…' }]

      if (!existing && tabs.length > MAX_TABS) {
        const dropIndex = tabs.findIndex((t) => t.noteId !== noteId)
        tabs = tabs.filter((_, i) => i !== dropIndex)
      }

      return { tabs, activeView: noteId }
    })
  },

  closeTab: (noteId) => {
    const { tabs, activeView } = get()
    const nextTabs = tabs.filter((t) => t.noteId !== noteId)
    if (activeView !== noteId) {
      set({ tabs: nextTabs })
      return
    }
    const closedIndex = tabs.findIndex((t) => t.noteId === noteId)
    const fallback =
      nextTabs[closedIndex]?.noteId ??
      nextTabs[closedIndex - 1]?.noteId ??
      'home'
    set({ tabs: nextTabs, activeView: fallback })
  },

  goHome: () => set({ activeView: 'home' }),

  setActiveView: (view) => set({ activeView: view }),

  updateTabTitle: (noteId, title) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.noteId === noteId ? { ...t, title: title.trim() || t.title } : t
      ),
    }))
  },
}))

useWorkspaceTabsStore.subscribe((state) => {
  if (!persistUserId) return
  savePersisted(persistUserId, {
    tabs: state.tabs,
    activeView: state.activeView,
  })
})
