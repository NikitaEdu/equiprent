/**
 * Тонкий клієнт REST API. Сесія — cookie JSESSIONID (браузер надсилає сам);
 * для змінних запитів додається заголовок X-XSRF-TOKEN зі значенням cookie XSRF-TOKEN.
 * Помилки сервера (Problem Details, RFC 9457) перетворюються на ApiError.
 */

export interface FieldError { field: string; message: string }

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: FieldError[]

  constructor(status: number, code: string, message: string, fieldErrors: FieldError[] = []) {
    super(message)
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }

  fieldError(field: string): string | undefined {
    return this.fieldErrors.find((f) => f.field === field)?.message
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(name + '='))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

let csrfReady: Promise<void> | null = null

/** Гарантує наявність cookie XSRF-TOKEN перед першим змінним запитом. */
function ensureCsrf(): Promise<void> {
  if (readCookie('XSRF-TOKEN')) return Promise.resolve()
  if (!csrfReady) {
    csrfReady = fetch('/api/auth/csrf', { credentials: 'same-origin' }).then(() => undefined)
      .finally(() => { csrfReady = null })
  }
  return csrfReady
}

type Query = Record<string, string | number | boolean | undefined | null>

function withQuery(path: string, query?: Query): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (method !== 'GET') {
    await ensureCsrf()
    const token = readCookie('XSRF-TOKEN')
    if (token) headers['X-XSRF-TOKEN'] = token
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(withQuery(path, query), {
      method, headers, credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Немає з’єднання із сервером. Перевірте мережу та повторіть спробу')
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? safeJson(text) : undefined
  if (!res.ok) {
    const p = (data ?? {}) as { code?: string; detail?: string; fieldErrors?: FieldError[] }
    throw new ApiError(res.status, p.code ?? 'HTTP_' + res.status,
      p.detail ?? defaultMessage(res.status), p.fieldErrors ?? [])
  }
  return data as T
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text) } catch { return undefined }
}

function defaultMessage(status: number): string {
  if (status === 401) return 'Потрібно увійти до системи'
  if (status === 403) return 'Недостатньо прав або сеанс застарів. Оновіть сторінку'
  if (status >= 500) return 'Сервер тимчасово недоступний. Спробуйте пізніше'
  return 'Запит не виконано'
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
}

// ---------------------------------------------------------------- типи контракту

export type Role = 'CLIENT' | 'MANAGER'
export interface User { id: number; email: string; fullName: string; role: Role }

export interface Category { id: number; name: string; slug: string }
export interface Tariff { minDays: number; dailyRate: number }

export interface EquipmentSummary {
  id: number; name: string; brand: string | null; category: Category; imageUrl: string | null
  priceFrom: number; deposit: number; availableUnits: number
}

export interface EquipmentDetails {
  id: number; name: string; brand: string | null; description: string; category: Category
  imageUrl: string | null; deposit: number; serviceBufferDays: number; maxRentalDays: number
  lateFeeMultiplier: number; tariffs: Tariff[]; availableUnits: number; active: boolean
}

export interface Page<T> { items: T[]; page: number; size: number; totalItems: number; totalPages: number }

export interface DayAvailability { date: string; free: number }
export interface Availability {
  equipmentTypeId: number; from: string; to: string; totalUnits: number; serviceBufferDays: number
  days: DayAvailability[]
}

export interface Quote {
  available: boolean; freeUnits: number; rentalDays: number; dailyRate: number; rentalCost: number
  deposit: number; totalToPay: number; message?: string
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'ISSUED' | 'RETURNED' | 'CANCELLED' | 'REJECTED'

export interface BookingEvent {
  type: string; fromStatus?: BookingStatus; toStatus: BookingStatus; actor: string; note?: string; occurredAt: string
}

export interface Booking {
  id: number; number: string; equipmentTypeId: number; equipmentName: string; inventoryNumber: string
  startDate: string; endDate: string; rentalDays: number; bufferDays: number; status: BookingStatus
  dailyRate: number; rentalCost: number; deposit: number; lateFee: number; actualReturnDate?: string
  comment?: string; rejectReason?: string; clientName?: string; clientEmail?: string; createdAt: string
  version: number; events: BookingEvent[]
}

export interface Unit { id: number; inventoryNumber: string; status: 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED'; conditionNote?: string }

export interface TimelineBar {
  bookingId: number; number: string; startDate: string; endDate: string; bufferDays: number
  status: BookingStatus; clientName: string
}
export interface Timeline {
  equipmentTypeId: number; equipmentName: string; from: string; to: string
  units: { unitId: number; inventoryNumber: string; unitStatus: Unit['status']; bookings: TimelineBar[] }[]
}

export interface UtilizationRow {
  equipmentTypeId: number; name: string; units: number; bookings: number; occupiedUnitDays: number
  utilization: number; revenue: number
}
export interface UtilizationReport {
  from: string; to: string; days: number; rows: UtilizationRow[]; totalRevenue: number; overallUtilization: number
}

// ---------------------------------------------------------------- форматування

const money = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
export function uah(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${money.format(Number(value))} грн`
}

export const statusLabel: Record<BookingStatus, string> = {
  PENDING: 'Очікує підтвердження',
  CONFIRMED: 'Підтверджено',
  ISSUED: 'Видано',
  RETURNED: 'Повернено',
  CANCELLED: 'Скасовано',
  REJECTED: 'Відхилено',
}

export const unitStatusLabel: Record<Unit['status'], string> = {
  AVAILABLE: 'У роботі',
  MAINTENANCE: 'На обслуговуванні',
  RETIRED: 'Списано',
}
