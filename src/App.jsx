import { useEffect, useMemo, useRef, useState } from 'react'
import matter from 'gray-matter'
import { marked } from 'marked'
import './App.scss'

const docModules = import.meta.glob('../docs/**/*.md', { as: 'raw', eager: true })

function buildDocs(modules) {
  return Object.entries(modules).map(([path, raw]) => {
    const { data, content } = matter(raw)
    const slug = path
      .replace('../docs/', '')
      .replace(/\.md$/, '')
      .replace(/\//g, ' / ')
    const title = data?.title || slug
    const created = data?.created || null
    const isJournal = path.includes('/docs/journal/')

    return {
      path,
      slug,
      title,
      created,
      content,
      html: marked.parse(content),
      tags: Array.isArray(data?.tags) ? data.tags : [],
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

  useEffect(() => {
    if (filtered.length && !filtered.find((doc) => doc.path === activePath)) {
      setActivePath(filtered[0].path)
    }
  }, [filtered, activePath])

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
        searchRef.current?.blur()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [filtered, activePath])

  const grouped = useMemo(() => {
    const journals = filtered.filter((doc) => doc.isJournal)
    const notes = filtered.filter((doc) => !doc.isJournal)
    return { journals, notes }
  }, [filtered])

  return (
    <div className="app">
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
          <div className="search__hint">Press / to search</div>
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
                  <div className="doc-list__title">{doc.title}</div>
                  <div className="doc-list__meta">
                    {doc.created ? doc.created : doc.slug}
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
                  <div className="doc-list__title">{doc.title}</div>
                  <div className="doc-list__meta">
                    {doc.created ? doc.created : doc.slug}
                  </div>
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="doc-list__empty">No docs match that search.</div>
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
          <div className="empty">No document selected.</div>
        )}
      </main>
    </div>
  )
}
