/**
 * Навантажувальний експеримент: сценарій читання каталогу й календаря доступності гостем.
 * Модель: 40 % — календар доступності на місяць, 20 % — картка обладнання,
 * 30 % — сторінка каталогу, 10 % — пошук. Без пауз між запитами (найгірший випадок
 * для одного з'єднання). Рівні: 5, 10, 25 одночасних з'єднань; прогрівання — WARMUP с,
 * сталий режим — DURATION с на кожен рівень. Пороги задано до запуску (див. THRESHOLDS).
 * Генератор — generator.mjs (закрита модель, без пауз).
 *
 * Запуск: node read-scenario.mjs  (змінні BASE_URL, DURATION, WARMUP, LEVELS)
 */
import { runLoad } from './generator.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { BASE, environment, startResourceSampler } from './common.mjs'

const DURATION = Number(process.env.DURATION ?? 180)
const WARMUP = Number(process.env.WARMUP ?? 60)
const LEVELS = (process.env.LEVELS ?? '5,10,25').split(',').map(Number)
const THRESHOLDS = { p95Ms: 800, errorRate: 0.01 } // навчальні цілі стенда, погоджуються до експерименту

const types = (await (await fetch(`${BASE}/api/equipment?size=48`)).json()).items.map((t) => t.id)
const today = new Date()
const month = (offset) => {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1))
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
  return [d.toISOString().slice(0, 10), last.toISOString().slice(0, 10)]
}
const queries = ['камера', 'намет', 'demo', 'проєктор', 'xyz']
const pick = (a) => a[Math.floor(Math.random() * a.length)]

function nextPath() {
  const r = Math.random()
  if (r < 0.4) {
    const [from, to] = month(Math.floor(Math.random() * 3))
    return `/api/equipment/${pick(types)}/availability?from=${from}&to=${to}`
  }
  if (r < 0.6) return `/api/equipment/${pick(types)}`
  if (r < 0.9) return `/api/equipment?page=${Math.floor(Math.random() * 2)}&size=12`
  return `/api/equipment?q=${encodeURIComponent(pick(queries))}`
}

function run(vus, durationSec) {
  return runLoad({ base: BASE, vus, durationSec, nextRequest: () => ({ path: nextPath() }) })
}

console.log(`Прогрівання ${WARMUP} с…`)
await run(5, WARMUP)

const results = []
for (const c of LEVELS) {
  console.log(`Рівень ${c} віртуальних користувачів, ${DURATION} с…`)
  const sampler = startResourceSampler()
  const r = await run(c, DURATION)
  const s = { ...r, server: sampler.stop() }
  const technical = s.networkErrors + Object.entries(s.statusCodes).filter(([k]) => Number(k) >= 500)
    .reduce((a, [, v]) => a + v, 0)
  s.technicalErrors = technical
  s.technicalErrorRate = s.requests ? technical / s.requests : 0
  s.thresholdsPassed = s.latencyMs.p95 <= THRESHOLDS.p95Ms && s.technicalErrorRate < THRESHOLDS.errorRate
  results.push(s)
  console.log(JSON.stringify({ vus: c, rps: s.rps, p50: s.latencyMs.p50, p95: s.latencyMs.p95, p99: s.latencyMs.p99,
    little: s.littleLawConcurrency, errors: technical, passed: s.thresholdsPassed }))
}

mkdirSync('results', { recursive: true })
const out = { scenario: 'read-catalog-availability', startedAt: new Date().toISOString(), environment: environment(),
  config: { durationSec: DURATION, warmupSec: WARMUP, levels: LEVELS, thinkTimeMs: 0, thresholds: THRESHOLDS,
    dataset: { equipmentTypes: types.length } }, results }
writeFileSync('results/read-scenario.json', JSON.stringify(out, null, 2))
console.log('Збережено results/read-scenario.json')
