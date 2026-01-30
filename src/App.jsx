import { useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import './App.scss'

const docModules = import.meta.glob('../docs/**/*.md', { as: 'raw', eager: true })

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
    }
  })
}

function sortDocs(docs) {
  return [...docs].sort((a, b) => {
    if (a.created && b.created) return String(b.created).localeCompare(String(a.created))
    if (a.created) return -1
    if (b.created) return 1
    return a.title.localeCompare(b.title)
  })
}

export default function App() {
  const docs = useMemo(() => sortDocs(buildDocs(docModules)), [])
  const [query, setQuery] = useState('')
  const [activePath, setActivePath] = useState(docs[0]?.path)
  const [activeHeadingId, setActiveHeadingId] = useState(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const searchRef = useRef(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return docs
    return docs.filter((doc) => {
      const haystack = `${doc.title} ${doc.slug} ${doc.content}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [docs, query])

  const activeDoc = filtered.find((doc) => doc.path === activePath) || filtered[0]

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
    if (filtered.length && !filtered.find((doc) => doc.path === activePath)) {
      setActivePath(filtered[0].path)
    }
  }, [filtered, activePath])

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
        searchRef.current?.focus()
        return
      }

      if (!filtered.length) return

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
  }, [filtered, activePath, showShortcuts])

  const grouped = useMemo(() => {
    const journals = filtered.filter((doc) => doc.isJournal)
    const notes = filtered.filter((doc) => !doc.isJournal)
    return { journals, notes }
  }, [filtered])

  return (
    <div className="app">
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

      <aside className="sidebar">
        <div className="brand">
          <div className="brand__title">Second Brain</div>
          <div className="brand__subtitle">dFree × Rocky</div>
        </div>

        <div className="search">
          <input
            ref={searchRef}
            type="search"
            placeholder="Search docs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="search__hint">
            Press / to search · Showing {filtered.length} of {docs.length} · Press ? for help
          </div>
        </div>

        <div className="doc-list">
          {grouped.notes.length > 0 && (
            <div className="doc-list__section">
              <div className="doc-list__heading">Notes</div>
              {grouped.notes.map((doc) => (
                <button
                  key={doc.path}
                  className={`doc-list__item ${doc.path === activeDoc?.path ? 'is-active' : ''}`}
                  onClick={() => setActivePath(doc.path)}
                >
                  <div className="doc-list__title">
                    {highlightText(doc.title, query)}
                  </div>
                  <div className="doc-list__meta">
                    {highlightText(doc.created ? doc.created : doc.slug, query)}
                  </div>
                </button>
              ))}
            </div>
          )}

          {grouped.journals.length > 0 && (
            <div className="doc-list__section">
              <div className="doc-list__heading">Journal</div>
              {grouped.journals.map((doc) => (
                <button
                  key={doc.path}
                  className={`doc-list__item ${doc.path === activeDoc?.path ? 'is-active' : ''}`}
                  onClick={() => setActivePath(doc.path)}
                >
                  <div className="doc-list__title">
                    {highlightText(doc.title, query)}
                  </div>
                  <div className="doc-list__meta">
                    {highlightText(doc.created ? doc.created : doc.slug, query)}
                  </div>
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="doc-list__empty">
              No docs match that search. Try clearing the filter or use fewer words.
            </div>
          )}
        </div>
      </aside>

      <main className="viewer">
        {activeDoc ? (
          <article className="doc">
            <header className="doc__header">
              <h1>{activeDoc.title}</h1>
              {activeDoc.created && <div className="doc__date">{activeDoc.created}</div>}
              {activeDoc.tags.length > 0 && (
                <div className="doc__tags">
                  {activeDoc.tags.map((tag) => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
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
                    onClick={() => setActivePath(doc.path)}
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
                    onClick={() => setActivePath(doc.path)}
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
        </div>
      </aside>
    </div>
  )
}
