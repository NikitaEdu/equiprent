const fs = require('fs')
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const out = {}
for (const label of ['before', 'after']) for (const page of ['catalog', 'equipment']) {
  const runs = [1, 2, 3, 4, 5].map((i) => JSON.parse(fs.readFileSync(`${label}/${page}-${i}.json`)))
  const m = (k) => med(runs.map((r) => r.audits[k].numericValue))
  out[`${label}/${page}`] = {
    performance: med(runs.map((r) => Math.round(r.categories.performance.score * 100))),
    accessibility: med(runs.map((r) => Math.round(r.categories.accessibility.score * 100))),
    bestPractices: med(runs.map((r) => Math.round(r.categories['best-practices'].score * 100))),
    fcpMs: Math.round(m('first-contentful-paint')), lcpMs: Math.round(m('largest-contentful-paint')),
    cls: Number(m('cumulative-layout-shift').toFixed(3)), tbtMs: Math.round(m('total-blocking-time')),
    perfScores: runs.map((r) => Math.round(r.categories.performance.score * 100)),
    lighthouse: runs[0].lighthouseVersion, formFactor: runs[0].configSettings.formFactor,
    throttling: runs[0].configSettings.throttlingMethod,
  }
}
fs.writeFileSync('summary.json', JSON.stringify(out, null, 2))
console.log(out)
