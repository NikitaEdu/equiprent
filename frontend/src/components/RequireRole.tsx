import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useCurrentUser } from '../lib/auth'
import type { Role } from '../lib/api'
import { Loading } from './States'

/**
 * Обмежує маршрути інтерфейсу за роллю. Це зручність для користувача, а не захист:
 * сервер незалежно перевіряє права для кожного запиту.
 */
export function RequireRole({ role, children }: { role?: Role; children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser()
  const location = useLocation()
  if (isLoading) return <Loading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (role && user.role !== role) {
    return (
      <section className="state state-denied" role="alert">
        <h1>Немає доступу</h1>
        <p>Ця сторінка призначена для ролі «{role === 'MANAGER' ? 'менеджер' : 'клієнт'}».
          Увійдіть під відповідним обліковим записом.</p>
      </section>
    )
  }
  return <>{children}</>
}
