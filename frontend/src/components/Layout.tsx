import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuthActions, useCurrentUser } from '../lib/auth'

export function Layout() {
  const { data: user } = useCurrentUser()
  const { logout } = useAuthActions()
  const navigate = useNavigate()

  async function onLogout() {
    await logout()
    navigate('/')
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Перейти до вмісту</a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="EquipRent — на головну">
            <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
              <rect x="3" y="6" width="26" height="22" rx="4" fill="#1D5AA6" />
              <rect x="3" y="6" width="26" height="7" rx="3" fill="#17232F" />
              <rect x="8" y="17" width="16" height="5" rx="1.5" fill="#F5C84B" />
            </svg>
            <span>EquipRent</span>
          </Link>
          <nav className="mainnav" aria-label="Основна навігація">
            <NavLink to="/" end>Каталог</NavLink>
            {user?.role === 'CLIENT' && <NavLink to="/my">Мої бронювання</NavLink>}
            {user?.role === 'MANAGER' && (
              <>
                <NavLink to="/manager" end>Заявки</NavLink>
                <NavLink to="/manager/equipment">Обладнання</NavLink>
                <NavLink to="/manager/reports">Завантаженість</NavLink>
              </>
            )}
          </nav>
          <div className="account">
            {user ? (
              <>
                <span className="account-name" title={user.email}>
                  {user.fullName}
                  <small>{user.role === 'MANAGER' ? 'менеджер' : 'клієнт'}</small>
                </span>
                <button type="button" className="btn btn-quiet" onClick={onLogout}>Вийти</button>
              </>
            ) : (
              <>
                <Link className="btn btn-quiet" to="/login">Увійти</Link>
                <Link className="btn btn-primary" to="/register">Зареєструватися</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="page" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="footer">
        <p>EquipRent — навчальна вебсистема оренди обладнання. Ціни, товари та клієнти в демонстрації вигадані.</p>
      </footer>
    </div>
  )
}
