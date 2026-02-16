import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { arrayMove } from '@dnd-kit/sortable'
import './App.scss'
import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  fsQuery,
  serverTimestamp,
} from './firebase'
import { extractInlineTags, uniqueTags } from './utils/tags'
import { buildSnippet } from './utils/string.jsx'
import { renderMarkdownWithOutline, parseBriefMarkets } from './utils/markdown'
import { richDocToHtml } from './utils/richText'
import { formatDate } from './utils/date'
import { createId, sortDocs } from './utils/helpers'
import NewListModal from './components/NewListModal/NewListModal'
import ConfirmDialog from './components/ConfirmDialog/ConfirmDialog'
import AppHeader from './components/AppHeader/AppHeader'
import Rightbar from './components/Rightbar/Rightbar'
import Sidebar from './components/Sidebar/Sidebar'
import Viewer from './components/Viewer/Viewer'
import LoginPage from './components/LoginPage/LoginPage'

const APP_VERSION = '0.1.3'

export default function App() {
  const [firestoreDocs, setFirestoreDocs] = useState([])
  const [firestoreLists, setFirestoreLists] = useState([])
  const docs = useMemo(() => sortDocs(firestoreDocs), [firestoreDocs])
  const [query, setQuery] = useState('')
  const [activePath, setActivePath] = useState(docs[0]?.path)
  const [openSections, setOpenSections] = useState({ notes: true, lists: true, journal: true, briefs: true })
  const [user, setUser] = useState(null)
  const [showListModal, setShowListModal] = useState(false)
  const [listTitle, setListTitle] = useState('')
  const [listSaving, setListSaving] = useState(false)
  const [activeListId, setActiveListId] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('dock.theme') || 'green')
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 900
  })
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth > 900
  })
  const [autoEditDocId, setAutoEditDocId] = useState(null)
  const appRef = useRef(null)
  const searchRef = useRef(null)
  const isMobileRef = useRef(typeof window !== 'undefined' ? window.innerWidth <= 900 : false)

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser)
  }), [])

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
    localStorage.setItem('dock.theme', theme)
  }, [theme])

  useEffect(() => {
    const syncSidebarForViewport = () => {
      const isMobile = window.innerWidth <= 900
      setIsMobileViewport(isMobile)
      if (isMobile !== isMobileRef.current) {
        isMobileRef.current = isMobile
        setSidebarOpen(!isMobile)
      }
    }

    // Handles device-emulation viewport settling after initial JS load.
    requestAnimationFrame(syncSidebarForViewport)
    window.addEventListener('resize', syncSidebarForViewport)
    return () => window.removeEventListener('resize', syncSidebarForViewport)
  }, [])

  useEffect(() => {
    if (!user) {
      setActiveListId(null)
      setShowListModal(false)
      setConfirmDialog(null)
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setFirestoreDocs([])
      return undefined
    }

    const notesQuery = fsQuery(collection(db, 'notes'), orderBy('updatedAt', 'desc'))
    return onSnapshot(notesQuery, (snapshot) => {
      const nextDocs = snapshot.docs.map((snap) => {
        const data = snap.data() || {}
        const content = data.content || ''
        const contentJson = data.contentJson || null
        const title = data.title || 'Untitled'
        const created = formatDate(data.createdAt?.toDate?.() || data.createdAt)
        const updated = formatDate(data.updatedAt?.toDate?.() || data.updatedAt)
        const markdownRendered = renderMarkdownWithOutline(content)
        const html = contentJson ? richDocToHtml(contentJson) : markdownRendered.html
        const outline = contentJson ? [] : markdownRendered.outline
        const frontTags = Array.isArray(data.tags) ? data.tags : []
        const inlineTags = extractInlineTags(content)
        const tags = uniqueTags([...frontTags, ...inlineTags])
        const type = data.type || 'note'
        const isJournal = type === 'journal'
        const isBrief = type === 'brief'

        return {
          path: `firestore:${type}/${snap.id}`,
          slug: `${type} / ${title}`,
          title,
          created,
          updated,
          content,
          contentJson,
          html,
          outline,
          tags,
          rawTags: frontTags,
          isJournal,
          isBrief,
          isDraft: Boolean(data.isDraft),
          source: 'firestore',
          id: snap.id,
        }
      })
      setFirestoreDocs(nextDocs)
    })
  }, [user])

  useEffect(() => {
    if (!user) {
      setFirestoreLists([])
      return undefined
    }

    const listsQuery = fsQuery(collection(db, 'lists'), orderBy('updatedAt', 'desc'))
    return onSnapshot(listsQuery, (snapshot) => {
      const nextLists = snapshot.docs.map((snap) => {
        const data = snap.data() || {}
        const items = Array.isArray(data.items) ? data.items : []
        const created = formatDate(data.createdAt?.toDate?.() || data.createdAt)
        const updated = formatDate(data.updatedAt?.toDate?.() || data.updatedAt)
        return {
          id: snap.id,
          title: data.title || 'Untitled List',
          items,
          created,
          updated,
          source: 'firestore',
        }
      })
      setFirestoreLists(nextLists)
    })
  }, [user])

  useEffect(() => {
    if (!activeListId) {
      setConfirmDialog(null)
    } else if (!firestoreLists.find((list) => list.id === activeListId)) {
      setActiveListId(null)
    }
  }, [activeListId, firestoreLists])


  const createDocument = async (type, { title, tags = [] } = {}) => {
    if (!user) return
    const docTitle = title || 'Untitled'
    const docRef = await addDoc(collection(db, 'notes'), {
      title: docTitle,
      content: '',
      contentJson: { type: 'doc', content: [{ type: 'paragraph' }] },
      tags,
      type,
      isDraft: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    setAutoEditDocId(docRef.id)
    setActivePath(`firestore:${type}/${docRef.id}`)
    setActiveListId(null)
    if (isMobileViewport) setSidebarOpen(false)
  }

  const handleCreateNote = () => createDocument('note')

  const handleCreateJournal = () => {
    const today = new Date().toISOString().slice(0, 10)
    return createDocument('journal', { title: `Daily Journal — ${today}`, tags: ['journal'] })
  }

  const handleUpdateNoteInline = async (docItem, { title, content, contentJson, tags }) => {
    if (!docItem?.id) return
    await updateDoc(doc(db, 'notes', docItem.id), {
      title: title?.trim() || 'Untitled',
      content: content || '',
      contentJson: contentJson || null,
      tags: Array.isArray(tags) ? tags : [],
      updatedAt: serverTimestamp(),
      isDraft: false,
    })
    if (autoEditDocId === docItem.id) {
      setAutoEditDocId(null)
    }
  }

  const handleDeleteNoteInline = async (docItem) => {
    if (!docItem?.id) return
    await deleteDoc(doc(db, 'notes', docItem.id))
    setActivePath(null)
    setActiveListId(null)
  }

  const handleCreateList = async () => {
    if (!user) return
    const title = listTitle.trim() || 'Untitled List'
    setListSaving(true)
    try {
      const docRef = await addDoc(collection(db, 'lists'), {
        title,
        items: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setShowListModal(false)
      setListTitle('')
      setActiveListId(docRef.id)
    } finally {
      setListSaving(false)
    }
  }

  const updateListItems = async (listId, items) => {
    await updateDoc(doc(db, 'lists', listId), {
      items,
      updatedAt: serverTimestamp(),
    })
  }

  const handleRenameList = async (nextTitle) => {
    if (!activeListId) return
    await updateDoc(doc(db, 'lists', activeListId), {
      title: nextTitle,
      updatedAt: serverTimestamp(),
    })
  }

  const handleAddListItem = async (text) => {
    if (!activeListId || !text) return
    const list = firestoreLists.find((item) => item.id === activeListId)
    if (!list) return
    const items = list.items || []
    const incomplete = items.filter((item) => !item.completed)
    const completed = items.filter((item) => item.completed)
    const nextItems = [
      {
        id: createId(),
        text,
        completed: false,
        createdAt: Date.now(),
      },
      ...incomplete,
      ...completed,
    ]
    await updateListItems(activeListId, nextItems)
  }

  const runCompleteAnimation = (itemId) => new Promise((resolve) => {
    const el = document.querySelector(`[data-item-id="${itemId}"]`)
    if (!el) {
      resolve()
      return
    }
    el.classList.add('is-completing')
    const swipeEl = el.querySelector('.list-item__swipe')
    if (!swipeEl) {
      resolve()
      return
    }
    gsap.killTweensOf(swipeEl)
    gsap.set(swipeEl, { xPercent: -120, opacity: 0 })
    gsap.to(swipeEl, {
      xPercent: 120,
      opacity: 0,
      duration: 0.6,
      ease: 'power2.out',
      onStart: () => gsap.set(swipeEl, { opacity: 0.45 }),
      onComplete: resolve,
    })
  })

  const handleToggleListItem = async (listId, itemId) => {
    const list = firestoreLists.find((item) => item.id === listId)
    if (!list) return
    const items = list.items || []
    const target = items.find((item) => item.id === itemId)
    if (!target) return
    const remaining = items.filter((item) => item.id !== itemId)
    const remainingIncomplete = remaining.filter((item) => !item.completed)
    const remainingCompleted = remaining.filter((item) => item.completed)
    const updated = { ...target, completed: !target.completed }
    if (updated.completed) {
      await runCompleteAnimation(itemId)
    }
    const nextItems = updated.completed
      ? [...remainingIncomplete, ...remainingCompleted, updated]
      : [updated, ...remainingIncomplete, ...remainingCompleted]
    await updateListItems(listId, nextItems)
  }


  const handleEditListItem = async (listId, itemId, nextText) => {
    const list = firestoreLists.find((item) => item.id === listId)
    if (!list) return
    const trimmed = nextText.trim()
    if (!trimmed) return
    const nextItems = (list.items || []).map((item) => (
      item.id === itemId ? { ...item, text: trimmed } : item
    ))
    await updateListItems(listId, nextItems)
  }

  const handleDeleteListItem = async (listId, itemId) => {
    const list = firestoreLists.find((item) => item.id === listId)
    if (!list) return
    const nextItems = (list.items || []).filter((item) => item.id !== itemId)
    await updateListItems(listId, nextItems)
  }


  const handleDiscardNewDocInline = async (docItem) => {
    if (!docItem?.id) return
    await deleteDoc(doc(db, 'notes', docItem.id))
    if (autoEditDocId === docItem.id) setAutoEditDocId(null)
    setActivePath(null)
    setActiveListId(null)
  }


  const requestDiscardNewDoc = (docItem) => {
    openConfirmDialog({
      title: 'Discard new entry?',
      body: <>Discard <strong>{docItem?.title || 'Untitled'}</strong>? Unsaved changes will be lost.</>,
      confirmLabel: 'Discard',
      onConfirm: () => handleDiscardNewDocInline(docItem),
    })
  }

  const handleDeleteList = async () => {
    if (!activeListId || !activeList) return
    await deleteDoc(doc(db, 'lists', activeListId))
    setActiveListId(null)
  }

  const openConfirmDialog = ({ title, body, confirmLabel = 'Delete', onConfirm }) => {
    setConfirmDialog({ title, body, confirmLabel, onConfirm })
  }

  const closeConfirmDialog = () => setConfirmDialog(null)

  const handleConfirmAction = async () => {
    if (!confirmDialog?.onConfirm) return
    try {
      await confirmDialog.onConfirm()
    } finally {
      setConfirmDialog(null)
    }
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    if (!activeListId) return
    const list = firestoreLists.find((item) => item.id === activeListId)
    if (!list) return
    const items = list.items || []
    const incomplete = items.filter((item) => !item.completed)
    const completed = items.filter((item) => item.completed)
    const oldIndex = incomplete.findIndex((item) => item.id === active.id)
    const newIndex = incomplete.findIndex((item) => item.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const nextIncomplete = arrayMove(incomplete, oldIndex, newIndex)
    await updateListItems(activeListId, [...nextIncomplete, ...completed])
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return docs
    return docs.filter((doc) => {
      const haystack = `${doc.title} ${doc.slug} ${doc.content}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [docs, query])

  const filteredLists = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return firestoreLists
    return firestoreLists.filter((list) => {
      const itemText = (list.items || []).map((item) => item.text).join(' ')
      const haystack = `${list.title} ${itemText}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [firestoreLists, query])

  const activeDoc = useMemo(
    () => (activeListId ? null : filtered.find((doc) => doc.path === activePath) || filtered[0]),
    [activeListId, filtered, activePath],
  )
  const activeList = useMemo(
    () => firestoreLists.find((list) => list.id === activeListId) || null,
    [firestoreLists, activeListId],
  )

  const listStats = useMemo(() => {
    if (!activeList) return null
    const total = activeList.items?.length || 0
    const completed = activeList.items?.filter((item) => item.completed).length || 0
    return { total, completed }
  }, [activeList])

  const outline = activeDoc?.outline || []

  const backlinks = useMemo(() => {
    if (!activeDoc) return []
    const needle = activeDoc.title?.toLowerCase()
    if (!needle) return []
    return docs.filter((doc) => {
      if (doc.path === activeDoc.path) return false
      return doc.content.toLowerCase().includes(needle)
    })
  }, [docs, activeDoc])

  const snippetMap = useMemo(() => {
    if (!activeDoc?.title) return new Map()
    const map = new Map()
    backlinks.forEach((doc) => {
      map.set(doc.path, buildSnippet(doc.content, activeDoc.title))
    })
    return map
  }, [backlinks, activeDoc])

  const docStats = useMemo(() => {
    if (!activeDoc) return { words: 0, minutes: 0 }
    const words = activeDoc.content.split(/\s+/).filter(Boolean).length
    const minutes = Math.max(1, Math.round(words / 200))
    return { words, minutes }
  }, [activeDoc])

  const briefGreeting = useMemo(() => {
    if (!activeDoc?.isBrief) return null
    const dateStr = activeDoc.created || ''
    const date = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date()
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' })
    const variants = [
      `Good morning, dFree — Happy ${weekday}.`,
      `Rise and shine, dFree. Happy ${weekday}!`,
      `Morning, dFree. Let’s win this ${weekday}.`,
      `Hey dFree — fresh ${weekday}, fresh brief.`,
    ]
    const index = date.getDate() % variants.length
    return variants[index]
  }, [activeDoc])

  const relatedDocs = useMemo(() => {
    if (!activeDoc?.tags?.length) return []
    const activeTags = new Set(activeDoc.tags.map((tag) => tag.toLowerCase()))
    return docs
      .filter((doc) => doc.path !== activeDoc.path)
      .map((doc) => {
        const overlap = doc.tags.filter((tag) => activeTags.has(tag.toLowerCase()))
        return { doc, score: overlap.length, overlap }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }, [docs, activeDoc])

  const briefCompare = useMemo(() => {
    if (!activeDoc?.isBrief) return null
    const briefDocs = docs
      .filter((doc) => doc.isBrief && doc.created)
      .sort((a, b) => a.created.localeCompare(b.created))

    const index = briefDocs.findIndex((item) => item.path === activeDoc.path)
    if (index <= 0) return null

    const today = briefDocs[index]
    const yesterday = briefDocs[index - 1]

    return {
      today,
      yesterday,
      todayMarkets: parseBriefMarkets(today.content),
      yesterdayMarkets: parseBriefMarkets(yesterday.content),
    }
  }, [docs, activeDoc])

  useEffect(() => {
    if (activeListId) return
    if (filtered.length && !filtered.find((doc) => doc.path === activePath)) {
      setActivePath(filtered[0].path)
    }
  }, [filtered, activePath, activeListId])


  const grouped = useMemo(() => {
    const excludedNoteTitles = new Set(['Brief Archive', 'The Dock Docs'])
    const journals = filtered.filter((doc) => doc.isJournal)
    const briefs = filtered.filter((doc) => doc.isBrief)
    const notes = filtered.filter((doc) => !doc.isJournal && !doc.isBrief)
      .filter((doc) => !excludedNoteTitles.has(doc.title))
    return { journals, briefs, notes }
  }, [filtered])

  const totalCount = docs.length + firestoreLists.length
  const filteredCount = filtered.length + filteredLists.length

  useEffect(() => {
    if (!appRef.current) return
    const targetWidth = isMobileViewport
      ? 42
      : (sidebarOpen ? 320 : 56)

    gsap.to(appRef.current, {
      '--sidebar-width': `${targetWidth}px`,
      duration: 0.46,
      ease: 'power3.inOut',
      overwrite: 'auto',
    })
  }, [sidebarOpen, isMobileViewport])

  const handleSelectDoc = useCallback((path) => {
    setAutoEditDocId(null)
    setActivePath(path)
    setActiveListId(null)
    if (isMobileViewport) setSidebarOpen(false)
  }, [isMobileViewport])

  const handleSelectList = useCallback((id) => {
    setAutoEditDocId(null)
    setActiveListId(id)
    setActivePath(null)
    if (isMobileViewport) setSidebarOpen(false)
  }, [isMobileViewport])

  const handleNavigate = useCallback((path) => {
    setActivePath(path)
    setActiveListId(null)
  }, [])

  const handleToggleSection = useCallback((key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev)
  }, [])

  if (!user) {
    return <LoginPage />
  }

  return (
    <div className="app" ref={appRef}>

      {showListModal && (
        <NewListModal
          listTitle={listTitle}
          onTitleChange={setListTitle}
          onClose={() => setShowListModal(false)}
          onCreate={handleCreateList}
          saving={listSaving}
        />
      )}

      <ConfirmDialog
        dialog={confirmDialog}
        onClose={closeConfirmDialog}
        onConfirm={handleConfirmAction}
      />


      <AppHeader
        user={user}
        theme={theme}
        onThemeChange={setTheme}
        version={APP_VERSION}
      />

      <Sidebar
        ref={searchRef}
        query={query}
        onQueryChange={setQuery}
        filteredCount={filteredCount}
        totalCount={totalCount}
        grouped={grouped}
        filteredLists={filteredLists}
        openSections={openSections}
        onToggleSection={handleToggleSection}
        activeDoc={activeDoc}
        activeListId={activeListId}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
        onNewNote={handleCreateNote}
        onNewList={() => setShowListModal(true)}
        onNewJournal={handleCreateJournal}
        onSelectDoc={handleSelectDoc}
        onSelectList={handleSelectList}
      />

      <Viewer
        activeList={activeList}
        activeDoc={activeDoc}
        listStats={listStats}
        briefGreeting={briefGreeting}
        user={user}
        autoEditDocId={autoEditDocId}
        onSaveDoc={handleUpdateNoteInline}
        onDiscardNewDoc={handleDiscardNewDocInline}
        onRequestDiscardNewDoc={requestDiscardNewDoc}
        onDeleteDoc={(docItem) => openConfirmDialog({
          title: docItem?.isBrief ? 'Delete brief?' : 'Delete note?',
          body: <>Delete <strong>{docItem?.title || 'Untitled'}</strong>? This cannot be undone.</>,
          confirmLabel: docItem?.isBrief ? 'Delete Brief' : 'Delete Note',
          onConfirm: () => handleDeleteNoteInline(docItem),
        })}
        onAddListItem={handleAddListItem}
        onToggleListItem={handleToggleListItem}
        onDeleteListItem={handleDeleteListItem}
        onEditListItem={handleEditListItem}
        onDeleteList={() => openConfirmDialog({
          title: 'Delete list?',
          body: <>Delete <strong>{activeList?.title}</strong>? This cannot be undone.</>,
          onConfirm: handleDeleteList,
        })}
        onRenameList={handleRenameList}
        onDragEnd={handleDragEnd}
      />

      <Rightbar
        activeList={activeList}
        activeDoc={activeDoc}
        listStats={listStats}
        outline={outline}
        docStats={docStats}
        briefCompare={briefCompare}
        relatedDocs={relatedDocs}
        backlinks={backlinks}
        snippetMap={snippetMap}
        onNavigate={handleNavigate}
      />
    </div>
  )
}
