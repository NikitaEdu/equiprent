import type { ReactNode } from 'react'
import { ApiError, type BookingStatus, statusLabel } from '../lib/api'

export function Loading({ label = 'Завантаження…' }: { label?: string }) {
  return <p className="loading" role="status" aria-live="polite"><span className="spinner" aria-hidden="true" />{label}</p>
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError ? error.message : 'Сталася неочікувана помилка'
  return (
    <div className="notice notice-error" role="alert">
      <p>{message}</p>
      {onRetry && <button type="button" className="btn btn-quiet" onClick={onRetry}>Повторити</button>}
    </div>
  )
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'success' | 'warning'; children: ReactNode }) {
  return <div className={`notice notice-${kind}`} role={kind === 'success' ? 'status' : undefined}>{children}</div>
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children}
    </div>
  )
}

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`status status-${status.toLowerCase()}`}>{statusLabel[status]}</span>
}

export function InventoryTag({ value }: { value: string }) {
  return <span className="invtag" title="Інвентарний номер екземпляра">{value}</span>
}

export function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <nav className="pager" aria-label="Сторінки">
      <button type="button" className="btn btn-quiet" disabled={page === 0} onClick={() => onChange(page - 1)}>
        Попередня
      </button>
      <span aria-current="page">Сторінка {page + 1} з {totalPages}</span>
      <button type="button" className="btn btn-quiet" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>
        Наступна
      </button>
    </nav>
  )
}
