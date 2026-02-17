import { forwardRef, useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { BookOpen, FilePlus2, ListTodo, PanelLeft, PanelLeftClose } from 'lucide-react'
import SearchBar from '../SearchBar/SearchBar'
import DocList from '../DocList/DocList'
import './Sidebar.scss'

const Sidebar = forwardRef(function Sidebar({
  query,
  onQueryChange,
  filteredCount,
  totalCount,
  grouped,
  filteredLists,
  openSections,
  onToggleSection,
  activeDoc,
  activeListId,
  onSelectDoc,
  onSelectList,
  sidebarOpen,
  onToggleSidebar,
  onNewNote,
  onNewList,
  onNewJournal,
}, searchRef) {
  const contentRef = useRef(null)
  const actionsRef = useRef(null)

  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content) return

    gsap.killTweensOf(content)

    if (sidebarOpen) {
      // Opening: delay content fade-in until sidebar has started expanding
      gsap.fromTo(content,
        { autoAlpha: 0, x: -8 },
        { autoAlpha: 1, x: 0, duration: 0.25, delay: 0.1, ease: 'power2.out', overwrite: 'auto' },
      )
    } else {
      // Closing: fade content out quickly before sidebar collapses
      gsap.to(content, {
        autoAlpha: 0, x: -8, duration: 0.15, ease: 'power2.in', overwrite: 'auto',
      })
    }
  }, [sidebarOpen])

  useLayoutEffect(() => {
    const actions = actionsRef.current
    if (!actions) return
    const buttons = actions.querySelectorAll('.sidebar__action-btn')

    gsap.killTweensOf(buttons)

    if (sidebarOpen) {
      gsap.fromTo(buttons,
        { scale: 0.92, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.2, delay: 0.12, ease: 'power2.out', stagger: 0.03, overwrite: 'auto' },
      )
    } else {
      // Buttons stay visible in collapsed state (stacked vertically) — just reset to full opacity
      gsap.set(buttons, { scale: 1, opacity: 1, overwrite: 'auto' })
    }
  }, [sidebarOpen])

  return (
    <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : 'sidebar--collapsed'}`}>
      <div className="sidebar__top">
        <div
          className={`sidebar__actions ${sidebarOpen ? 'sidebar__actions--row' : 'sidebar__actions--col'}`}
          ref={actionsRef}
        >
          <button
            className="sidebar__action-btn sidebar__action-btn--primary tooltip-trigger"
            type="button"
            onClick={onNewNote}
            aria-label="New note"
            data-tooltip="New note"
          >
            <FilePlus2 aria-hidden="true" size={16} strokeWidth={2} />
          </button>
          <button
            className="sidebar__action-btn tooltip-trigger"
            type="button"
            onClick={onNewList}
            aria-label="New list"
            data-tooltip="New list"
          >
            <ListTodo aria-hidden="true" size={16} strokeWidth={2} />
          </button>

          <button
            className="sidebar__action-btn tooltip-trigger"
            type="button"
            onClick={onNewJournal}
            aria-label="New journal"
            data-tooltip="New journal"
          >
            <BookOpen aria-hidden="true" size={16} strokeWidth={2} />
          </button>
        </div>

        <button
          className="sidebar__toggle tooltip-trigger"
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          data-tooltip={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <PanelLeftClose className={`sidebar__toggle-icon ${sidebarOpen ? 'is-visible' : ''}`} aria-hidden="true" size={16} strokeWidth={2} />
          <PanelLeft className={`sidebar__toggle-icon ${!sidebarOpen ? 'is-visible' : ''}`} aria-hidden="true" size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="sidebar__content" ref={contentRef}>
        <SearchBar
          ref={searchRef}
          query={query}
          onQueryChange={onQueryChange}
          filteredCount={filteredCount}
          totalCount={totalCount}
        />
        <DocList
          grouped={grouped}
          filteredLists={filteredLists}
          filteredCount={filteredCount}
          openSections={openSections}
          onToggleSection={onToggleSection}
          activeDoc={activeDoc}
          activeListId={activeListId}
          query={query}
          onSelectDoc={onSelectDoc}
          onSelectList={onSelectList}
        />
      </div>
    </aside>
  )
})

export default Sidebar
