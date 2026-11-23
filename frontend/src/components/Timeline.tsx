import { Link } from 'react-router'
import { statusLabel, unitStatusLabel, type Timeline as TimelineData } from '../lib/api'
import { addDays, compareDates, rentalDays, type IsoDate } from '../lib/dates'
import { InventoryTag } from './States'

/**
 * Часова діаграма зайнятості: рядок — фізичний екземпляр, стовпець — день.
 * Смуга — дні оренди, заштрихований хвіст — технічна перерва після неї.
 */
export function Timeline({ data, today }: { data: TimelineData; today: IsoDate }) {
  const total = rentalDays(data.from, data.to)
  const dayList = Array.from({ length: total }, (_, i) => addDays(data.from, i))
  const col = (d: IsoDate) => Math.max(0, rentalDays(data.from, d) - 1)

  return (
    <div className="timeline-wrap" role="region" tabIndex={0} aria-label="Часова діаграма, прокручується горизонтально">
      <div className="timeline" style={{ gridTemplateColumns: `9rem repeat(${total}, minmax(1.6rem, 1fr))` }}>
        <div className="tl-corner">Екземпляр</div>
        {dayList.map((d) => (
          <div key={d} className={d === today ? 'tl-day is-today' : 'tl-day'}>{Number(d.slice(8))}</div>
        ))}
        {data.units.map((u) => (
          <div key={u.unitId} className="tl-row">
            <div className="tl-unit">
              <InventoryTag value={u.inventoryNumber} />
              {u.unitStatus !== 'AVAILABLE' && <small>{unitStatusLabel[u.unitStatus]}</small>}
            </div>
            {u.bookings.map((b) => {
              const start = compareDates(b.startDate, data.from) < 0 ? data.from : b.startDate
              const blockedEnd = addDays(b.endDate, b.bufferDays)
              const end = compareDates(blockedEnd, data.to) > 0 ? data.to : blockedEnd
              if (compareDates(end, start) < 0) return null
              const rentEnd = compareDates(b.endDate, data.to) > 0 ? data.to : b.endDate
              const rentCols = compareDates(rentEnd, start) >= 0 ? col(rentEnd) - col(start) + 1 : 0
              const spanCols = col(end) - col(start) + 1
              return (
                <Link key={b.bookingId} to={`/manager/bookings/${b.bookingId}`}
                  className={`tl-bar st-${b.status.toLowerCase()}`}
                  style={{ gridColumn: `${col(start) + 2} / span ${spanCols}`,
                    ['--rent' as string]: `${(rentCols / spanCols) * 100}%` }}
                  title={`${b.number}: ${b.clientName}, ${statusLabel[b.status]}`}>
                  <span>{b.number} · {b.clientName}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
