import { createBrowserRouter } from 'react-router'
import { Layout } from './components/Layout'
import { RequireRole } from './components/RequireRole'
import { CatalogPage } from './pages/CatalogPage'
import { EquipmentPage } from './pages/EquipmentPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { MyBookingsPage } from './pages/MyBookingsPage'
import { BookingPage } from './pages/BookingPage'
import { lazy, Suspense, type ReactNode } from 'react'
import { Loading } from './components/States'

// Розділи менеджера завантажуються окремими частинами лише тоді, коли потрібні (DEF-12)
const ManagerBookingsPage = lazy(() => import('./pages/ManagerBookingsPage').then((m) => ({ default: m.ManagerBookingsPage })))
const ManagerEquipmentPage = lazy(() => import('./pages/ManagerEquipmentPage').then((m) => ({ default: m.ManagerEquipmentPage })))
const ManagerReportsPage = lazy(() => import('./pages/ManagerReportsPage').then((m) => ({ default: m.ManagerReportsPage })))
const lazyPage = (node: ReactNode) => <Suspense fallback={<Loading />}>{node}</Suspense>
import { NotFoundPage } from './pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <CatalogPage /> },
      { path: '/equipment/:id', element: <EquipmentPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/my', element: <RequireRole role="CLIENT"><MyBookingsPage /></RequireRole> },
      { path: '/my/:id', element: <RequireRole><BookingPage /></RequireRole> },
      { path: '/manager', element: <RequireRole role="MANAGER">{lazyPage(<ManagerBookingsPage />)}</RequireRole> },
      { path: '/manager/bookings/:id', element: <RequireRole role="MANAGER"><BookingPage /></RequireRole> },
      { path: '/manager/equipment', element: <RequireRole role="MANAGER">{lazyPage(<ManagerEquipmentPage />)}</RequireRole> },
      { path: '/manager/reports', element: <RequireRole role="MANAGER">{lazyPage(<ManagerReportsPage />)}</RequireRole> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
