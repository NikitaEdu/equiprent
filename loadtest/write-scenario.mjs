/**
 * Навантажувальний експеримент запису: автентифіковані клієнти створюють бронювання
 * на випадкові типи обладнання та дати (1–170 днів наперед, 1–3 доби).
 * Очікувані бізнес-відмови (409 — період зайнятий) відокремлюються від технічних помилок.
 * Після прогону перевіряється інваріант у БД: немає перетинів активних бронювань екземпляра.
 *
 * Запуск: node write-scenario.mjs  (змінні BASE_URL, DURATION, CONNECTIONS, PGURL)
 */
import { runLoad } from './generator.mjs'
import pg from 'pg'
import { writeFileSync, mkdirSync } from 'node:fs'
import { BASE, environment, login, startResourceSampler } from './common.mjs'

const DURATION = Number(process.env.DURATION ?? 60)
const CONNECTIONS = Number(process.env.CONNECTIONS ?? 10)
const PGURL = process.env.PGURL ?? 'postgresql://postgres@localhost:5432/rental'

const types = (await (await fetch(`${BASE}/api/equipment?size=48`)).json()).items.map((t) => t.id)
const sessions = [await login('olena@equiprent.test', 'Client-Demo-2026!'),
  await login('taras@equiprent.test', 'Client-Demo-2026!')]

const iso = (offset) => {
  const d = new Date(); d.setUTCHours(12, 0, 0, 0); d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

const sampler = startResourceSampler()
const result = await runLoad({
  base: BASE, vus: CONNECTIONS, durationSec: DURATION,
  nextRequest: () => {
    const sess = sessions[Math.floor(Math.random() * sessions.length)]
    const start = 1 + Math.floor(Math.random() * 170)
    const len = Math.floor(Math.random() * 3)
    return {
      method: 'POST', path: '/api/bookings',
      headers: { 'Content-Type': 'application/json', Cookie: sess.cookie, 'X-XSRF-TOKEN': sess.xsrf },
      body: JSON.stringify({ equipmentTypeId: types[Math.floor(Math.random() * types.length)],
        startDate: iso(start), endDate: iso(start + len) }),
    }
  },
})
const s = { ...result, server: sampler.stop() }
const created = s.statusCodes['201'] ?? 0
const conflicts = s.statusCodes['409'] ?? 0
const technical = s.networkErrors + Object.entries(s.statusCodes)
  .filter(([k]) => Number(k) >= 500).reduce((a, [, v]) => a + v, 0)

const db = new pg.Client({ connectionString: PGURL })
await db.connect()
const overlaps = (await db.query(`
  select count(*)::int as n from booking a join booking b
    on a.unit_id = b.unit_id and a.id < b.id and a.blocked && b.blocked
  where a.status in ('PENDING','CONFIRMED','ISSUED') and b.status in ('PENDING','CONFIRMED','ISSUED')`)).rows[0].n
await db.end()

const out = { scenario: 'write-create-bookings', startedAt: new Date().toISOString(), environment: environment(),
  config: { durationSec: DURATION, connections: CONNECTIONS, equipmentTypes: types.length, horizonDays: 170 },
  result: s, businessOutcome: { created, conflicts409: conflicts, technicalErrors: technical,
    technicalErrorRate: s.requests ? technical / s.requests : 0 }, invariantOverlapsInDb: overlaps }
mkdirSync('results', { recursive: true })
writeFileSync('results/write-scenario.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify({ rps: s.rps, latency: s.latencyMs, created, conflicts, technical, overlaps }, null, 1))
