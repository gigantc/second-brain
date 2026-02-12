import Auth from '../Auth/Auth'
import './AppHeader.scss'

export default function AppHeader({
  user,
  theme,
  onThemeChange,
  version,
}) {
  return (
    <header className="app-header">
      <div className="brand">
        <div>
          <div className="brand__title">The Dock</div>
          <div className="brand__subtitle">dFree × Apollo</div>
        </div>
      </div>

      <div className="app-header__actions">
        <Auth user={user} theme={theme} onThemeChange={onThemeChange} version={version} />
      </div>
    </header>
  )
}
