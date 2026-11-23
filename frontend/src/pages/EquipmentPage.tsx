import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  api, ApiError, uah, type Availability, type Booking, type EquipmentDetails, type Quote,
} from '../lib/api'
import { useCurrentUser } from '../lib/auth'
import {
  addDays, addMonths, compareDates, days, endOfMonth, plural, formatMonth, formatRange, isIsoDate, rentalDays,
  startOfMonth, todayKyiv, type IsoDate,
} from '../lib/dates'
import { AvailabilityCalendar, rangeHasFullDay, type Selection } from '../components/AvailabilityCalendar'
import { CategoryArt } from '../components/CategoryArt'
import { ErrorBox, Loading, Notice } from '../components/States'

const MAX_ADVANCE_DAYS = 180

export function EquipmentPage() {
  const { id } = useParams()
  const today = todayKyiv()
  const maxDate = addDays(today, MAX_ADVANCE_DAYS)
  const [month, setMonth] = useState<IsoDate>(startOfMonth(today))
  const [sel, setSel] = useState<Selection>({ start: null, end: null })

  const details = useQuery({
    queryKey: ['equipment', id],
    queryFn: () => api.get<EquipmentDetails>(`/api/equipment/${id}`),
  })
  const calendar = useQuery({
    queryKey: ['availability', id, month],
    queryFn: () => api.get<Availability>(`/api/equipment/${id}/availability`, { from: month, to: endOfMonth(month) }),
    // Паралельно з карткою, а не після неї: прибирає послідовне очікування двох запитів (LCP)
    enabled: !!id,
  })

  function pick(date: IsoDate) {
    if (!sel.start || sel.end || compareDates(date, sel.start) < 0) {
      setSel({ start: date, end: null })
    } else {
      setSel({ start: sel.start, end: date })
    }
  }

  if (details.isLoading) return <EquipmentSkeleton />
  if (details.isError) {
    return details.error instanceof ApiError && details.error.status === 404
      ? <section className="state"><h1>Обладнання не знайдено</h1><p>Можливо, позицію знято з каталогу.</p>
        <Link to="/" className="btn btn-quiet">До каталогу</Link></section>
      : <ErrorBox error={details.error} onRetry={() => details.refetch()} />
  }
  const e = details.data!
  const canPrev = compareDates(month, startOfMonth(today)) > 0
  const canNext = compareDates(addMonths(month, 1), maxDate) <= 0

  return (
    <article className="equipment">
      <nav className="crumbs" aria-label="Шлях">
        <Link to="/">Каталог</Link><span aria-hidden="true">/</span>
        <Link to={`/?category=${e.category.id}`}>{e.category.name}</Link>
      </nav>

      <header className="equipment-head">
        <span className="equipment-art"><CategoryArt slug={e.category.slug} label={e.category.name} /></span>
        <div>
          <h1>{e.name}</h1>
          {e.brand && <p className="brand-line">{e.brand}</p>}
          <p className="equipment-desc">{e.description}</p>
        </div>
      </header>

      <div className="equipment-body">
        <section className="panel calendar-panel" aria-labelledby="cal-title">
          <div className="calendar-head">
            <h2 id="cal-title">{formatMonth(month)}</h2>
            <div className="calendar-nav">
              <button type="button" className="btn btn-quiet" disabled={!canPrev}
                onClick={() => setMonth(addMonths(month, -1))} aria-label="Попередній місяць">‹</button>
              <button type="button" className="btn btn-quiet" disabled={!canNext}
                onClick={() => setMonth(addMonths(month, 1))} aria-label="Наступний місяць">›</button>
            </div>
          </div>
          {calendar.isLoading && <CalendarSkeleton />}
          {calendar.isError && <ErrorBox error={calendar.error} onRetry={() => calendar.refetch()} />}
          {calendar.data && (
            <>
              <AvailabilityCalendar month={month} days={calendar.data.days} total={calendar.data.totalUnits}
                today={today} maxDate={maxDate} selection={sel} onPick={pick} />
              <ul className="legend">
                <li><span className="sw sw-full" />усі екземпляри вільні</li>
                <li><span className="sw sw-partial" />частина зайнята</li>
                <li><span className="sw sw-none" />вільних немає</li>
              </ul>
              {e.serviceBufferDays > 0 && (
                <p className="hint">Після кожної оренди екземпляр ще {e.serviceBufferDays}{' '}
                  {e.serviceBufferDays === 1 ? 'день' : 'дні'} проходить перевірку — ці дні в календарі теж зайняті.</p>
              )}
            </>
          )}
        </section>

        <aside className="booking-side">
          <BookingPanel equipment={e} selection={sel} setSelection={setSel} today={today} maxDate={maxDate}
            daysData={calendar.data?.days ?? []} />
          <section className="panel">
            <h2 className="panel-title">Тариф</h2>
            <table className="tariff-table">
              <caption className="sr-only">Ставка за добу залежно від тривалості оренди</caption>
              <thead><tr><th scope="col">Тривалість</th><th scope="col">Ставка за добу</th></tr></thead>
              <tbody>
                {e.tariffs.map((t, i) => {
                  const next = e.tariffs[i + 1]
                  const upper = next ? next.minDays - 1 : 0
                  const label = !next ? `від ${t.minDays} ${t.minDays === 1 ? 'доби' : 'діб'}`
                    : upper === t.minDays ? days(upper)
                      : `${t.minDays}–${upper} ${plural(upper, 'доба', 'доби', 'діб')}`
                  return <tr key={t.minDays}><td>{label}</td><td>{uah(t.dailyRate)}</td></tr>
                })}
              </tbody>
            </table>
            <dl className="facts">
              <div><dt>Застава</dt><dd>{uah(e.deposit)} — повертається після огляду</dd></div>
              <div><dt>Найдовша оренда</dt><dd>{days(e.maxRentalDays)}</dd></div>
              <div><dt>Запізнення</dt><dd>кожна доба понад строк — ставка × {String(e.lateFeeMultiplier).replace('.', ',')}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </article>
  )
}

