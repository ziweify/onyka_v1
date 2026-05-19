import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar, MobileHeader } from '@/components/layout'
import { NoteEditor } from '@/components/editor'
import { DocumentTabBar } from '@/components/workspace/DocumentTabBar'
import { WorkspaceDashboard } from '@/components/workspace/WorkspaceDashboard'
import { useWorkspaceTabsStore, setWorkspaceTabsUser } from '@/stores/workspaceTabs'
import { WeeklyRecapModal } from '@/components/features/WeeklyRecapModal'
import { SparksDrawer } from '@/components/features/SparksDrawer'
import { SparkQuickAdd } from '@/components/features/SparkQuickAdd'
import { OnboardingModal, useOnboarding } from '@/components/features/OnboardingModal'
import { useAuthStore } from '@/stores/auth'
import { useNotesStore } from '@/stores/notes'
import { useFoldersStore } from '@/stores/folders'
import { useThemeStore } from '@/stores/theme'
import { useRecapsStore } from '@/stores/recaps'
import { useStatsStore } from '@/stores/stats'
import { useSparksStore } from '@/stores/sparks'
import { useSharesStore } from '@/stores/shares'
import { useIsMobile, useShareNotifications } from '@/hooks'
import { toast } from '@/components/ui/Toast'
import { SparkIcon } from '@/components/ui'
import type { NoteUpdateInput } from '@onyka/shared'

