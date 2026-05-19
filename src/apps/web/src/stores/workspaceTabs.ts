import { create } from 'zustand'

export interface DocumentTab {
  noteId: string
  title: string
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
      const tabs = existing
        ? state.tabs.map((t) =>
            t.noteId === noteId && title ? { ...t, title } : t
          )
        : [...state.tabs, { noteId, title: title?.trim() || '…' }]
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
