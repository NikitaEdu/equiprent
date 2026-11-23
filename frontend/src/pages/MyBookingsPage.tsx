import { useState } from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, uah, type Booking, type Page } from '../lib/api'
import { days, formatRange } from '../lib/dates'
import { Empty, ErrorBox, InventoryTag, Loading, Pager, StatusBadge } from '../components/States'

export function MyBookingsPage() {
  const [page, setPage] = useState(0)
  const q = useQuery({
    queryKey: ['bookings', 'my', page],
    queryFn: () => api.get<Page<Booking>>('/api/bookings/my', { page, size: 10 }),
    placeholderData: keepPreviousData,
  })

  return (
    <section>
      <h1>Мої бронювання</h1>
      {q.isLoading && <Loading />}
      {q.isError && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.items.length === 0 && (
        <Empty title="Бронювань ще немає">
          <p>Оберіть обладнання в каталозі та позначте дати в календарі.</p>
          <Link to="/" className="btn btn-primary">До каталогу</Link>
        </Empty>
      )}
      {q.data && q.data.items.length > 0 && (
        <>
          <ul className="booking-list">
            {q.data.items.map((b) => (
              <li key={b.id}>
                <Link to={`/my/${b.id}`} className="booking-row">
                  <span className="booking-main">
                    <span className="booking-no">{b.number}</span>
                    <span className="booking-name">{b.equipmentName}</span>
                    <span className="booking-dates">{formatRange(b.startDate, b.endDate)} · {days(b.rentalDays)}</span>
                  </span>
                  <InventoryTag value={b.inventoryNumber} />
                  <span className="booking-cost">{uah(b.rentalCost)}</span>
                  <StatusBadge status={b.status} />
                </Link>
              </li>
            ))}
          </ul>
          <Pager page={q.data.page} totalPages={q.data.totalPages} onChange={setPage} />
        </>
      )}
    </section>
  )
}