export function HomePage() {
  const { t } = useTranslation()
  const { activeView, openNote, goHome, closeTab, updateTabTitle } = useWorkspaceTabsStore()
  const selectedNoteId = activeView === 'home' ? null : activeView
  const [dashboardRefresh, setDashboardRefresh] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { currentNote, fetchNote, updateNote, setCurrentNote, deleteNote } = useNotesStore()
  const { fetchFolderTree, triggerNewNoteInput } = useFoldersStore()
  const { focusMode, focusEditorWidth, setFocusEditorWidth, toggleFocusMode, openMobileSidebar, closeMobileSidebar } = useThemeStore()
  const [isResizingFocus, setIsResizingFocus] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const { pendingRecap, fetchPendingRecap, dismissRecap, isRecapModalOpen, openRecapModal } = useRecapsStore()
  const { trackingEnabled } = useStatsStore()
  const { openQuickAdd: openSparkQuickAdd } = useSparksStore()
  const { fetchSharedWithMe } = useSharesStore()
  const isMobile = useIsMobile()
  const { user } = useAuthStore()
  const { isOpen: isOnboardingOpen, close: closeOnboardingBase } = useOnboarding(user?.id, user?.onboardingCompleted)
  const closeOnboarding = useCallback(() => {
    closeOnboardingBase()
    closeMobileSidebar()
  }, [closeOnboardingBase, closeMobileSidebar])

  useShareNotifications({
    onShareReceived: (notification) => {
      toast.info(
        t('share.notification_title', 'New share'),
        t('share.notification_body', '{{name}} shared "{{title}}" with you', {
          name: notification.sharedBy.name || notification.sharedBy.username,
          title: notification.resourceTitle,
        })
      )
      fetchSharedWithMe()
    },
  })

  const handleNewNote = useCallback(() => {
    triggerNewNoteInput()
    if (isMobile) {
      openMobileSidebar()
    }
  }, [triggerNewNoteInput, isMobile, openMobileSidebar])

  useEffect(() => {
    setWorkspaceTabsUser(user?.id ?? null)
  }, [user?.id])

  useEffect(() => {
    if (activeView === 'home') {
      setDashboardRefresh((k) => k + 1)
    }
  }, [activeView])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'w' && (e.metaKey || e.ctrlKey) && activeView !== 'home') {
        e.preventDefault()
        closeTab(activeView)
        return
      }
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.code === 'Space' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        e.stopPropagation()
        openSparkQuickAdd()
      }
      if (e.key.toLowerCase() === 'f' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        toggleFocusMode()
      }
      if (focusMode && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        if (e.key === '[') {
          e.preventDefault()
          setFocusEditorWidth(Math.max(40, focusEditorWidth - 10))
        }
        if (e.key === ']') {
          e.preventDefault()
          setFocusEditorWidth(Math.min(100, focusEditorWidth + 10))
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleFocusMode, focusMode, focusEditorWidth, setFocusEditorWidth, openSparkQuickAdd, activeView, closeTab])

  useEffect(() => {
    if (!isResizingFocus) return
    let rafId = 0
    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const center = window.innerWidth / 2
        const halfWidth = Math.abs(e.clientX - center)
        const newPercent = Math.round((halfWidth * 2) / window.innerWidth * 100)
        setFocusEditorWidth(Math.max(40, Math.min(100, newPercent)))
      })
    }
    const handleMouseUp = () => {
      cancelAnimationFrame(rafId)
      setIsResizingFocus(false)
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingFocus, setFocusEditorWidth])

  useEffect(() => {
    if (trackingEnabled) {
      fetchPendingRecap()
    }
  }, [trackingEnabled, fetchPendingRecap])

  useEffect(() => {
    if (pendingRecap && trackingEnabled && !isRecapModalOpen) {
      const timer = setTimeout(() => {
        openRecapModal()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [pendingRecap, trackingEnabled, isRecapModalOpen, openRecapModal])

  useEffect(() => {
    if (selectedNoteId) {
      fetchNote(selectedNoteId)
    } else {
      setCurrentNote(null)
    }
  }, [selectedNoteId, fetchNote, setCurrentNote])

  useEffect(() => {
    if (currentNote?.id && currentNote.title) {
      updateTabTitle(currentNote.id, currentNote.title)
    }
  }, [currentNote?.id, currentNote?.title, updateTabTitle])

  const handleSelectNote = useCallback(
    (noteId: string, title?: string) => {
      if (!noteId) {
        goHome()
        return
      }
      openNote(noteId, title)
    },
    [goHome, openNote]
  )

  const handleUpdateNote = useCallback(
    async (updates: NoteUpdateInput) => {
      if (currentNote) {
        await updateNote(currentNote.id, updates)
        if (updates.title !== undefined) {
          fetchFolderTree()
        }
      }
    },
    [currentNote, updateNote, fetchFolderTree]
  )

  const handleDeleteNote = useCallback(async () => {
    if (currentNote) {
      await deleteNote(currentNote.id)
      closeTab(currentNote.id)
      goHome()
      fetchFolderTree()
    }
  }, [currentNote, deleteNote, closeTab, goHome, fetchFolderTree])

  return (
    <div className={`h-dvh flex flex-col md:flex-row bg-[var(--color-bg-primary)] overflow-hidden transition-all duration-500 ${focusMode ? 'p-0' : 'p-2 gap-2 md:p-3 md:gap-3'}`}>
      {!focusMode && (
        <MobileHeader
          onOpenSidebar={openMobileSidebar}
          onOpenSearch={() => { openMobileSidebar(); setTimeout(() => searchInputRef.current?.focus(), 300) }}
        />
      )}

      <Sidebar
        onSelectNote={handleSelectNote}
        selectedNoteId={selectedNoteId}
        searchInputRef={searchInputRef}
      />

      <main
        ref={mainRef}
        className={`flex-1 flex flex-col overflow-hidden relative ${
          isResizingFocus ? '' : 'transition-all duration-500 ease-out'
        } ${
          focusMode
            ? 'bg-[var(--color-bg-primary)] w-full mx-auto border border-transparent shadow-none'
            : 'bg-[var(--color-bg-secondary)] rounded-xl md:rounded-2xl border border-[var(--color-border-subtle)] shadow-lg mt-14 md:mt-0'
        }`}
        style={focusMode ? { maxWidth: `${focusEditorWidth}%` } : undefined}
        role="main"
        aria-label="Note content"
      >
        {focusMode && (
          <>
            {isResizingFocus && (
              <div className="fixed inset-0 z-40 cursor-col-resize" />
            )}
            <div
              onMouseDown={(e) => { e.preventDefault(); setIsResizingFocus(true) }}
              className="absolute top-0 -left-2 w-4 h-full cursor-col-resize z-30 group flex items-center justify-center"
            >
              <div className={`w-0.5 h-10 rounded-full transition-all duration-200 ${
                isResizingFocus
                  ? 'bg-[var(--color-accent)] opacity-80 h-16'
                  : 'bg-[var(--color-border)] opacity-0 group-hover:opacity-50'
              }`} />
            </div>
            <div
              onMouseDown={(e) => { e.preventDefault(); setIsResizingFocus(true) }}
              className="absolute top-0 -right-2 w-4 h-full cursor-col-resize z-30 group flex items-center justify-center"
            >
              <div className={`w-0.5 h-10 rounded-full transition-all duration-200 ${
                isResizingFocus
                  ? 'bg-[var(--color-accent)] opacity-80 h-16'
                  : 'bg-[var(--color-border)] opacity-0 group-hover:opacity-50'
              }`} />
            </div>
          </>
        )}
        {!focusMode && <DocumentTabBar />}
        {activeView === 'home' ? (
          <WorkspaceDashboard onNewNote={handleNewNote} refreshKey={dashboardRefresh} />
        ) : currentNote && currentNote.id === activeView ? (
          <NoteEditor note={currentNote} onUpdate={handleUpdateNote} onDelete={handleDeleteNote} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-secondary)]">
            {t('common.loading')}
          </div>
        )}
      </main>

      {pendingRecap && (
        <WeeklyRecapModal
          isOpen={isRecapModalOpen}
          recap={pendingRecap}
          onDismiss={() => dismissRecap(pendingRecap.id)}
        />
      )}

      <SparksDrawer />
      <SparkQuickAdd />

      <OnboardingModal isOpen={isOnboardingOpen} onClose={closeOnboarding} />

      {focusMode && !isMobile && (
        <button
          onClick={openSparkQuickAdd}
          className="fixed bottom-6 right-6 p-3.5 rounded-2xl text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 z-30"
          style={{
            background: 'linear-gradient(135deg, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 80%, #000) 100%)',
            boxShadow: '0 8px 32px -4px var(--color-accent-glow)',
          }}
          title={t('sparks.title')}
        >
          <SparkIcon className="w-5 h-5" animated />
        </button>
      )}
    </div>
  )
}
