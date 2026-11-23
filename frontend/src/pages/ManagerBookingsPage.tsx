import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, statusLabel, uah, type Booking, type BookingStatus, type Page } from '../lib/api'
import { compareDates, days, formatRange, todayKyiv } from '../lib/dates'
import { Empty, ErrorBox, InventoryTag, Loading, Notice, Pager, StatusBadge } from '../components/States'

const STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED', 'ISSUED', 'RETURNED', 'CANCELLED', 'REJECTED']

export function ManagerBookingsPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'PENDING'
  const q = params.get('q') ?? ''
  const page = Number(params.get('page') ?? '0')
  const [draft, setDraft] = useState(q)
  const [done, setDone] = useState<string | null>(null)
  const today = todayKyiv()
  const qc = useQueryClient()

  const list = useQuery({
    queryKey: ['bookings', 'manager', status, q, page],
    queryFn: () => api.get<Page<Booking>>('/api/manager/bookings', { status: status === 'ALL' ? undefined : status, q, page, size: 20 }),
    placeholderData: keepPreviousData,
  })

  const confirm = useMutation({
    mutationFn: (b: Booking) => api.post<Booking>(`/api/manager/bookings/${b.id}/confirm`),
    onSuccess: (b) => { setDone(`${b.number} підтверджено`); qc.invalidateQueries({ queryKey: ['bookings'] }) },
  })

  function update(next: Record<string, string>) {
    const m = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) { if (v) m.set(k, v); else m.delete(k) }
    if (!('page' in next)) m.delete('page')
    setParams(m)
    setDone(null)
  }

  return (
    <section>
      <h1>Заявки та оренди</h1>
      <div className="tabs" role="tablist" aria-label="Стан бронювання">
        {[...STATUSES, 'ALL' as const].map((s) => (
          <button key={s} role="tab" type="button" aria-selected={status === s}
            className={status === s ? 'tab is-active' : 'tab'} onClick={() => update({ status: s })}>
            {s === 'ALL' ? 'Усі' : statusLabel[s]}
          </button>
        ))}
      </div>
      <form className="filters" role="search" onSubmit={(e) => { e.preventDefault(); update({ q: draft.trim() }) }}>
        <div className="field field-grow">
          <label htmlFor="mq">Клієнт, пошта або номер бронювання</label>
          <input id="mq" type="search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="BR-000012 або Олена" />
        </div>
        <button className="btn btn-primary" type="submit">Знайти</button>
      </form>

      {done && <Notice kind="success">{done}</Notice>}
      {confirm.isError && <ErrorBox error={confirm.error} />}
      {list.isLoading && <Loading />}
      {list.isError && <ErrorBox error={list.error} onRetry={() => list.refetch()} />}
      {list.data && list.data.items.length === 0 && (
        <Empty title={status === 'PENDING' ? 'Нових заявок немає' : 'Нічого не знайдено'}>
          <p>{status === 'PENDING' ? 'Усі заявки опрацьовано.' : 'Змініть фільтр стану або пошуковий запит.'}</p>
        </Empty>
      )}
      {list.data && list.data.items.length > 0 && (
        <div className="table-wrap" role="region" tabIndex={0} aria-label="Таблиця бронювань, прокручується горизонтально">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Номер</th><th scope="col">Обладнання</th><th scope="col">Екземпляр</th>
                <th scope="col">Період</th><th scope="col">Клієнт</th><th scope="col" className="num">Вартість</th>
                <th scope="col">Стан</th><th scope="col"><span className="sr-only">Дії</span></th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((b) => {
                const overdue = b.status === 'ISSUED' && compareDates(today, b.endDate) > 0
                return (
                  <tr key={b.id}>
                    <td><Link to={`/manager/bookings/${b.id}`}>{b.number}</Link></td>
                    <td>{b.equipmentName}</td>
                    <td><InventoryTag value={b.inventoryNumber} /></td>
                    <td>{formatRange(b.startDate, b.endDate)}<br /><small>{days(b.rentalDays)}</small></td>
                    <td>{b.clientName}<br /><small>{b.clientEmail}</small></td>
                    <td className="num">{uah(b.rentalCost)}</td>
                    <td><StatusBadge status={b.status} />{overdue && <span className="overdue">прострочено</span>}</td>
                    <td>
                      {b.status === 'PENDING'
                        ? <button type="button" className="btn btn-quiet btn-small" disabled={confirm.isPending}
                          onClick={() => confirm.mutate(b)}>Підтвердити</button>
                        : <Link className="btn btn-quiet btn-small" to={`/manager/bookings/${b.id}`}>Відкрити</Link>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {list.data && <Pager page={list.data.page} totalPages={list.data.totalPages} onChange={(p) => update({ page: String(p) })} />}
    </section>
  )
}
