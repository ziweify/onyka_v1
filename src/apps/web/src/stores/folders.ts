import { create } from 'zustand'
import type { Folder, FolderNote } from '@onyka/shared'
import { foldersApi, type FolderTreeItem } from '@/services/api'
import { useThemeStore } from './theme'
import { suggestFolderColor } from '@/utils/suggestFolderColor'

function collectFolders(tree: FolderTreeItem[]): FolderTreeItem[] {
  const out: FolderTreeItem[] = []
  const walk = (items: FolderTreeItem[]) => {
    for (const item of items) {
      out.push(item)
      if (item.children?.length) walk(item.children)
    }
  }
  walk(tree)
  return out
}

interface PersistedFolderNav {
  expandedFolderIds: string[]
  selectedFolderId: string | null
}

interface FoldersState {
  folders: Folder[]
  folderTree: FolderTreeItem[]
  rootNotes: FolderNote[]
  selectedFolderId: string | null
  isLoading: boolean
  error: string | null
  expandedFolders: Set<string>
  newNoteId: string | null
  showNewNoteInput: boolean
  selectedFolderIds: string[]
  fetchFolders: () => Promise<void>
  fetchFolderTree: () => Promise<void>
  createFolder: (name: string, parentId?: string | null) => Promise<Folder>
  updateFolder: (id: string, data: { name?: string; icon?: string; color?: string | null; parentId?: string | null }) => Promise<void>
  deleteFolder: (id: string, cascade?: boolean) => Promise<void>
  deleteMultipleFolders: (ids: string[]) => Promise<void>
  moveNoteToFolder: (noteId: string, folderId: string | null) => Promise<void>
  reorderFolder: (folderId: string, newParentId: string | null, newPosition: number) => Promise<void>
  reorderNote: (noteId: string, newFolderId: string | null, newPosition: number) => Promise<void>
  selectFolder: (id: string | null) => void
  toggleFolderExpanded: (id: string) => void
  expandFolders: (ids: string[]) => void
  clearError: () => void
  setNewNoteId: (id: string | null) => void
  triggerNewNoteInput: () => void
  closeNewNoteInput: () => void
  toggleFolderSelection: (id: string) => void
  clearFolderSelection: () => void
  /** Apply semantic colors to folders that currently have no color. */
  applyAutoColorsToUncolored: () => Promise<number>
}

const STORAGE_PREFIX = 'onyka-folder-nav'

