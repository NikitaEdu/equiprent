import { execSync } from 'node:child_process'
import os from 'node:os'

export const BASE = process.env.BASE_URL ?? 'http://localhost:8080'

/** Опис стенда для протоколу (Д.3.11 методичних вказівок). */
export function environment() {
  const java = (() => { try { return execSync('java -version 2>&1').toString().split('\n').find((l) => !l.startsWith('Picked up')) } catch { return 'н/д' } })()
  const pg = (() => { try { return execSync('psql --version').toString().trim() } catch { return 'н/д' } })()
  return {
    os: `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model, cores: os.cpus().length,
    memoryGb: Math.round(os.totalmem() / 1024 ** 3), node: process.version, java, postgres: pg,
    note: 'Генератор навантаження, застосунок і СКБД працюють на одному вузлі (навчальний стенд)',
  }
}

/** Періодично знімає використання процесора та пам'яті процесом застосунку. */
export function startResourceSampler(pattern = 'equiprent-1.0.0.jar') {
  let pid
  try { pid = execSync(`pgrep -f ${pattern}`).toString().trim().split('\n')[0] } catch { pid = null }
  const samples = []
  const timer = setInterval(() => {
    if (!pid) return
    try {
      const [cpu, rss] = execSync(`ps -p ${pid} -o %cpu=,rss=`).toString().trim().split(/\s+/).map(Number)
      samples.push({ cpu, rssMb: Math.round(rss / 1024) })
    } catch { /* процес завершився */ }
  }, 1000)
  return {
    stop() {
      clearInterval(timer)
      if (!samples.length) return null
      const avg = (k) => Math.round(samples.reduce((s, x) => s + x[k], 0) / samples.length)
      return { samples: samples.length, cpuAvgPercent: avg('cpu'), cpuMaxPercent: Math.max(...samples.map((s) => s.cpu)),
        rssAvgMb: avg('rssMb'), rssMaxMb: Math.max(...samples.map((s) => s.rssMb)) }
    },
  }
}

export function summarize(r) {
  const codes = r.statusCodeStats ?? {}
  return {
    durationSec: r.duration, connections: r.connections, requests: r.requests.total,
    rpsAvg: Math.round(r.requests.average), throughputKBps: Math.round(r.throughput.average / 1024),
    latencyMs: { p50: r.latency.p50, p90: r.latency.p90, p97_5: r.latency.p97_5, p99: r.latency.p99,
      avg: Number(r.latency.average.toFixed(1)), max: r.latency.max },
    errors: r.errors, timeouts: r.timeouts, non2xx: r.non2xx,
    statusCodes: Object.fromEntries(Object.entries(codes).map(([k, v]) => [k, v.count])),
  }
}

export async function login(email, password) {
  const csrf = await fetch(`${BASE}/api/auth/csrf`)
  const xsrf = /XSRF-TOKEN=([^;]+)/.exec(csrf.headers.get('set-cookie') ?? '')?.[1]
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf, Cookie: `XSRF-TOKEN=${xsrf}` },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error('Не вдалося увійти: ' + res.status)
  const session = /JSESSIONID=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1]
  return { cookie: `JSESSIONID=${session}; XSRF-TOKEN=${xsrf}`, xsrf }
}
