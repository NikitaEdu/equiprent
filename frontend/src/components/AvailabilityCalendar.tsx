import { useMemo } from 'react'
import type { DayAvailability } from '../lib/api'
import {
  addDays, compareDates, formatLong, formatMonth, type IsoDate, weekdayMondayFirst,
} from '../lib/dates'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

export interface Selection { start: IsoDate | null; end: IsoDate | null }

interface Props {
  month: IsoDate
  days: DayAvailability[]
  total: number
  today: IsoDate
  maxDate: IsoDate
  selection: Selection
  onPick: (date: IsoDate) => void
}

/**
 * Календар доступності: для кожного дня показує кількість вільних екземплярів.
 * Стан дня передається не лише кольором, а й числом та текстовою міткою для читачів екрана.
 * Перший клік задає початок, другий — кінець оренди.
 */
export function AvailabilityCalendar({ month, days, total, today, maxDate, selection, onPick }: Props) {
  const cells = useMemo(() => {
    const lead = weekdayMondayFirst(month)
    const list: (DayAvailability | null)[] = Array.from({ length: lead }, () => null)
    return list.concat(days)
  }, [month, days])

  const inRange = (d: IsoDate) => {
    if (!selection.start) return false
    const end = selection.end ?? selection.start
    return compareDates(d, selection.start) >= 0 && compareDates(d, end) <= 0
  }

  return (
    <div className="calendar" role="group" aria-label={`Доступність, ${formatMonth(month)}`}>
      <div className="cal-weekdays" aria-hidden="true">
        {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="cal-grid">
        {cells.map((c, i) => {
          if (!c) return <span key={`pad-${i}`} className="cal-pad" aria-hidden="true" />
          const disabled = compareDates(c.date, today) < 0 || compareDates(c.date, maxDate) > 0
          const level = total === 0 || c.free === 0 ? 'none' : c.free < total ? 'partial' : 'full'
          const selected = inRange(c.date)
          const edge = c.date === selection.start || c.date === selection.end
          const dayNum = Number(c.date.slice(8))
          const monthWord = formatLong(c.date).replace(/^\d+\s*/, '')
          return (
            <button
              key={c.date}
              type="button"
              className={['cal-day', `lvl-${level}`, disabled && 'is-disabled', selected && 'is-selected',
                edge && 'is-edge', c.date === today && 'is-today'].filter(Boolean).join(' ')}
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onPick(c.date)}
            >
              {/* Доступне ім'я складається з видимого тексту та прихованого уточнення (WCAG 2.5.3) */}
              <span className="cal-date">{dayNum}<span className="sr-only"> {monthWord}{disabled ? '' : ', вільно'}</span></span>
              {!disabled && (
                <span className="cal-free">
                  <b>{c.free}</b><small> з {total}</small>
                </span>
              )}
              {!disabled && total > 0 && (
                <span className="cal-meter" aria-hidden="true">
                  <span style={{ width: `${(c.free / total) * 100}%` }} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Чи містить вибраний період день без вільних екземплярів (необхідна, але не достатня умова). */
export function rangeHasFullDay(days: DayAvailability[], start: IsoDate, end: IsoDate): boolean {
  for (let d = start; compareDates(d, end) <= 0; d = addDays(d, 1)) {
    const day = days.find((x) => x.date === d)
    if (day && day.free === 0) return true
  }
  return false
}
