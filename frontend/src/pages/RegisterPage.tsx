import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, ApiError, type User } from '../lib/api'
import { useAuthActions } from '../lib/auth'
import { ErrorBox } from '../components/States'

const MIN_PASSWORD = 15

export function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuthActions()
  const [form, setForm] = useState({ email: '', fullName: '', phone: '', password: '' })
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const fieldError = (f: string) => (error instanceof ApiError ? error.fieldError(f) : undefined)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.post<User>('/api/auth/register', { ...form, email: form.email.trim() })
      await login(form.email.trim(), form.password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const passwordLen = [...form.password].length

  return (
    <section className="auth">
      <h1>Реєстрація клієнта</h1>
      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="fullName">Ім’я та прізвище</label>
          <input id="fullName" autoComplete="name" value={form.fullName} onChange={set('fullName')}
            aria-invalid={!!fieldError('fullName')} aria-describedby={fieldError('fullName') ? 'fullName-err' : undefined} maxLength={120} />
          {fieldError('fullName') && <p id="fullName-err" className="field-error">{fieldError('fullName')}</p>}
        </div>
        <div className="field">
          <label htmlFor="email">Електронна пошта</label>
          <input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')}
            aria-invalid={!!fieldError('email')} aria-describedby={fieldError('email') ? 'email-err' : undefined} maxLength={254} />
          {fieldError('email') && <p id="email-err" className="field-error">{fieldError('email')}</p>}
        </div>
        <div className="field">
          <label htmlFor="phone">Телефон <span className="optional">(необов’язково)</span></label>
          <input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')}
            aria-invalid={!!fieldError('phone')} aria-describedby={fieldError('phone') ? 'phone-err' : undefined} maxLength={20} />
          {fieldError('phone') && <p id="phone-err" className="field-error">{fieldError('phone')}</p>}
        </div>
        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input id="password" type="password" autoComplete="new-password" value={form.password}
            onChange={set('password')} aria-describedby="password-hint" maxLength={128} />
          <p id="password-hint" className="hint">
            Щонайменше {MIN_PASSWORD} символів. Зручно взяти кілька слів через пробіл.
            {passwordLen > 0 && passwordLen < MIN_PASSWORD && ` Ще ${MIN_PASSWORD - passwordLen}.`}
          </p>
        </div>
        {error !== null && <ErrorBox error={error} />}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Створюємо обліковий запис…' : 'Зареєструватися'}
        </button>
      </form>
      <p className="auth-alt">Уже є обліковий запис? <Link to="/login">Увійдіть</Link></p>
    </section>
  )
}
