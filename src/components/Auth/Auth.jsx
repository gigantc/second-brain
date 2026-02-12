import { useEffect, useMemo, useRef, useState } from 'react'
import { auth, signOut } from '../../firebase'
import './Auth.scss'

const THEMES = [
  { id: 'green', label: 'Green', color: '#0a5c36' },
  { id: 'blue', label: 'Blue', color: '#3b82f6' },
  { id: 'pink', label: 'Pink', color: '#ec4899' },
  { id: 'red', label: 'Red', color: '#ef4444' },
  { id: 'gold', label: 'Gold', color: '#d4a017' },
  { id: 'teal', label: 'Teal', color: '#14b8a6' },
]

export default function Auth({ user, theme, onThemeChange, version }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!wrapRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const initials = useMemo(() => {
    const email = user?.email || ''
    return email.slice(0, 1).toUpperCase() || 'A'
  }, [user])

  if (!user) return null

  const handleSignOut = async () => {
    await signOut(auth)
    setOpen(false)
  }

  return (
    <div className="auth-menu" ref={wrapRef}>
      <button
        className="auth-menu__avatar"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile menu"
        onClick={() => setOpen((prev) => !prev)}
      >
        {initials}
      </button>

      {open && (
        <div className="auth-menu__dropdown" role="menu">
          <div className="auth-menu__email">{user.email}</div>

          <div className="auth-menu__section-title">Theme</div>
          <div className="auth-menu__themes">
            {THEMES.map((item) => (
              <button
                key={item.id}
                className={`auth-menu__theme ${theme === item.id ? 'is-active' : ''}`}
                type="button"
                onClick={() => onThemeChange?.(item.id)}
              >
                <span className="auth-menu__swatch" style={{ background: item.color }} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <button
            className="auth-menu__item"
            type="button"
            role="menuitem"
            onClick={handleSignOut}
          >
            Log out
          </button>

          {version && <div className="auth-menu__version">v{version}</div>}
        </div>
      )}
    </div>
  )
}
