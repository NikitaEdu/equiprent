/**
 * Тестування обсягом даних (Д.5.7): для наборів 100, 1000 і 10 000 бронювань
 * генерує правдоподібні синтетичні дані (різні статуси, клієнти, типи; без перетинів
 * у межах екземпляра), вимірює час ключових операцій через HTTP і перевіряє коректність:
 * календар збігається з незалежним SQL-підрахунком, пагінація стабільна, кількість записів збігається.
 *
 * Запуск: node volume.mjs <кількість> [мітка]   — БД має містити демонстраційні дані.
 */
import pg from 'pg'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { BASE, environment, login } from './common.mjs'

const N = Number(process.argv[2] ?? 1000)
const LABEL = process.argv[3] ?? 'baseline'
const PGURL = process.env.PGURL ?? 'postgresql://postgres@localhost:5432/rental'
const REPEATS = 30

// Детермінований генератор псевдовипадкових чисел — набір відтворюється
let seed = 20261122
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const pick = (a) => a[Math.floor(rnd() * a.length)]

const db = new pg.Client({ connectionString: PGURL })
await db.connect()

async function generate() {
  await db.query('begin')
  // Прибираємо попередні згенеровані записи (позначені клієнтами vol-*)
  await db.query(`delete from booking where client_id in (select id from app_user where email like 'vol-%')`)
  await db.query(`delete from app_user where email like 'vol-%'`)
  await db.query(`delete from equipment_unit where inventory_number like 'VOL-%'`)
  await db.query(`delete from equipment_type where name like 'Об''ємний тест %'`)

  const clients = []
  for (let i = 0; i < 200; i++) {
    const r = await db.query(`insert into app_user(email, full_name, password_hash, role)
      values ($1, $2, 'not-a-login-account', 'CLIENT') returning id`, [`vol-${i}@equiprent.test`, `Клієнт тестовий ${i}`])
    clients.push(r.rows[0].id)
  }
  const cats = (await db.query('select id from category')).rows.map((r) => r.id)
  // Додаткові типи та екземпляри, щоб 10 000 бронювань мали реалістичну щільність
  for (let i = 0; i < 24; i++) {
    const t = await db.query(`insert into equipment_type(category_id, name, brand, description, deposit,
        service_buffer_days, max_rental_days) values ($1, $2, 'Vol', 'Синтетичний запис для тесту обсягом', 1000, $3, 30)
        returning id`, [pick(cats), `Об'ємний тест ${String(i + 1).padStart(2, '0')}`, i % 3])
    await db.query(`insert into tariff(equipment_type_id, min_days, daily_rate) values ($1, 1, $2), ($1, 5, $3)`,
      [t.rows[0].id, 300 + i * 10, 260 + i * 10])
    for (let u = 1; u <= 4; u++) {
      await db.query(`insert into equipment_unit(equipment_type_id, inventory_number) values ($1, $2)`,
        [t.rows[0].id, `VOL-${String(i + 1).padStart(2, '0')}-${u}`])
    }
  }
  const units = (await db.query(`select u.id, u.equipment_type_id, t.service_buffer_days as buf,
      (select daily_rate from tariff where equipment_type_id = t.id order by min_days limit 1) as rate, t.deposit
      from equipment_unit u join equipment_type t on t.id = u.equipment_type_id where u.status = 'AVAILABLE'`)).rows
  // Активні інтервали наявних (демонстраційних) бронювань — нові активні записи їх не перетинають
  const busy = new Map()
  for (const r of (await db.query(`select unit_id, lower(blocked)::text as f, upper(blocked)::text as t from booking
      where status in ('PENDING','CONFIRMED','ISSUED')`)).rows) {
    if (!busy.has(r.unit_id)) busy.set(r.unit_id, [])
    busy.get(r.unit_id).push([r.f, r.t])
  }

  const today = new Date(); today.setUTCHours(0, 0, 0, 0)
  const dayIso = (off) => new Date(today.getTime() + off * 86400000).toISOString().slice(0, 10)
  const perUnit = Math.ceil(N / units.length)
  const rows = []
  for (const u of units) {
    // Розподіл у часі: від −540 до +170 днів; для невеликих наборів — розріджено
    let cursor = -540 + Math.floor(rnd() * 20)
    const step = Math.max(1, Math.floor(700 / perUnit) - 4)
    for (let k = 0; k < perUnit && rows.length < N; k++) {
      const len = 1 + Math.floor(rnd() * 4)
      const start = cursor
      const end = start + len - 1
      if (end > 170) break
      const blockedTo = end + 1 + u.buf
      const startIso = dayIso(start)
      let status
      if (end < 0) status = rnd() < 0.85 ? 'RETURNED' : rnd() < 0.66 ? 'CANCELLED' : 'REJECTED'
      else if (start <= 0) status = 'ISSUED'
      else status = rnd() < 0.5 ? 'PENDING' : 'CONFIRMED'
      const active = ['PENDING', 'CONFIRMED', 'ISSUED'].includes(status)
      const clash = active && (busy.get(u.id) ?? []).some(([f, t]) => startIso < t && f < dayIso(blockedTo))
      if (!clash) {
        rows.push([pick(clients), u.equipment_type_id, u.id, startIso, dayIso(end), u.buf, status, len,
          u.rate, (Number(u.rate) * len).toFixed(2), u.deposit, status === 'RETURNED' ? dayIso(end) : null])
      }
      cursor = blockedTo + step + Math.floor(rnd() * 3)
    }
  }
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const values = chunk.map((_, j) => `(${Array.from({ length: 12 }, (_, c) => `$${j * 12 + c + 1}`).join(',')})`).join(',')
    await db.query(`insert into booking(client_id, equipment_type_id, unit_id, start_date, end_date, buffer_days, status,
      rental_days, daily_rate, rental_cost, deposit, actual_return_date) values ${values}`, chunk.flat())
  }
  await db.query(`insert into booking_event(booking_id, event_type, to_status, actor_id, occurred_at)
    select id, 'CREATED', 'PENDING', client_id, created_at from booking b
    where not exists (select 1 from booking_event e where e.booking_id = b.id)`)
  await db.query('commit')
  await db.query('analyze')
  return rows.length
}

