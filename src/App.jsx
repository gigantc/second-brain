import { useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import { gsap } from 'gsap'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './App.scss'
import {
  auth,
  db,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
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

const docModules = import.meta.glob('../docs/**/*.md', { query: '?raw', import: 'default', eager: true })

function parseFrontMatter(raw) {
  if (!raw.startsWith('---')) {
    return { data: {}, content: raw }
  }

  const end = raw.indexOf('\n---', 3)
  if (end === -1) {
    return { data: {}, content: raw }
  }

  const matterBlock = raw.slice(3, end).trim()
  const content = raw.slice(end + 4).trimStart()
  const data = {}

  matterBlock.split('\n').forEach((line) => {
    const [key, ...rest] = line.split(':')
    if (!key) return
    const value = rest.join(':').trim()
    if (!value) return

    if (key.trim() === 'tags') {
      const match = value.match(/\[(.*)\]/)
      data.tags = match
        ? match[1].split(',').map((tag) => tag.trim()).filter(Boolean)
        : value.split(',').map((tag) => tag.trim()).filter(Boolean)
    } else {
      data[key.trim()] = value.replace(/^"|"$/g, '')
    }
  })

  return { data, content }
}

function extractInlineTags(content) {
  const matches = content.match(/(^|\s)#([a-z0-9_-]+)/gi) || []
  return matches.map((tag) => tag.replace(/^\s*#/, '').trim())
}

function uniqueTags(tags) {
  const seen = new Set()
  return tags.filter((tag) => {
    const normalized = tag.toLowerCase()
    if (seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function highlightText(text, query) {
  if (!query) return text
  const safeQuery = escapeRegExp(query)
  if (!safeQuery) return text
  const regex = new RegExp(`(${safeQuery})`, 'ig')
  const parts = String(text).split(regex)
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={`${part}-${index}`} className="highlight">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

function buildSnippet(content, needle, maxLen = 120) {
  if (!needle) return ''
  const clean = content.replace(/\s+/g, ' ').trim()
  const lower = clean.toLowerCase()
  const index = lower.indexOf(needle.toLowerCase())
  if (index === -1) return clean.slice(0, maxLen).trim()
  const start = Math.max(0, index - 40)
  const end = Math.min(clean.length, index + needle.length + 60)
  const snippet = clean.slice(start, end).trim()
  return `${start > 0 ? '…' : ''}${snippet}${end < clean.length ? '…' : ''}`
}

function buildChecklistItems(content) {
  const lines = content.split('\n')
  return lines
    .map((line) => line.match(/^\s*- \[(x| )\]\s+(.*)$/i))
    .filter(Boolean)
    .map((match) => ({
      id: createId(),
      text: match[2].trim(),
      completed: match[1].toLowerCase() === 'x',
      createdAt: Date.now(),
    }))
}

function parseBriefMarkets(content) {
  const lines = content.split('\n')
  const keys = ['S&P 500', 'Nasdaq', 'Dow', 'BTC', 'ETH']
  const results = {}
  lines.forEach((line) => {
    keys.forEach((key) => {
      if (line.includes(`**${key}**`)) {
        results[key] = line.replace(/^-\s*/, '').trim()
      }
    })
  })
  return results
}

function getBriefDateFromPath(path) {
  const match = path.match(/(\d{4}-\d{2}-\d{2})-brief\.md$/)
  return match ? match[1] : null
}

function formatDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function renderMarkdownWithOutline(content) {
  const renderer = new marked.Renderer()
  const outline = []
  const counts = {}

  renderer.heading = (token) => {
    const level = token.depth ?? token.level
    const text = token.text ?? ''

    if (level < 2 || level > 3) {
      return `<h${level}>${text}</h${level}>`
    }

    const base = slugify(text)
    const count = (counts[base] = (counts[base] || 0) + 1)
    const id = count > 1 ? `${base}-${count}` : base
    outline.push({ level, text, id })
    return `<h${level} id="${id}">${text}</h${level}>`
  }

  const html = marked.parse(content, { renderer })
  return { html, outline }
}

function SortableListItem({ item, onToggle, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-item-id={item.id}
      className={`list-item list-item--sortable ${item.completed ? 'is-complete' : ''} ${isDragging ? 'is-dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className="list-item__swipe" aria-hidden="true" />
      <button
        className="list-item__checkbox"
        type="button"
        onClick={onToggle}
        aria-pressed={item.completed}
      >
        <span className="list-item__check" />
      </button>
      <span className="list-item__text">{item.text}</span>
      <button
        className="list-item__delete"
        type="button"
        onClick={onDelete}
        aria-label="Delete item"
      >
        ×
      </button>
    </li>
  )
}

function buildDocs(modules) {
  return Object.entries(modules).map(([path, raw]) => {
    const { data, content } = parseFrontMatter(raw)
    const slug = path
      .replace('../docs/', '')
      .replace(/\.md$/, '')
      .replace(/\//g, ' / ')
    const title = data?.title || slug
    const created = data?.created || null
    const updated = data?.updated || null
    const isJournal = path.includes('/docs/journal/')
    const isBrief = path.includes('/docs/briefs/') && !path.endsWith('/docs/briefs/README.md')
    const { html, outline } = renderMarkdownWithOutline(content)

    const frontMatterTags = Array.isArray(data?.tags) ? data.tags : []
    const inlineTags = extractInlineTags(content)
    const tags = uniqueTags([...frontMatterTags, ...inlineTags])

    return {
      path,
      slug,
      title,
      created,
      updated,
      content,
      html,
      outline,
      tags,
      isJournal,
      isBrief,
    }
  })
}

function sortDocs(docs) {
  return [...docs].sort((a, b) => {
    const aDate = a.updated || a.created
    const bDate = b.updated || b.created
    if (aDate && bDate) return String(bDate).localeCompare(String(aDate))
    if (aDate) return -1
    if (bDate) return 1
    return a.title.localeCompare(b.title)
  })
}

export default function App() {
  const localDocs = useMemo(() => sortDocs(buildDocs(docModules)), [])
  const [firestoreDocs, setFirestoreDocs] = useState([])
  const [firestoreLists, setFirestoreLists] = useState([])
  const hasFirestoreNotes = firestoreDocs.some((doc) => !doc.isJournal && !doc.isBrief)
  const hasFirestoreJournals = firestoreDocs.some((doc) => doc.isJournal)
  const hasFirestoreBriefs = firestoreDocs.some((doc) => doc.isBrief)
  const visibleLocalDocs = useMemo(() => {
    const ignorePaths = new Set(['../docs/notes/roadmap.md'])
    return localDocs.filter((doc) => {
      if (ignorePaths.has(doc.path)) return false
      if (doc.isBrief && hasFirestoreBriefs) return false
      if (doc.isJournal && hasFirestoreJournals) return false
      if (!doc.isJournal && !doc.isBrief && doc.path.includes('/docs/notes/') && hasFirestoreNotes) return false
      return true
    })
  }, [localDocs, hasFirestoreNotes, hasFirestoreJournals, hasFirestoreBriefs])
  const docs = useMemo(() => sortDocs([...visibleLocalDocs, ...firestoreDocs]), [visibleLocalDocs, firestoreDocs])
  const [query, setQuery] = useState('')
  const [activePath, setActivePath] = useState(docs[0]?.path)
  const [activeHeadingId, setActiveHeadingId] = useState(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [openSections, setOpenSections] = useState({ notes: true, lists: true, journal: true, briefs: true })
  const [user, setUser] = useState(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editorId, setEditorId] = useState(null)
  const [editorTitle, setEditorTitle] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [editorTags, setEditorTags] = useState('')
  const [editorSaving, setEditorSaving] = useState(false)
  const [showListModal, setShowListModal] = useState(false)
  const [listTitle, setListTitle] = useState('')
  const [listSaving, setListSaving] = useState(false)
  const [activeListId, setActiveListId] = useState(null)
  const [listsLoaded, setListsLoaded] = useState(false)
  const [newItemText, setNewItemText] = useState('')
  const [isEditingListTitle, setIsEditingListTitle] = useState(false)
  const [listTitleDraft, setListTitleDraft] = useState('')
  const [confirmDialog, setConfirmDialog] = useState(null)
  const notesRef = useRef(null)
  const listsRef = useRef(null)
  const journalRef = useRef(null)
  const briefsRef = useRef(null)
  const searchRef = useRef(null)
  const seedListRef = useRef(false)

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser)
    if (!nextUser) setAuthError('')
  }), [])

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
        const title = data.title || 'Untitled'
        const created = formatDate(data.createdAt?.toDate?.() || data.createdAt)
        const updated = formatDate(data.updatedAt?.toDate?.() || data.updatedAt)
        const { html, outline } = renderMarkdownWithOutline(content)
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
          html,
          outline,
          tags,
          rawTags: frontTags,
          isJournal,
          isBrief,
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
      setListsLoaded(false)
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
      setListsLoaded(true)
    })
  }, [user])

  useEffect(() => {
    if (activeListId && !firestoreLists.find((list) => list.id === activeListId)) {
      setActiveListId(null)
    }
  }, [activeListId, firestoreLists])

  useEffect(() => {
    if (!activeListId) {
      setConfirmDialog(null)
    }
  }, [activeListId])

  useEffect(() => {
    if (!user) return
    if (!listsLoaded) return
    if (seedListRef.current) return
    if (firestoreLists.some((list) => list.title === 'Docky Roadmap')) return
    const roadmapDoc = localDocs.find((doc) => doc.path.includes('/docs/notes/roadmap.md'))
    if (!roadmapDoc) return
    const items = buildChecklistItems(roadmapDoc.content)
    if (!items.length) return
    seedListRef.current = true
    addDoc(collection(db, 'lists'), {
      title: 'Docky Roadmap',
      items,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }, [user, listsLoaded, firestoreLists, localDocs])

  useEffect(() => {
    if (!docs.length || activeListId) return
    if (!docs.find((doc) => doc.path === activePath)) {
      setActivePath(docs[0]?.path)
    }
  }, [docs, activePath, activeListId])

  const handleSignIn = async () => {
    setAuthError('')
    try {
      await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword)
    } catch (error) {
      setAuthError(error.message)
    }
  }

  const handleSignUp = async () => {
    setAuthError('')
    try {
      await createUserWithEmailAndPassword(auth, authEmail.trim(), authPassword)
    } catch (error) {
      setAuthError(error.message)
    }
  }

  const handleSignOut = async () => {
    await signOut(auth)
  }

  const openEditor = (docItem) => {
    if (!user) return
    if (docItem?.source === 'firestore') {
      setEditorId(docItem.id)
      setEditorTitle(docItem.title)
      setEditorContent(docItem.content)
      setEditorTags((docItem.rawTags || docItem.tags || []).join(', '))
    } else {
      setEditorId(null)
      setEditorTitle('')
      setEditorContent('')
      setEditorTags('')
    }
    setShowEditor(true)
  }

  const handleSaveNote = async () => {
    if (!user) return
    setEditorSaving(true)
    const tags = editorTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    try {
      if (editorId) {
        await updateDoc(doc(db, 'notes', editorId), {
          title: editorTitle.trim() || 'Untitled',
          content: editorContent,
          tags,
          updatedAt: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'notes'), {
          title: editorTitle.trim() || 'Untitled',
          content: editorContent,
          tags,
          type: 'note',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
      setShowEditor(false)
      setEditorId(null)
      setEditorTitle('')
      setEditorContent('')
      setEditorTags('')
    } finally {
      setEditorSaving(false)
    }
  }

  const handleDeleteNote = async () => {
    if (!editorId) return
    await deleteDoc(doc(db, 'notes', editorId))
    setShowEditor(false)
    setEditorId(null)
    setEditorTitle('')
    setEditorContent('')
    setEditorTags('')
  }

  const handleDeleteBrief = async (docItem) => {
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

  const handleRenameList = async () => {
    if (!activeListId) return
    const nextTitle = listTitleDraft.trim() || 'Untitled List'
    await updateDoc(doc(db, 'lists', activeListId), {
      title: nextTitle,
      updatedAt: serverTimestamp(),
    })
    setIsEditingListTitle(false)
  }

  const handleAddListItem = async () => {
    if (!activeListId || !newItemText.trim()) return
    const list = firestoreLists.find((item) => item.id === activeListId)
    if (!list) return
    const items = list.items || []
    const incomplete = items.filter((item) => !item.completed)
    const completed = items.filter((item) => item.completed)
    const nextItems = [
      {
        id: createId(),
        text: newItemText.trim(),
        completed: false,
        createdAt: Date.now(),
      },
      ...incomplete,
      ...completed,
    ]
    setNewItemText('')
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


  const handleDeleteListItem = async (listId, itemId) => {
    const list = firestoreLists.find((item) => item.id === listId)
    if (!list) return
    const nextItems = (list.items || []).filter((item) => item.id !== itemId)
    await updateListItems(listId, nextItems)
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

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

  const activeDoc = activeListId
    ? null
    : filtered.find((doc) => doc.path === activePath) || filtered[0]
  const activeList = firestoreLists.find((list) => list.id === activeListId) || null

  useEffect(() => {
    if (!activeList) {
      setIsEditingListTitle(false)
      setListTitleDraft('')
      return
    }
    setIsEditingListTitle(false)
    setListTitleDraft(activeList.title || '')
  }, [activeListId, activeList?.title])

  const listStats = useMemo(() => {
    if (!activeList) return null
    const total = activeList.items?.length || 0
    const completed = activeList.items?.filter((item) => item.completed).length || 0
    return { total, completed }
  }, [activeList])
  const incompleteItems = useMemo(() => {
    if (!activeList?.items?.length) return []
    return activeList.items.filter((item) => !item.completed)
  }, [activeList])

  const completedItems = useMemo(() => {
    if (!activeList?.items?.length) return []
    return activeList.items.filter((item) => item.completed)
  }, [activeList])

  const listItems = useMemo(() => [...incompleteItems, ...completedItems], [incompleteItems, completedItems])

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
    if (!activeDoc?.path?.includes('/docs/briefs/')) return null
    if (activeDoc.path.endsWith('README.md')) return null
    const briefDocs = docs
      .map((doc) => ({ doc, date: getBriefDateFromPath(doc.path) }))
      .filter((item) => item.date)
      .sort((a, b) => a.date.localeCompare(b.date))

    const index = briefDocs.findIndex((item) => item.doc.path === activeDoc.path)
    if (index <= 0) return null

    const today = briefDocs[index].doc
    const yesterday = briefDocs[index - 1].doc

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

  useEffect(() => {
    setActiveHeadingId(outline[0]?.id || null)
  }, [activeDoc, outline])

  useEffect(() => {
    if (!activeDoc) return
    const headings = Array.from(document.querySelectorAll('.doc__content h2[id], .doc__content h3[id]'))
    if (!headings.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveHeadingId(entry.target.id)
          }
        })
      },
      { root: null, rootMargin: '0px 0px -60% 0px', threshold: 0.1 }
    )

    headings.forEach((heading) => observer.observe(heading))

    return () => observer.disconnect()
  }, [activeDoc])

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === '/') {
        event.preventDefault()
        requestAnimationFrame(() => searchRef.current?.focus())
        return
      }

      if (!filtered.length || activeListId) return

      const currentIndex = filtered.findIndex((doc) => doc.path === activePath)
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const nextIndex = Math.min(currentIndex + 1, filtered.length - 1)
        setActivePath(filtered[nextIndex].path)
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        const prevIndex = Math.max(currentIndex - 1, 0)
        setActivePath(filtered[prevIndex].path)
      }
      if (event.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false)
        } else {
          searchRef.current?.blur()
        }
      }

      if (event.key === '?') {
        setShowShortcuts((prev) => !prev)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtered, activePath, showShortcuts, activeListId])

  useEffect(() => {
    const sections = [
      { key: 'notes', ref: notesRef },
      { key: 'lists', ref: listsRef },
      { key: 'journal', ref: journalRef },
      { key: 'briefs', ref: briefsRef },
    ]

    sections.forEach(({ key, ref }) => {
      const el = ref.current
      if (!el) return
      if (openSections[key]) {
        gsap.to(el, { height: 'auto', opacity: 1, duration: 0.2, ease: 'power1.out' })
      } else {
        gsap.to(el, { height: 0, opacity: 0, duration: 0.2, ease: 'power1.in' })
      }
    })
  }, [openSections])

  const grouped = useMemo(() => {
    const excludedNoteTitles = new Set(['Brief Archive', 'Docky Docs'])
    const excludedNotePaths = new Set([
      '../docs/briefs/README.md',
      '../docs/README.md',
      '../docs/notes/roadmap.md',
    ])
    const journals = filtered.filter((doc) => doc.isJournal)
    const briefs = filtered.filter((doc) => doc.isBrief)
    const notes = filtered.filter((doc) => !doc.isJournal && !doc.isBrief)
      .filter((doc) => !excludedNoteTitles.has(doc.title) && !excludedNotePaths.has(doc.path))
    return { journals, briefs, notes }
  }, [filtered])

  const totalCount = docs.length + firestoreLists.length
  const filteredCount = filtered.length + filteredLists.length

  return (
    <div className="app">
      {showEditor && (
        <div className="modal__backdrop" onClick={() => setShowEditor(false)}>
          <div className="modal modal--editor" onClick={(event) => event.stopPropagation()}>
            <div className="modal__title">{editorId ? 'Edit Note' : 'New Note'}</div>
            <label className="modal__label">Title</label>
            <input
              className="modal__input"
              type="text"
              placeholder="Untitled"
              value={editorTitle}
              onChange={(event) => setEditorTitle(event.target.value)}
            />
            <label className="modal__label">Tags (comma separated)</label>
            <input
              className="modal__input"
              type="text"
              placeholder="ideas, docky"
              value={editorTags}
              onChange={(event) => setEditorTags(event.target.value)}
            />
            <label className="modal__label">Content</label>
            <textarea
              className="modal__textarea"
              rows={12}
              value={editorContent}
              onChange={(event) => setEditorContent(event.target.value)}
              placeholder="Write your note in markdown..."
            />
            <div className="modal__actions">
              {editorId && (
                <button
                  className="modal__button modal__button--danger"
                  onClick={() => openConfirmDialog({
                    title: 'Delete note?',
                    body: <>Delete <strong>{editorTitle.trim() || 'Untitled'}</strong>? This cannot be undone.</>,
                    onConfirm: handleDeleteNote,
                  })}
                >
                  Delete
                </button>
              )}
              <button className="modal__button modal__button--ghost" onClick={() => setShowEditor(false)}>
                Cancel
              </button>
              <button className="modal__button" onClick={handleSaveNote} disabled={editorSaving}>
                {editorSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showListModal && (
        <div className="modal__backdrop" onClick={() => setShowListModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__title">New List</div>
            <label className="modal__label">Title</label>
            <input
              className="modal__input"
              type="text"
              placeholder="Untitled List"
              value={listTitle}
              onChange={(event) => setListTitle(event.target.value)}
            />
            <div className="modal__actions">
              <button className="modal__button modal__button--ghost" onClick={() => setShowListModal(false)}>
                Cancel
              </button>
              <button className="modal__button" onClick={handleCreateList} disabled={listSaving}>
                {listSaving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="modal__backdrop" onClick={closeConfirmDialog}>
          <div className="modal modal--confirm" onClick={(event) => event.stopPropagation()}>
            <div className="modal__title">{confirmDialog.title}</div>
            {confirmDialog.body && (
              <p className="modal__body">
                {confirmDialog.body}
              </p>
            )}
            <div className="modal__actions">
              <button
                className="modal__button modal__button--ghost"
                onClick={closeConfirmDialog}
              >
                Cancel
              </button>
              <button className="modal__button modal__button--danger" onClick={handleConfirmAction}>
                {confirmDialog.confirmLabel || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showShortcuts && (
        <div className="modal__backdrop" onClick={() => setShowShortcuts(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal__title">Keyboard shortcuts</div>
            <div className="modal__item"><span>/</span> Focus search</div>
            <div className="modal__item"><span>↑ / ↓</span> Navigate notes</div>
            <div className="modal__item"><span>Esc</span> Close search / dialog</div>
            <div className="modal__item"><span>?</span> Toggle this panel</div>
          </div>
        </div>
      )}

      <header className="app-header">
        <div className="brand">
          <div className="brand__title">Docky</div>
          <div className="brand__subtitle">The Dock · dFree × Rocky</div>
        </div>

        <div className="app-header__actions">
          {user && (
            <>
              <button className="icon-button icon-button--primary" onClick={() => openEditor()} type="button">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 5a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H6a1 1 0 1 1 0-2h5V6a1 1 0 0 1 1-1Z" />
                </svg>
                <span>New</span>
              </button>
              <button className="icon-button" onClick={() => setShowListModal(true)} type="button">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 6.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm5.5-.5a1 1 0 1 1 0 2H20a1 1 0 1 1 0-2H9.5Zm-5.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm5.5-.5a1 1 0 1 1 0 2H20a1 1 0 1 1 0-2H9.5Zm-5.5 6a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm5.5-.5a1 1 0 1 1 0 2H20a1 1 0 1 1 0-2H9.5Z" />
                </svg>
                <span>New List</span>
              </button>
            </>
          )}
          <div className="auth">
            {user ? (
              <div className="auth__signed-in">
                <div className="auth__label">Signed in as</div>
                <div className="auth__value">{user.email}</div>
                <button className="auth__button auth__button--ghost" onClick={handleSignOut}>
                  Sign out
                </button>
              </div>
            ) : (
              <>
                <input
                  className="auth__input"
                  type="email"
                  placeholder="Email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                />
                <input
                  className="auth__input"
                  type="password"
                  placeholder="Password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                />
                <div className="auth__actions">
                  <button className="auth__button" onClick={handleSignIn}>Sign in</button>
                  <button className="auth__button auth__button--ghost" onClick={handleSignUp}>Sign up</button>
                </div>
                {authError && <div className="auth__error">{authError}</div>}
              </>
            )}
          </div>
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar__search search">
          <input
            ref={searchRef}
            className="search__input"
            type="search"
            placeholder="Search docs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="search__hint">
            Press / to search · Showing {filteredCount} of {totalCount} · Press ? for help
          </div>
        </div>
        <div className="doc-list">
          {grouped.notes.length > 0 && (
            <div className="doc-list__section">
              <button
                className="doc-list__heading doc-list__heading--toggle"
                onClick={() =>
                  setOpenSections((prev) => ({ ...prev, notes: !prev.notes }))
                }
                aria-expanded={openSections.notes}
              >
                <span>Notes</span>
                <span className={`doc-list__chevron ${openSections.notes ? 'is-open' : ''}`}>
                  ▾
                </span>
              </button>
              <div className="doc-list__content" ref={notesRef}>
                {grouped.notes.map((doc) => (
                  <button
                    key={doc.path}
                    className={`doc-list__item ${doc.path === activeDoc?.path ? 'is-active' : ''}`}
                    onClick={() => {
                      setActivePath(doc.path)
                      setActiveListId(null)
                    }}
                  >
                    <div className="doc-list__title">
                      {highlightText(doc.title, query)}
                    </div>
                    <div className="doc-list__meta">
                      {highlightText(doc.updated || doc.created || doc.slug, query)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredLists.length > 0 && (
            <div className="doc-list__section">
              <button
                className="doc-list__heading doc-list__heading--toggle"
                onClick={() =>
                  setOpenSections((prev) => ({ ...prev, lists: !prev.lists }))
                }
                aria-expanded={openSections.lists}
              >
                <span>Lists</span>
                <span className={`doc-list__chevron ${openSections.lists ? 'is-open' : ''}`}>
                  ▾
                </span>
              </button>
              <div className="doc-list__content" ref={listsRef}>
                {filteredLists.map((list) => {
                  const completed = list.items?.filter((item) => item.completed).length || 0
                  const total = list.items?.length || 0
                  return (
                    <button
                      key={list.id}
                      className={`doc-list__item ${list.id === activeListId ? 'is-active' : ''}`}
                      onClick={() => {
                        setActiveListId(list.id)
                        setActivePath(null)
                      }}
                    >
                      <div className="doc-list__title">
                        {highlightText(list.title, query)}
                      </div>
                      <div className="doc-list__meta">
                        {completed}/{total} done
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {grouped.journals.length > 0 && (
            <div className="doc-list__section">
              <button
                className="doc-list__heading doc-list__heading--toggle"
                onClick={() =>
                  setOpenSections((prev) => ({ ...prev, journal: !prev.journal }))
                }
                aria-expanded={openSections.journal}
              >
                <span>Journals</span>
                <span className={`doc-list__chevron ${openSections.journal ? 'is-open' : ''}`}>
                  ▾
                </span>
              </button>
              <div className="doc-list__content" ref={journalRef}>
                {grouped.journals.map((doc) => (
                  <button
                    key={doc.path}
                    className={`doc-list__item ${doc.path === activeDoc?.path ? 'is-active' : ''}`}
                    onClick={() => {
                      setActivePath(doc.path)
                      setActiveListId(null)
                    }}
                  >
                    <div className="doc-list__title">
                      {highlightText(doc.title, query)}
                    </div>
                    <div className="doc-list__meta">
                      {highlightText(doc.updated || doc.created || doc.slug, query)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {grouped.briefs.length > 0 && (
            <div className="doc-list__section">
              <button
                className="doc-list__heading doc-list__heading--toggle"
                onClick={() =>
                  setOpenSections((prev) => ({ ...prev, briefs: !prev.briefs }))
                }
                aria-expanded={openSections.briefs}
              >
                <span>Morning Briefs</span>
                <span className={`doc-list__chevron ${openSections.briefs ? 'is-open' : ''}`}>
                  ▾
                </span>
              </button>
              <div className="doc-list__content" ref={briefsRef}>
                {grouped.briefs.map((doc) => (
                  <button
                    key={doc.path}
                    className={`doc-list__item ${doc.path === activeDoc?.path ? 'is-active' : ''}`}
                    onClick={() => {
                      setActivePath(doc.path)
                      setActiveListId(null)
                    }}
                  >
                    <div className="doc-list__title">
                      {highlightText(doc.title, query)}
                    </div>
                    <div className="doc-list__meta">
                      {highlightText(doc.updated || doc.created || doc.slug, query)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredCount === 0 && (
            <div className="doc-list__empty">
              No docs match that search. Try clearing the filter or use fewer words.
            </div>
          )}
        </div>
      </aside>

      <main className="viewer">
        {activeList ? (
          <article className="list">
            <header className="list__header">
              <div className="list__title">
                {isEditingListTitle ? (
                  <div className="list__title-edit">
                    <input
                      className="list__title-input"
                      type="text"
                      value={listTitleDraft}
                      onChange={(event) => setListTitleDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          handleRenameList()
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          setIsEditingListTitle(false)
                          setListTitleDraft(activeList.title || '')
                        }
                      }}
                    />
                    <button
                      className="list__rename-save"
                      type="button"
                      onClick={handleRenameList}
                    >
                      Save
                    </button>
                    <button
                      className="list__rename-cancel"
                      type="button"
                      onClick={() => {
                        setIsEditingListTitle(false)
                        setListTitleDraft(activeList.title || '')
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="list__title-display">
                    <h1>{activeList.title}</h1>
                    <button
                      className="list__rename"
                      type="button"
                      onClick={() => {
                        setIsEditingListTitle(true)
                        setListTitleDraft(activeList.title || '')
                      }}
                    >
                      Rename
                    </button>
                  </div>
                )}
                <div className="list__meta">
                  {listStats?.completed ?? 0} of {listStats?.total ?? 0} done
                </div>
              </div>
              <button
                className="list__delete"
                type="button"
                onClick={() => openConfirmDialog({
                  title: 'Delete list?',
                  body: <>Delete <strong>{activeList.title}</strong>? This cannot be undone.</>,
                  onConfirm: handleDeleteList,
                })}
              >
                Delete list
              </button>
            </header>
            <div className="list__composer">
              <input
                className="list__input"
                type="text"
                placeholder="Add a new item..."
                value={newItemText}
                onChange={(event) => setNewItemText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleAddListItem()
                  }
                }}
              />
              <button
                className="list__add-button"
                type="button"
                onClick={handleAddListItem}
                disabled={!newItemText.trim()}
              >
                Add
              </button>
            </div>
            <ul className="list__items">
              {listItems.length > 0 && (
                <>
                  <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                    <SortableContext
                      items={incompleteItems.map((item) => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {incompleteItems.map((item) => (
                        <SortableListItem
                          key={item.id}
                          item={item}
                          onToggle={() => handleToggleListItem(activeList.id, item.id)}
                          onDelete={() => handleDeleteListItem(activeList.id, item.id)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                  {completedItems.map((item) => (
                    <li
                      key={item.id}
                      data-item-id={item.id}
                      className="list-item is-complete"
                    >
                      <span className="list-item__swipe" aria-hidden="true" />
                      <button
                        className="list-item__checkbox"
                        type="button"
                        onClick={() => handleToggleListItem(activeList.id, item.id)}
                        aria-pressed={item.completed}
                      >
                        <span className="list-item__check" />
                      </button>
                      <span className="list-item__text">{item.text}</span>
                      <button
                        className="list-item__delete"
                        type="button"
                        onClick={() => handleDeleteListItem(activeList.id, item.id)}
                        aria-label="Delete item"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </>
              )
              }
              {!listItems.length && (
                <li className="list-item list-item--empty">
                  No items yet. Add the first task above.
                </li>
              )}
            </ul>
          </article>
        ) : activeDoc ? (
          <article className="doc">
            <header className="doc__header">
              <h1>{briefGreeting || activeDoc.title}</h1>
              {activeDoc.isBrief && (
                <div className="doc__date">{activeDoc.title}</div>
              )}
              {!activeDoc.isBrief && activeDoc.created && (
                <div className="doc__date">{activeDoc.created}</div>
              )}
              {activeDoc.tags.length > 0 && (
                <div className="doc__tags">
                  {activeDoc.tags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              )}
              {user && activeDoc.source === 'firestore' && !activeDoc.isBrief && (
                <div className="doc__actions">
                  <button className="doc__button" onClick={() => openEditor(activeDoc)}>
                    Edit Note
                  </button>
                </div>
              )}
              {user && activeDoc.source === 'firestore' && activeDoc.isBrief && (
                <div className="doc__actions">
                  <button
                    className="doc__button"
                    onClick={() => openConfirmDialog({
                      title: 'Delete brief?',
                      body: <>Delete <strong>{activeDoc.title}</strong>? This cannot be undone.</>,
                      confirmLabel: 'Delete Brief',
                      onConfirm: () => handleDeleteBrief(activeDoc),
                    })}
                  >
                    Delete Brief
                  </button>
                </div>
              )}
            </header>
            <div
              className="doc__content"
              dangerouslySetInnerHTML={{ __html: activeDoc.html }}
            />
          </article>
        ) : (
          <div className="empty">
            Select a note from the left to get started.
          </div>
        )}
      </main>

      <aside className="rightbar">
        <div className="rightbar__content">
          {activeList ? (
            <div className="rightbar__section">
              <div className="rightbar__title">List Stats</div>
              <div className="rightbar__item">
                Items: {listStats?.total ?? 0}
              </div>
              <div className="rightbar__item">
                Completed: {listStats?.completed ?? 0}
              </div>
              <div className="rightbar__item">
                Last updated: {activeList.updated || activeList.created || '—'}
              </div>
            </div>
          ) : (
            <>
              <div className="rightbar__section">
                <div className="rightbar__title">Outline</div>
                {outline.length ? (
                  outline.map((item, index) => (
                    <button
                      key={`${item.text}-${index}`}
                      className={`rightbar__outline rightbar__item--indent-${item.level} ${
                        activeHeadingId === item.id ? 'is-active' : ''
                      }`}
                      onClick={() => {
                        const el = document.getElementById(item.id)
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }
                      }}
                    >
                      {item.text}
                    </button>
                  ))
                ) : (
                  <div className="rightbar__item">No headings found.</div>
                )}
              </div>
              <div className="rightbar__section">
                <div className="rightbar__title">Metadata</div>
                <div className="rightbar__item">Words: {docStats.words}</div>
                <div className="rightbar__item">Reading time: {docStats.minutes} min</div>
                <div className="rightbar__item">
                  Last updated: {activeDoc?.updated || activeDoc?.created || '—'}
                </div>
              </div>

              {briefCompare && (
                <div className="rightbar__section">
                  <div className="rightbar__title">Yesterday vs Today</div>
                  <div className="rightbar__item">
                    Today: {getBriefDateFromPath(briefCompare.today.path)}
                  </div>
                  <div className="rightbar__item">
                    Yesterday: {getBriefDateFromPath(briefCompare.yesterday.path)}
                  </div>
                  {['S&P 500', 'Nasdaq', 'Dow', 'BTC', 'ETH'].map((key) => (
                    <div key={key} className="rightbar__snippet">
                      <strong>{key}:</strong>{' '}
                      {briefCompare.yesterdayMarkets[key] || '—'} →{' '}
                      {briefCompare.todayMarkets[key] || '—'}
                    </div>
                  ))}
                </div>
              )}

              <div className="rightbar__section">
                <div className="rightbar__title">Related</div>
                {relatedDocs.length ? (
                  relatedDocs.map(({ doc, overlap }) => (
                    <div key={doc.path} className="rightbar__backlink">
                      <button
                        className="rightbar__link"
                        onClick={() => {
                          setActivePath(doc.path)
                          setActiveListId(null)
                        }}
                      >
                        {doc.title}
                      </button>
                      <div className="rightbar__snippet">
                        Tags: {overlap.join(', ')}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rightbar__item">No related docs.</div>
                )}
              </div>

              <div className="rightbar__section">
                <div className="rightbar__title">Backlinks</div>
                {backlinks.length ? (
                  backlinks.map((doc) => (
                    <div key={doc.path} className="rightbar__backlink">
                      <button
                        className="rightbar__link"
                        onClick={() => {
                          setActivePath(doc.path)
                          setActiveListId(null)
                        }}
                      >
                        {doc.title}
                      </button>
                      <div className="rightbar__snippet">
                        {snippetMap.get(doc.path)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rightbar__item">No backlinks found.</div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
