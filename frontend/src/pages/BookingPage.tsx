import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, statusLabel, uah, type Booking } from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import { addDays, compareDates, days, formatRange, formatShort, todayKyiv } from '../lib/dates'
import { ErrorBox, InventoryTag, Loading, Notice, StatusBadge } from '../components/States'

const eventLabel: Record<string, string> = {
  CREATED: 'Заявку створено', CONFIRMED: 'Підтверджено', REJECTED: 'Відхилено', CANCELLED: 'Скасовано',
  ISSUED: 'Видано клієнту', RETURNED: 'Повернено', EXTENDED: 'Продовжено',
}

const timeFmt = new Intl.DateTimeFormat('uk-UA', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Kyiv',
})

/** Сторінка бронювання — спільна для клієнта (власні) та менеджера (усі). */
export function BookingPage() {
  const { id } = useParams()
  const location = useLocation()
  const justCreated = (location.state as { created?: boolean } | null)?.created
  const { data: user } = useCurrentUser()
  const isManager = user?.role === 'MANAGER'
  const qc = useQueryClient()
  const today = todayKyiv()

  const q = useQuery({ queryKey: ['bookings', 'one', id], queryFn: () => api.get<Booking>(`/api/bookings/${id}`) })
  const [notice, setNotice] = useState<string | null>(null)

  const act = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: unknown; done: string }) => api.post<Booking>(path, body),
    onSuccess: (b, vars) => {
      qc.setQueryData(['bookings', 'one', id], b)
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['availability'] })
      setNotice(vars.done)
    },
    onError: (err) => {
      setNotice(null)
      if (err instanceof ApiError && err.code === 'CONCURRENT_MODIFICATION') q.refetch()
    },
  })

  if (q.isLoading) return <Loading />
  if (q.isError) {
    return q.error instanceof ApiError && q.error.status === 404
      ? <section className="state"><h1>Бронювання не знайдено</h1>
        <p>Перевірте номер. Чужі бронювання недоступні.</p>
        <Link className="btn btn-quiet" to={isManager ? '/manager' : '/my'}>До списку</Link></section>
      : <ErrorBox error={q.error} onRetry={() => q.refetch()} />
  }
  const b = q.data!
  const base = isManager ? `/api/manager/bookings/${b.id}` : `/api/bookings/${b.id}`
  const run = (suffix: string, done: string, body?: unknown) => act.mutate({ path: base + suffix, body, done })

  const clientCanCancel = !isManager && (b.status === 'PENDING' || b.status === 'CONFIRMED')
    && compareDates(today, b.startDate) < 0
  const canExtend = b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'ISSUED'
  const canIssue = isManager && b.status === 'CONFIRMED'
    && compareDates(today, b.startDate) >= 0 && compareDates(today, b.endDate) <= 0
  const overdue = b.status === 'ISSUED' && compareDates(today, b.endDate) > 0

  return (
    <article className="booking-detail">
      <nav className="crumbs" aria-label="Шлях">
        <Link to={isManager ? '/manager' : '/my'}>{isManager ? 'Заявки' : 'Мої бронювання'}</Link>
        <span aria-hidden="true">/</span><span>{b.number}</span>
      </nav>
      {justCreated && !notice && (
        <Notice kind="success">Заявку {b.number} надіслано. Менеджер підтвердить її найближчим часом — стан
          зміниться на «{statusLabel.CONFIRMED}».</Notice>
      )}
      {notice && <Notice kind="success">{notice}</Notice>}
      {act.isError && <ErrorBox error={act.error} />}

      <header className="detail-head">
        <div>
          <h1>{b.equipmentName}</h1>
          <p className="detail-sub">{b.number} · екземпляр <InventoryTag value={b.inventoryNumber} /></p>
        </div>
        <StatusBadge status={b.status} />
      </header>

      {overdue && <Notice kind="warning">Строк оренди минув {formatShort(b.endDate)}. За кожну добу
        запізнення нараховується додаткова плата.</Notice>}
      {b.status === 'REJECTED' && b.rejectReason && <Notice kind="warning">Причина відхилення: {b.rejectReason}</Notice>}

      <div className="detail-grid">
        <section className="panel">
          <h2 className="panel-title">Умови</h2>
          <dl className="facts">
            <div><dt>Період</dt><dd>{formatRange(b.startDate, b.endDate)} ({days(b.rentalDays)})</dd></div>
            {b.bufferDays > 0 && <div><dt>Технічна перерва</dt><dd>{days(b.bufferDays)} після повернення</dd></div>}
            <div><dt>Ставка</dt><dd>{uah(b.dailyRate)} за добу</dd></div>
            <div><dt>Вартість оренди</dt><dd>{uah(b.rentalCost)}</dd></div>
            <div><dt>Застава</dt><dd>{uah(b.deposit)}</dd></div>
            {Number(b.lateFee) > 0 && <div><dt>Плата за запізнення</dt><dd>{uah(b.lateFee)}</dd></div>}
            {b.actualReturnDate && <div><dt>Повернено</dt><dd>{formatShort(b.actualReturnDate)}</dd></div>}
            {b.comment && <div><dt>Коментар клієнта</dt><dd>{b.comment}</dd></div>}
            {isManager && b.clientName && <div><dt>Клієнт</dt><dd>{b.clientName}, {b.clientEmail}</dd></div>}
          </dl>
        </section>

        <section className="panel">
          <h2 className="panel-title">Дії</h2>
          <div className="actions">
            {isManager && b.status === 'PENDING' && (
              <button type="button" className="btn btn-primary" disabled={act.isPending}
                onClick={() => run('/confirm', 'Бронювання підтверджено')}>Підтвердити</button>
            )}
            {canIssue && (
              <button type="button" className="btn btn-primary" disabled={act.isPending}
                onClick={() => run('/issue', 'Видачу зафіксовано')}>Видати клієнту</button>
            )}
            {isManager && b.status === 'CONFIRMED' && !canIssue && (
              <p className="hint">Видача можлива з {formatShort(b.startDate)} до {formatShort(b.endDate)}.</p>
            )}
            {isManager && b.status === 'ISSUED' && (
              <button type="button" className="btn btn-primary" disabled={act.isPending}
                onClick={() => run('/return', 'Повернення зафіксовано', {})}>Прийняти повернення сьогодні</button>
            )}
            {(clientCanCancel || (isManager && (b.status === 'PENDING' || b.status === 'CONFIRMED'))) && (
              <button type="button" className="btn btn-danger" disabled={act.isPending}
                onClick={() => { if (window.confirm('Скасувати бронювання? Дати стануть доступні іншим клієнтам.')) run('/cancel', 'Бронювання скасовано') }}>
                Скасувати бронювання</button>
            )}
            {!isManager && (b.status === 'PENDING' || b.status === 'CONFIRMED') && !clientCanCancel && (
              <p className="hint">Скасування можливе не пізніше ніж за день до початку оренди.</p>
            )}
          </div>
          {isManager && b.status === 'PENDING' && <RejectForm busy={act.isPending}
            onReject={(reason) => run('/reject', 'Заявку відхилено', { reason })} />}
          {canExtend && <ExtendForm booking={b} busy={act.isPending}
            onExtend={(newEndDate) => act.mutate({ path: `/api/bookings/${b.id}/extend`, body: { newEndDate }, done: 'Оренду продовжено' })} />}
        </section>
      </div>

      <section className="panel">
        <h2 className="panel-title">Історія</h2>
        <ol className="history">
          {b.events.map((e, i) => (
            <li key={i}>
              <time dateTime={e.occurredAt}>{timeFmt.format(new Date(e.occurredAt))}</time>
              <span><b>{eventLabel[e.type] ?? e.type}</b> — {e.actor}{e.note ? `. ${e.note}` : ''}</span>
            </li>
          ))}
        </ol>
      </section>
    </article>
  )
}

function RejectForm({ onReject, busy }: { onReject: (reason: string) => void; busy: boolean }) {
  const [reason, setReason] = useState('')
  const short = reason.trim().length < 5
  return (
    <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (!short) onReject(reason.trim()) }}>
      <div className="field field-grow">
        <label htmlFor="reason">Причина відхилення</label>
        <input id="reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)}
          aria-describedby="reason-hint" />
        <p id="reason-hint" className="hint">Клієнт побачить цей текст. Щонайменше 5 символів.</p>
      </div>
      <button type="submit" className="btn btn-quiet" disabled={busy || short}>Відхилити</button>
    </form>
  )
}

function ExtendForm({ booking, onExtend, busy }: { booking: Booking; onExtend: (d: string) => void; busy: boolean }) {
  const min = addDays(booking.endDate, 1)
  const [value, setValue] = useState(min)
  return (
    <form className="inline-form" onSubmit={(e) => { e.preventDefault(); onExtend(value) }}>
      <div className="field">
        <label htmlFor="newEnd">Продовжити до</label>
        <input id="newEnd" type="date" min={min} value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <button type="submit" className="btn btn-quiet" disabled={busy || !value}>Продовжити оренду</button>
    </form>
  )
}
