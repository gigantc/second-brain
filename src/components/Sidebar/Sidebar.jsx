import { forwardRef, useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { FilePlus2, ListTodo, PanelLeft, PanelLeftClose } from 'lucide-react'
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
}, searchRef) {
  const contentRef = useRef(null)
  const actionsRef = useRef(null)

  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content) return

    gsap.killTweensOf(content)

    gsap.to(content, {
      autoAlpha: sidebarOpen ? 1 : 0,
      x: sidebarOpen ? 0 : -12,
      duration: sidebarOpen ? 0.34 : 0.26,
      ease: 'power3.out',
      overwrite: 'auto',
    })
  }, [sidebarOpen])

  useLayoutEffect(() => {
    const actions = actionsRef.current
    if (!actions) return
    const buttons = actions.querySelectorAll('.sidebar__action-btn')

    gsap.killTweensOf(buttons)
    gsap.fromTo(
      buttons,
      {
        x: sidebarOpen ? -8 : 0,
        y: sidebarOpen ? 0 : -6,
        opacity: 0.78,
      },
      {
        x: 0,
        y: 0,
        opacity: 1,
        duration: 0.3,
        ease: 'power3.out',
        stagger: 0.025,
        overwrite: 'auto',
      },
    )
  }, [sidebarOpen])

  return (
    <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : 'sidebar--collapsed'}`}>
      <div className="sidebar__top">
        <div
          className={`sidebar__actions ${sidebarOpen ? 'sidebar__actions--row' : 'sidebar__actions--col'}`}
          ref={actionsRef}
        >
          <button
            className="sidebar__action-btn sidebar__action-btn--primary"
            type="button"
            onClick={onNewNote}
            aria-label="New note"
            title="New note"
          >
            <FilePlus2 aria-hidden="true" size={16} strokeWidth={2} />
          </button>
          <button
            className="sidebar__action-btn"
            type="button"
            onClick={onNewList}
            aria-label="New list"
            title="New list"
          >
            <ListTodo aria-hidden="true" size={16} strokeWidth={2} />
          </button>
        </div>

        <button
          className="sidebar__toggle"
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen
            ? <PanelLeftClose aria-hidden="true" size={16} strokeWidth={2} />
            : <PanelLeft aria-hidden="true" size={16} strokeWidth={2} />}
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
