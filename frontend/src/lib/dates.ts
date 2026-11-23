/**
 * Робота з календарними датами у форматі ISO "YYYY-MM-DD" без часових поясів.
 * Бізнес-дати системи — це дні, а не моменти часу, тому арифметика виконується
 * в UTC над північчю, щоб перехід на літній час не зсував день.
 */

export type IsoDate = string

const ISO = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: string): boolean {
  if (!ISO.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function toUtc(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUtc(dt: Date): IsoDate {
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const dt = toUtc(date)
  dt.setUTCDate(dt.getUTCDate() + days)
  return fromUtc(dt)
}

/** Кількість діб оренди з включними межами: end − start + 1. */
export function rentalDays(start: IsoDate, end: IsoDate): number {
  return Math.round((toUtc(end).getTime() - toUtc(start).getTime()) / 86_400_000) + 1
}

/** Сьогоднішня дата в часовому поясі Києва (як на сервері). */
export function todayKyiv(now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function startOfMonth(date: IsoDate): IsoDate {
  return date.slice(0, 8) + '01'
}

export function addMonths(monthStart: IsoDate, months: number): IsoDate {
  const dt = toUtc(monthStart)
  dt.setUTCDate(1)
  dt.setUTCMonth(dt.getUTCMonth() + months)
  return fromUtc(dt)
}

export function endOfMonth(monthStart: IsoDate): IsoDate {
  return addDays(addMonths(monthStart, 1), -1)
}

/** День тижня з понеділка: 0 = пн … 6 = нд. */
export function weekdayMondayFirst(date: IsoDate): number {
  return (toUtc(date).getUTCDay() + 6) % 7
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

const longFmt = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', timeZone: 'UTC' })
const shortFmt = new Intl.DateTimeFormat('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
const monthFmt = new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export function formatLong(date: IsoDate): string {
  return longFmt.format(toUtc(date))
}

export function formatShort(date: IsoDate): string {
  return shortFmt.format(toUtc(date))
}

export function formatMonth(monthStart: IsoDate): string {
  const s = monthFmt.format(toUtc(monthStart)).replace(' р.', '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatRange(start: IsoDate, end: IsoDate): string {
  return start === end ? formatShort(start) : `${formatShort(start)} – ${formatShort(end)}`
}

/** Відмінювання іменника за числом: 1 доба, 2 доби, 5 діб. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function days(n: number): string {
  return `${n} ${plural(n, 'доба', 'доби', 'діб')}`
}