let persistUserId: string | null = null

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`
}

function loadPersisted(userId: string): PersistedFolderNav | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const data = JSON.parse(raw) as PersistedFolderNav
    if (!Array.isArray(data.expandedFolderIds)) return null
    return {
      expandedFolderIds: data.expandedFolderIds.filter((id) => typeof id === 'string'),
      selectedFolderId:
        typeof data.selectedFolderId === 'string' || data.selectedFolderId === null
          ? data.selectedFolderId
          : null,
    }
  } catch {
    return null
  }
}

function savePersisted() {
  if (!persistUserId) return
  try {
    const { expandedFolders, selectedFolderId } = useFoldersStore.getState()
    const payload: PersistedFolderNav = {
      expandedFolderIds: [...expandedFolders],
      selectedFolderId,
    }
    localStorage.setItem(storageKey(persistUserId), JSON.stringify(payload))
  } catch {
    /* quota or private mode */
  }
}

function collectFolderIds(tree: FolderTreeItem[]): Set<string> {
  const ids = new Set<string>()
  const walk = (nodes: FolderTreeItem[]) => {
    for (const node of nodes) {
      ids.add(node.id)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(tree)
  return ids
}

/** Hydrate expanded/active folder nav for the signed-in user. */
export function setFolderNavUser(userId: string | null) {
  persistUserId = userId
  if (!userId) {
    useFoldersStore.setState({
      expandedFolders: new Set(),
      selectedFolderId: null,
      selectedFolderIds: [],
    })
    return
  }
  const saved = loadPersisted(userId)
  if (saved) {
    useFoldersStore.setState({
      expandedFolders: new Set(saved.expandedFolderIds),
      selectedFolderId: saved.selectedFolderId,
    })
  } else {
    useFoldersStore.setState({
      expandedFolders: new Set(),
      selectedFolderId: null,
    })
  }
}

export function resetFolderNav() {
  persistUserId = null
  useFoldersStore.setState({
    folders: [],
    folderTree: [],
    rootNotes: [],
    expandedFolders: new Set(),
    selectedFolderId: null,
    selectedFolderIds: [],
    isLoading: false,
    error: null,
  })
}

export const useFoldersStore = create<FoldersState>((set, get) => ({
  folders: [],
  folderTree: [],
  rootNotes: [],
  selectedFolderId: null,
  isLoading: false,
  error: null,
  expandedFolders: new Set(),
  newNoteId: null,
  showNewNoteInput: false,
  selectedFolderIds: [],

  fetchFolders: async () => {
    set({ isLoading: true, error: null })
    try {
      const { folders } = await foldersApi.list()
      set({ folders, isLoading: false })
    } catch {
      set({ error: 'Failed to fetch folders', isLoading: false })
    }
  },

  fetchFolderTree: async () => {
    // Only show loading on initial fetch to avoid cascading re-renders
    const isInitialLoad = get().folderTree.length === 0 && get().rootNotes.length === 0
    if (isInitialLoad) {
      set({ isLoading: true, error: null })
    }
    try {
      const { tree, rootNotes } = await foldersApi.tree()
      const validIds = collectFolderIds(tree)
      const { expandedFolders, selectedFolderId } = get()
      const prunedExpanded = new Set([...expandedFolders].filter((id) => validIds.has(id)))
      const prunedSelected =
        selectedFolderId && validIds.has(selectedFolderId) ? selectedFolderId : null
      set({
        folderTree: tree,
        rootNotes,
        expandedFolders: prunedExpanded,
        selectedFolderId: prunedSelected,
        ...(isInitialLoad ? { isLoading: false } : {}),
      })
      savePersisted()
    } catch {
      set({ error: 'Failed to fetch folder tree', ...(isInitialLoad ? { isLoading: false } : {}) })
    }
  },

  createFolder: async (name, parentId = null) => {
    set({ isLoading: true, error: null })
    try {
      const auto = useThemeStore.getState().autoFolderColors
      const color = auto ? suggestFolderColor(name) : undefined
      const { folder } = await foldersApi.create({
        name,
        parentId,
        ...(color ? { color } : {}),
      })
      set((state) => ({
        folders: [...state.folders, folder],
        isLoading: false,
      }))
      get().fetchFolderTree()
      return folder
    } catch (err) {
      set({ error: 'Failed to create folder', isLoading: false })
      throw err
    }
  },

  applyAutoColorsToUncolored: async () => {
    let tree = get().folderTree
    if (!tree.length) {
      await get().fetchFolderTree()
      tree = get().folderTree
    }
    const targets = collectFolders(tree).filter((f) => !f.color)
    if (targets.length === 0) return 0

    await Promise.all(
      targets.map((folder) =>
        foldersApi.update(folder.id, { color: suggestFolderColor(folder.name) })
      )
    )
    await get().fetchFolderTree()
    return targets.length
  },

  updateFolder: async (id, data) => {
    try {
      const { folder } = await foldersApi.update(id, data)
      set((state) => ({
        folders: state.folders.map((f) => (f.id === id ? folder : f)),
      }))
      get().fetchFolderTree()
    } catch (err) {
      set({ error: 'Failed to update folder' })
      throw err
    }
  },

  deleteFolder: async (id, cascade = false) => {
    try {
      await foldersApi.delete(id, cascade)
      set((state) => {
        const expanded = new Set(state.expandedFolders)
        expanded.delete(id)
        return {
          folders: state.folders.filter((f) => f.id !== id),
          selectedFolderId: state.selectedFolderId === id ? null : state.selectedFolderId,
          selectedFolderIds: state.selectedFolderIds.filter((fid) => fid !== id),
          expandedFolders: expanded,
        }
      })
      savePersisted()
      get().fetchFolderTree()
    } catch (err) {
      set({ error: 'Failed to delete folder' })
      throw err
    }
  },

  deleteMultipleFolders: async (ids) => {
    try {
      await Promise.all(ids.map((id) => foldersApi.delete(id, true)))
      set((state) => {
        const idSet = new Set(ids)
        const expanded = new Set([...state.expandedFolders].filter((id) => !idSet.has(id)))
        return {
          folders: state.folders.filter((f) => !idSet.has(f.id)),
          selectedFolderId:
            state.selectedFolderId && idSet.has(state.selectedFolderId)
              ? null
              : state.selectedFolderId,
          selectedFolderIds: [],
          expandedFolders: expanded,
        }
      })
      savePersisted()
      get().fetchFolderTree()
    } catch (err) {
      set({ error: 'Failed to delete folders' })
      throw err
    }
  },

  moveNoteToFolder: async (noteId, folderId) => {
    try {
      await foldersApi.moveNote(noteId, folderId)
      get().fetchFolderTree()
    } catch (err) {
      set({ error: 'Failed to move note' })
      throw err
    }
  },

  reorderFolder: async (folderId, newParentId, newPosition) => {
    try {
      await foldersApi.reorder(folderId, newParentId, newPosition)
      get().fetchFolderTree()
    } catch (err) {
      set({ error: 'Failed to reorder folder' })
      throw err
    }
  },

  reorderNote: async (noteId, newFolderId, newPosition) => {
    try {
      await foldersApi.reorderNote(noteId, newFolderId, newPosition)
      get().fetchFolderTree()
    } catch (err) {
      set({ error: 'Failed to reorder note' })
      throw err
    }
  },

  selectFolder: (id) => {
    set({ selectedFolderId: id })
    savePersisted()
  },

  toggleFolderExpanded: (id) => {
    set((state) => {
      const expanded = new Set(state.expandedFolders)
      if (expanded.has(id)) {
        expanded.delete(id)
      } else {
        expanded.add(id)
      }
      return { expandedFolders: expanded, selectedFolderId: id }
    })
    savePersisted()
  },

  expandFolders: (ids) => {
    set((state) => {
      if (ids.length === 0) return state
      const expanded = new Set(state.expandedFolders)
      let changed = false
      for (const id of ids) {
        if (!expanded.has(id)) {
          expanded.add(id)
          changed = true
        }
      }
      return changed ? { expandedFolders: expanded } : state
    })
    savePersisted()
  },

  clearError: () => set({ error: null }),

  setNewNoteId: (id) => {
    set({ newNoteId: id })
    if (id) {
      setTimeout(() => set({ newNoteId: null }), 1000)
    }
  },

  triggerNewNoteInput: () => set({ showNewNoteInput: true }),
  closeNewNoteInput: () => set({ showNewNoteInput: false }),

  toggleFolderSelection: (id) =>
    set((state) => ({
      selectedFolderIds: state.selectedFolderIds.includes(id)
        ? state.selectedFolderIds.filter((fid) => fid !== id)
        : [...state.selectedFolderIds, id],
    })),

  clearFolderSelection: () => set({ selectedFolderIds: [] }),
}))
