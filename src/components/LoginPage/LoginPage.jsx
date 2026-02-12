import { useState } from 'react'
import { auth, signInWithEmailAndPassword } from '../../firebase'
import './LoginPage.scss'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSignIn = async () => {
    setError('')
    setSubmitting(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (authError) {
      setError(authError.message || 'Authentication failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="Login">
        <div className="login-card__brand">The Dock</div>
        <div className="login-card__subtitle">dFree × Apollo</div>

        <div className="login-card__form">
          <input
            className="login-card__input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
          <input
            className="login-card__input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />

          <div className="login-card__actions">
            <button
              className="login-card__button"
              onClick={handleSignIn}
              disabled={submitting}
              type="button"
            >
              Sign in
            </button>
          </div>

          {error && <div className="login-card__error">{error}</div>}
        </div>
      </section>
    </main>
  )
}