function BookingPanel({ equipment, selection, setSelection, today, maxDate, daysData }: {
  equipment: EquipmentDetails; selection: Selection; setSelection: (s: Selection) => void
  today: IsoDate; maxDate: IsoDate; daysData: Availability['days']
}) {
  const { data: user } = useCurrentUser()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const start = selection.start
  const end = selection.end ?? selection.start
  const ready = !!start && !!end && isIsoDate(start) && isIsoDate(end) && compareDates(end, start) >= 0

  const quote = useQuery({
    queryKey: ['quote', equipment.id, start, end],
    queryFn: () => api.get<Quote>(`/api/equipment/${equipment.id}/quote`, { start, end }),
    enabled: ready,
  })

  const create = useMutation({
    mutationFn: () => api.post<Booking>('/api/bookings',
      { equipmentTypeId: equipment.id, startDate: start, endDate: end, comment: comment.trim() || undefined }),
    onSuccess: (b) => {
      qc.invalidateQueries({ queryKey: ['availability', String(equipment.id)] })
      qc.invalidateQueries({ queryKey: ['bookings'] })
      navigate(`/my/${b.id}`, { state: { created: true } })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        // Хтось щойно зайняв дати: оновлюємо календар, щоб показати актуальний стан
        qc.invalidateQueries({ queryKey: ['availability', String(equipment.id)] })
        qc.invalidateQueries({ queryKey: ['quote', equipment.id] })
      }
    },
  })

  function setDate(which: 'start' | 'end', value: string) {
    if (which === 'start') setSelection({ start: value || null, end: selection.end })
    else setSelection({ start: selection.start, end: value || null })
  }

  const warnFull = ready && rangeHasFullDay(daysData, start!, end!)

  return (
    <section className="panel booking-panel" aria-labelledby="book-title">
      <h2 id="book-title" className="panel-title">Ваші дати</h2>
      <p className="hint">Позначте в календарі перший і останній день оренди або введіть дати вручну.
        Обидва дні входять у строк оренди.</p>
      <div className="date-pair">
        <div className="field">
          <label htmlFor="start">Початок</label>
          <input id="start" type="date" min={today} max={maxDate} value={selection.start ?? ''}
            onChange={(e) => setDate('start', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="end">Завершення</label>
          <input id="end" type="date" min={selection.start ?? today} max={maxDate} value={selection.end ?? ''}
            onChange={(e) => setDate('end', e.target.value)} />
        </div>
      </div>

      {start && end && compareDates(end, start) < 0 && (
        <Notice kind="warning">Дата завершення не може бути раніше дати початку.</Notice>
      )}

      {ready && (
        <div className="quote" aria-live="polite">
          <p className="quote-range">{formatRange(start!, end!)} · {days(rentalDays(start!, end!))}</p>
          {quote.isLoading && <Loading label="Рахуємо вартість…" />}
          {quote.isError && <ErrorBox error={quote.error} />}
          {quote.data && (
            <>
              <dl className="quote-lines">
                <div><dt>{quote.data.rentalDays} × {uah(quote.data.dailyRate)}</dt><dd>{uah(quote.data.rentalCost)}</dd></div>
                <div><dt>Застава (повертається)</dt><dd>{uah(quote.data.deposit)}</dd></div>
                <div className="total"><dt>До сплати під час видачі</dt><dd>{uah(quote.data.totalToPay)}</dd></div>
              </dl>
              {quote.data.available
                ? <p className="ok-line">Вільних екземплярів на весь період: {quote.data.freeUnits}</p>
                : <Notice kind="warning">{quote.data.message ?? 'На обрані дати вільних екземплярів немає.'}
                  {warnFull ? ' У періоді є день, коли зайняті всі екземпляри.' : ' Окремі екземпляри вільні лише частину періоду.'}
                </Notice>}
            </>
          )}
        </div>
      )}

      {!user && (
        <p className="login-cta">
          <Link className="btn btn-primary" to="/login" state={{ from: location.pathname }}>Увійти, щоб забронювати</Link>
        </p>
      )}
      {user?.role === 'MANAGER' && (
        <Notice>Бронювання оформлюють клієнти. Ви бачите календар у режимі перегляду.</Notice>
      )}
      {user?.role === 'CLIENT' && (
        <form onSubmit={(ev) => { ev.preventDefault(); create.mutate() }}>
          <div className="field">
            <label htmlFor="comment">Коментар для менеджера <span className="optional">(необов’язково)</span></label>
            <textarea id="comment" rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)}
              placeholder="Наприклад, заберу після 16:00" />
          </div>
          {create.isError && <ErrorBox error={create.error} />}
          <button type="submit" className="btn btn-primary btn-block"
            disabled={!ready || !quote.data?.available || create.isPending}>
            {create.isPending ? 'Надсилаємо заявку…' : 'Надіслати заявку'}
          </button>
        </form>
      )}
    </section>
  )
}

/** Заготовки зарезервованого розміру: вміст не «стрибає» після завантаження даних (CLS). */
function CalendarSkeleton() {
  return (
    <div className="calendar is-skeleton" aria-busy="true" aria-label="Завантаження календаря">
      <div className="cal-weekdays" aria-hidden="true">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((w) => <span key={w}>{w}</span>)}</div>
      <div className="cal-grid">{Array.from({ length: 35 }, (_, i) => <span key={i} className="cal-day skeleton" />)}</div>
    </div>
  )
}

function EquipmentSkeleton() {
  return (
    <div aria-busy="true">
      <Loading label="Завантажуємо картку обладнання…" />
      <div className="skeleton-block" style={{ height: '10rem' }} />
      <div className="equipment-body">
        <div className="panel"><CalendarSkeleton /></div>
        <div className="panel skeleton-block" style={{ height: '24rem' }} />
      </div>
    </div>
  )
}