async function time(fn) {
  for (let i = 0; i < 5; i++) await fn()
  const ms = []
  for (let i = 0; i < REPEATS; i++) {
    const t = performance.now(); await fn(); ms.push(performance.now() - t)
  }
  ms.sort((a, b) => a - b)
  const q = (p) => Number(ms[Math.min(ms.length - 1, Math.ceil(p * ms.length) - 1)].toFixed(1))
  return { medianMs: q(0.5), p95Ms: q(0.95), minMs: Number(ms[0].toFixed(1)) }
}

async function getJson(path, cookie) {
  const r = await fetch(BASE + path, { headers: cookie ? { Cookie: cookie } : {} })
  if (!r.ok) throw new Error(`${path} → ${r.status}`)
  return r.json()
}

const inserted = await generate()
const totals = (await db.query(`select count(*)::int as all, count(*) filter (where client_id in
  (select id from app_user where email like 'vol-%'))::int as generated from booking`)).rows[0]
const busiest = (await db.query(`select equipment_type_id as id, count(*) from booking
  where status in ('PENDING','CONFIRMED','ISSUED') group by 1 order by 2 desc limit 1`)).rows[0]?.id ?? 1
const manager = await login('manager@equiprent.test', 'Manager-Demo-2026!')
const client = await login('olena@equiprent.test', 'Client-Demo-2026!')
const now = new Date()
const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10)
const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0)).toISOString().slice(0, 10)

