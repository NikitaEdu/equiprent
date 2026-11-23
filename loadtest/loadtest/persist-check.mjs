// NFR-DATA-02: створити й підтвердити бронювання, перезапустити застосунок, прочитати повторно
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { BASE, login } from './common.mjs'
const iso = (o) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + o); return d.toISOString().slice(0, 10) }
const c = await login('taras@equiprent.test', 'Client-Demo-2026!')
const post = (path, body, s) => fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: s.cookie, 'X-XSRF-TOKEN': s.xsrf }, body: body ? JSON.stringify(body) : undefined })
const created = await (await post('/api/bookings', { equipmentTypeId: 6, startDate: iso(124), endDate: iso(125) }, c)).json()
const m = await login('manager@equiprent.test', 'Manager-Demo-2026!')
const confirmed = await (await post(`/api/manager/bookings/${created.id}/confirm`, null, m)).json()
console.log('до перезапуску:', created.number, confirmed.status, confirmed.inventoryNumber, confirmed.rentalCost)
// Перезапуск: команда з RESTART_CMD; на Linux/macOS типово restart-app.sh поруч зі скриптом;
// на Windows без RESTART_CMD скрипт просить перезапустити застосунок вручну й чекає на нього.
const here = path.dirname(fileURLToPath(import.meta.url))
const health = async () => { try { return (await fetch(`${BASE}/actuator/health/readiness`)).ok } catch { return false } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const cmd = process.env.RESTART_CMD ?? (process.platform === 'win32' ? null : `bash "${path.join(here, 'restart-app.sh')}"`)
if (cmd) {
  execSync(cmd, { stdio: 'inherit' })
} else {
  console.log('Зупиніть застосунок (Ctrl+C у його вікні) і запустіть знову (mvn spring-boot:run або docker compose restart app). Чекаю...')
  while (await health()) await sleep(1000)
  console.log('Застосунок зупинено, чекаю повторного запуску...')
}
for (let i = 0; i < 300 && !(await health()); i++) await sleep(1000)
// Після перезапуску старі keep-alive з'єднання закрито — повторюємо вхід із паузою
let m2
for (let i = 0; i < 10 && !m2; i++) {
  try { m2 = await login('manager@equiprent.test', 'Manager-Demo-2026!') } catch { await new Promise((r) => setTimeout(r, 1000)) }
}
const after = await (await fetch(`${BASE}/api/bookings/${created.id}`, { headers: { Cookie: m2.cookie } })).json()
const ok = after.status === 'CONFIRMED' && after.rentalCost === confirmed.rentalCost && after.events.length === 2
console.log('після перезапуску:', after.number, after.status, after.inventoryNumber, after.rentalCost, 'подій:', after.events.length, ok ? 'ПРОЙДЕНО' : 'НЕ ПРОЙДЕНО')
