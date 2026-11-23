import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuthActions } from '../lib/auth'
import { ApiError } from '../lib/api'
import { ErrorBox } from '../components/States'

export function LoginPage() {
  const { login } = useAuthActions()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = await login(email.trim(), password)
      navigate(from ?? (user.role === 'MANAGER' ? '/manager' : '/'), { replace: true })
    } catch (err) {
      setError(err)
      // Пароль очищуємо, адресу залишаємо — менше повторного введення
      if (err instanceof ApiError && err.status === 401) setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="auth">
      <h1>Вхід</h1>
      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Електронна пошта</label>
          <input id="email" type="email" autoComplete="username" required value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input id="password" type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error !== null && <ErrorBox error={error} />}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !email || !password}>
          {busy ? 'Входимо…' : 'Увійти'}
        </button>
      </form>
      <p className="auth-alt">Ще немає облікового запису? <Link to="/register">Зареєструйтеся</Link></p>
      <details className="demo-accounts">
        <summary>Демонстраційні облікові записи</summary>
        <p>Клієнт: <code>olena@equiprent.test</code> / <code>Client-Demo-2026!</code></p>
        <p>Менеджер: <code>manager@equiprent.test</code> / <code>Manager-Demo-2026!</code></p>
      </details>
    </section>
  )
}
