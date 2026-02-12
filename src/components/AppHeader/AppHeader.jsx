import { FilePlus2, ListTodo, PanelLeft, PanelLeftClose } from 'lucide-react'
import Auth from '../Auth/Auth'
import './AppHeader.scss'

export default function AppHeader({
  user,
  onNewNote,
  onNewList,
  theme,
  onThemeChange,
  version,
  sidebarOpen,
  onToggleSidebar,
}) {
  return (
    <header className="app-header">
      <div className="brand">
        <button
          className="icon-button icon-button--nav"
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen
            ? <PanelLeftClose aria-hidden="true" strokeWidth={2} size={16} />
            : <PanelLeft aria-hidden="true" strokeWidth={2} size={16} />}
        </button>
        <div>
          <div className="brand__title">The Dock</div>
          <div className="brand__subtitle">dFree × Apollo</div>
        </div>
      </div>

      <div className="app-header__actions">
        {user && (
          <>
            <button className="icon-button icon-button--primary" onClick={onNewNote} type="button">
              <FilePlus2 aria-hidden="true" strokeWidth={2} size={16} />
              <span>New</span>
            </button>
            <button className="icon-button" onClick={onNewList} type="button">
              <ListTodo aria-hidden="true" strokeWidth={2} size={16} />
              <span>New List</span>
            </button>
          </>
        )}
        <Auth user={user} theme={theme} onThemeChange={onThemeChange} version={version} />
      </div>
    </header>
  )
}