const ops = {
  catalogPage: await time(() => getJson('/api/equipment?page=0&size=12')),
  catalogSearch: await time(() => getJson('/api/equipment?q=' + encodeURIComponent('тест'))),
  availabilityMonth: await time(() => getJson(`/api/equipment/${busiest}/availability?from=${from}&to=${to}`)),
  quote: await time(() => getJson(`/api/equipment/${busiest}/quote?start=${from}&end=${from}`)),
  managerListPending: await time(() => getJson('/api/manager/bookings?status=PENDING&page=0&size=20', manager.cookie)),
  managerListAll: await time(() => getJson('/api/manager/bookings?page=0&size=20', manager.cookie)),
  managerSearchClient: await time(() => getJson('/api/manager/bookings?q=' + encodeURIComponent('тестовий 7') + '&size=20', manager.cookie)),
  clientMyBookings: await time(() => getJson('/api/bookings/my?page=0&size=10', client.cookie)),
  utilizationReport30d: await time(() => getJson(`/api/manager/reports/utilization?from=${from}&to=${to}`, manager.cookie)),
}

// --- перевірки коректності ---
const cal = await getJson(`/api/equipment/${busiest}/availability?from=${from}&to=${to}`)
const sqlFree = (await db.query(`
  with units as (select id from equipment_unit where equipment_type_id = $1 and status = 'AVAILABLE'),
  days as (select d::date as d from generate_series($2::date, $3::date, interval '1 day') d)
  select d, (select count(*) from units) - (select count(distinct b.unit_id) from booking b
     where b.unit_id in (select id from units) and b.status in ('PENDING','CONFIRMED','ISSUED')
       and b.blocked @> d) as free
  from days order by d`, [busiest, from, to])).rows.map((r) => Number(r.free))
const calendarMatchesSql = JSON.stringify(cal.days.map((d) => d.free)) === JSON.stringify(sqlFree)

const p0 = await getJson('/api/manager/bookings?page=0&size=20', manager.cookie)
const p1 = await getJson('/api/manager/bookings?page=1&size=20', manager.cookie)
const ids0 = new Set(p0.items.map((b) => b.id))
const paginationStable = p1.items.every((b) => !ids0.has(b.id)) && p0.totalItems === totals.all

const explain = async (sql, params) => (await db.query('explain (analyze, buffers, format json) ' + sql, params))
  .rows[0]['QUERY PLAN'][0]
const planAvail = await explain(`select unit_id, lower(blocked), upper(blocked) from booking where equipment_type_id = $1
  and status in ('PENDING','CONFIRMED','ISSUED') and blocked && daterange($2::date, $3::date, '[)')`, [busiest, from, to])
const planManager = await explain(`select b.* from booking b join app_user c on c.id = b.client_id
  where b.status = 'PENDING' order by b.created_at desc, b.id desc limit 20`, [])
const nodeTypes = (p) => { const out = []; const walk = (n) => { out.push(n['Node Type'] + (n['Index Name'] ? `(${n['Index Name']})` : '')); (n.Plans ?? []).forEach(walk) }; walk(p.Plan); return out }

await db.end()
const result = { label: LABEL, requestedBookings: N, insertedBookings: inserted, totalBookingsInDb: totals.all,
  busiestTypeId: busiest, period: { from, to }, repeatsPerOperation: REPEATS, operations: ops,
  correctness: { calendarMatchesSql, paginationStable, managerTotalMatchesDb: p0.totalItems === totals.all },
  plans: {
    availability: { executionMs: planAvail['Execution Time'], nodes: nodeTypes(planAvail) },
    managerPending: { executionMs: planManager['Execution Time'], nodes: nodeTypes(planManager) },
  } }

mkdirSync('results', { recursive: true })
const file = 'results/volume.json'
const all = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { environment: environment(), runs: [] }
all.runs = all.runs.filter((r) => !(r.requestedBookings === N && r.label === LABEL)).concat(result)
writeFileSync(file, JSON.stringify(all, null, 2))
console.log(JSON.stringify(result, null, 1))
