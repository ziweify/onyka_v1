import { create } from 'zustand'

export type UtilityToolId =
  | 'gzip'
  | 'json'
  | 'string'
  | 'crypto'
  | 'color'
  | 'password'

const STORAGE_KEY = 'onyka-utility-dock'

interface PersistedDock {
  expanded: boolean
  heightRatio: number
  activeTool: UtilityToolId
}

function loadPersisted(): PersistedDock {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { expanded: false, heightRatio: 1 / 3, activeTool: 'json' }
    const parsed = JSON.parse(raw) as Partial<PersistedDock>
    return {
      expanded: Boolean(parsed.expanded),
      heightRatio: Math.min(0.7, Math.max(0.18, Number(parsed.heightRatio) || 1 / 3)),
      activeTool: (parsed.activeTool as UtilityToolId) || 'json',
    }
  } catch {
    return { expanded: false, heightRatio: 1 / 3, activeTool: 'json' }
  }
}

interface UtilityDockState extends PersistedDock {
  setExpanded: (expanded: boolean) => void
  toggleExpanded: () => void
  setHeightRatio: (ratio: number) => void
  setActiveTool: (tool: UtilityToolId) => void
}

function persist(state: PersistedDock) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota / private mode
  }
}

const initial = loadPersisted()

export const useUtilityDockStore = create<UtilityDockState>((set, get) => ({
  ...initial,
  setExpanded: (expanded) => {
    set({ expanded })
    const { heightRatio, activeTool } = get()
    persist({ expanded, heightRatio, activeTool })
  },
  toggleExpanded: () => {
    const expanded = !get().expanded
    set({ expanded })
    const { heightRatio, activeTool } = get()
    persist({ expanded, heightRatio, activeTool })
  },
  setHeightRatio: (ratio) => {
    const heightRatio = Math.min(0.7, Math.max(0.18, ratio))
    set({ heightRatio })
    const { expanded, activeTool } = get()
    persist({ expanded, heightRatio, activeTool })
  },
  setActiveTool: (activeTool) => {
    set({ activeTool, expanded: true })
    const { heightRatio } = get()
    persist({ expanded: true, heightRatio, activeTool })
  },
}))
