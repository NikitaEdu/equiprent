/**
 * Простий генератор навантаження із закритою моделлю: VU віртуальних користувачів, кожен
 * у циклі надсилає запит, чекає відповідь, фіксує час (performance.now) і одразу надсилає наступний
 * (пауза thinkMs). З'єднання перевикористовуються (keep-alive вбудованого fetch/undici).
 *
 * Чому не autocannon: у версії 9.0 на цьому стенді його затримки суперечили закону Літтла
 * (λ·W ≫ кількості з'єднань), тому результати не можна було використати (див. записку, розділ 5).
 * Цей генератор перевіряє узгодженість: concurrencyCheck = rps · середня затримка ≈ VU.
 */
export async function runLoad({ base, vus, durationSec, nextRequest, thinkMs = 0 }) {
  const latencies = []
  const statusCounts = {}
  let networkErrors = 0
  const perSecond = new Map()
  const started = performance.now()
  const deadline = started + durationSec * 1000

  async function vu() {
    while (performance.now() < deadline) {
      const { method = 'GET', path, headers, body } = nextRequest()
      const t0 = performance.now()
      try {
        const res = await fetch(base + path, { method, headers, body })
        await res.arrayBuffer()
        const ms = performance.now() - t0
        latencies.push(ms)
        statusCounts[res.status] = (statusCounts[res.status] ?? 0) + 1
        const sec = Math.floor((t0 - started) / 1000)
        const bucket = perSecond.get(sec) ?? []
        bucket.push(ms)
        perSecond.set(sec, bucket)
      } catch {
        networkErrors++
      }
      if (thinkMs) await new Promise((r) => setTimeout(r, thinkMs))
    }
  }

  const cpuBefore = process.cpuUsage()
  await Promise.all(Array.from({ length: vus }, vu))
  const elapsed = (performance.now() - started) / 1000
  const cpu = process.cpuUsage(cpuBefore)

  const sorted = Float64Array.from(latencies).sort()
  const q = (p) => sorted.length ? Number(sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)].toFixed(2)) : null
  const avg = latencies.reduce((a, b) => a + b, 0) / Math.max(1, latencies.length)
  const rps = latencies.length / elapsed
  const series = [...perSecond.entries()].sort((a, b) => a[0] - b[0]).map(([s, arr]) => {
    arr.sort((a, b) => a - b)
    return { second: s, requests: arr.length, p95Ms: Number(arr[Math.ceil(0.95 * arr.length) - 1].toFixed(2)) }
  })
  return {
    vus, durationSec: Number(elapsed.toFixed(1)), requests: latencies.length, rps: Number(rps.toFixed(1)),
    latencyMs: { p50: q(0.5), p90: q(0.9), p95: q(0.95), p99: q(0.99), avg: Number(avg.toFixed(2)), max: q(1) },
    statusCodes: statusCounts, networkErrors,
    littleLawConcurrency: Number((rps * avg / 1000).toFixed(2)),
    generatorCpuPercent: Number((((cpu.user + cpu.system) / 1e6) / elapsed * 100).toFixed(1)),
    series,
  }
}
