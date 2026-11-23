// Збирання пояснювальної записки: node build.js
// Проходи: 0 — мітки, посилання, зміст; 1 — верстка зі змістом-заготовкою та вимірювання сторінок;
// 2 — остаточна верстка з номерами сторінок і обсягами; далі перевірка, що номери не змінилися.
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const L = require('./lib')
const { B, M, d, state, document, TEXT_W } = L
const sources = require('./sources')

process.chdir(__dirname)
const OUT = path.join(__dirname, 'out')
fs.mkdirSync(OUT, { recursive: true })
const NAME = 'Татчук_АІ-245_курсова_EquipRent'

const ch = [1, 2, 3, 4, 5].map((n) => require(`./chapters/ch${n}.js`))

function reset() {
  Object.assign(state, { chapter: 0, appendix: null, counters: {}, cites: [], citeIndex: {}, toc: [] })
}

function contents(toc, pages) {
  const { Paragraph, TextRun, TabStopType, AlignmentType } = d
  const leader = [{ type: TabStopType.RIGHT, position: TEXT_W, leader: 'dot' }]
  const ind = { 1: { left: 284, hanging: 284 }, 2: { left: 709, hanging: 425 }, 3: { left: 709, firstLine: 0 } }
  return [
    B.h1('ЗМІСТ', { toc: false }),
    ...toc.map((e, i) => new Paragraph({
      alignment: AlignmentType.LEFT, tabStops: leader, spacing: { lineRule: 'auto', line: 360 },
      indent: e.level === 1 ? ind[1] : e.level === 2 ? ind[2] : { left: 709 + 709 - 284, hanging: 0 },
      children: [new TextRun({ text: e.text, font: 'Times New Roman', size: 28 }), new TextRun({ text: '\t' + (pages ? pages[i] : '00'), font: 'Times New Roman', size: 28 })],
    })),
  ]
}

function build({ toc, pages, citedKeys }) {
  reset()
  const front = require('./chapters/front.js')(B, M, d)
  const body = [...front.intro]
  ch.forEach((f) => body.push(...f(B, M, d)))
  const back = require('./chapters/back.js')(B, M, d, { sources, citedKeys: citedKeys ?? [] })
  const children = [
    ...front.title, ...front.task, ...front.annotation, ...front.abstract,
    ...contents(toc ?? [], pages),
    ...front.abbreviations, ...body, ...back.conclusions, ...back.srcList, ...back.appendices,
  ]
  return { children, toc: state.toc.slice(), cites: state.cites.slice(), counters: { ...state.counters } }
}

async function write(children, file) {
  const doc = document(children, { title: 'Вебсистема оренди обладнання з календарем доступності' })
  fs.writeFileSync(file, await d.Packer.toBuffer(doc))
  execFileSync('python3', [path.join(__dirname, 'tools/fix-math.py'), file])
}

function toPdf(docx) {
  execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', OUT, docx], { stdio: 'ignore', timeout: 300000 })
  return docx.replace(/\.docx$/, '.pdf')
}

function pageTexts(pdf) {
  const n = Number(execFileSync('pdfinfo', [pdf]).toString().match(/Pages:\s+(\d+)/)[1])
  const txt = execFileSync('pdftotext', ['-layout', pdf, '-']).toString().split('\f')
  return txt.slice(0, n).map((t) => t.replace(/\s+/g, ' ').trim().replace(/^\d{1,3} /, ''))
}

const pl = (n, [one, few, many]) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many }
const locPages = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'сторінці' : 'сторінках')
const norm = (s) => s.replace(/\s+/g, ' ').trim()
function locate(toc, texts) {
  // Пошук починаємо після сторінок змісту: перша сторінка, що починається з «ПЕРЕЛІК СКОРОЧЕНЬ»
  let cur = texts.findIndex((t, i) => i > 2 && t.startsWith('ПЕРЕЛІК СКОРОЧЕНЬ'))
  if (cur < 0) throw new Error('Не знайдено початок основної частини')
  return toc.map((e) => {
    const needle = norm(e.find ?? e.text)
    for (let p = cur; p < texts.length; p++) {
      const hay = texts[p]
      const pos = hay.indexOf(needle)
      if (pos >= 0 && (e.level !== 1 || pos < 120)) { cur = p; return p + 1 }
    }
    throw new Error('Не знайдено заголовок: ' + e.text)
  })
}

;(async () => {
  // Прохід 0: мітки та порядок джерел
  let r = build({})
  r = build({ toc: r.toc, citedKeys: r.cites })
  const toc = r.toc
  const citedKeys = r.cites
  const unused = Object.keys(sources).filter((k) => !citedKeys.includes(k))
  if (unused.length) console.log('Джерела без посилань (не включено до переліку):', unused.join(', '))
  const missing = citedKeys.filter((k) => !(k in sources))
  if (missing.length) throw new Error('Немає опису джерел: ' + missing.join(', '))

  // Прохід 1: верстка з заготовкою змісту
  const draft = path.join(OUT, 'draft.docx')
  await write(build({ toc, citedKeys }).children, draft)
  let texts = pageTexts(toPdf(draft))
  let pages = locate(toc, texts)

  for (let attempt = 0; attempt < 3; attempt++) {
    // Обсяги для анотації
    const idx = (title) => toc.findIndex((e) => e.text === title)
    const total = texts.length
    const pIntro = pages[idx('ВСТУП')], pConcl = pages[idx('ВИСНОВКИ')], pSrc = pages[idx('ПЕРЕЛІК ДЖЕРЕЛ')]
    const pApp = pages[toc.findIndex((e) => e.text.startsWith('ДОДАТОК А'))]
    const count = (kind) => Object.entries(r.counters).filter(([k]) => k.startsWith(kind + ':')).reduce((a, [, v]) => a + v, 0)
    Object.assign(state.labels, {
      totalPages: String(total), mainPages: String(pSrc - pIntro), srcPages: String(pApp - pSrc), appPages: String(total - pApp + 1),
      srcCount: String(citedKeys.length), figCount: String(count('fig')), tabCount: String(count('tab')),
      mainLoc: locPages(pSrc - pIntro), srcLoc: locPages(pApp - pSrc), appLoc: locPages(total - pApp + 1),
      figWord: pl(count('fig'), ['рисунок', 'рисунки', 'рисунків']), tabWord: pl(count('tab'), ['таблицю', 'таблиці', 'таблиць']),
      srcWord: pl(citedKeys.length, ['найменування', 'найменування', 'найменувань']),
    })
    const file = path.join(OUT, NAME + '.docx')
    await write(build({ toc, pages, citedKeys }).children, file)
    const pdf = toPdf(file)
    texts = pageTexts(pdf)
    const again = locate(toc, texts)
    const stable = again.every((p, i) => p === pages[i]) && String(texts.length) === state.labels.totalPages
    pages = again
    console.log(`Прохід ${attempt + 2}: сторінок ${texts.length}; вступ ${pIntro}, висновки ${pConcl}, джерела ${pSrc}, додатки ${pApp}; основна частина ${pSrc - pIntro} с.; стабільно: ${stable}`)
    if (stable) {
      fs.writeFileSync(path.join(OUT, 'toc.json'), JSON.stringify(toc.map((e, i) => ({ ...e, page: pages[i] })), null, 1))
      fs.writeFileSync(path.join(OUT, 'stats.json'), JSON.stringify(state.labels, null, 1))
      fs.rmSync(draft, { force: true }); fs.rmSync(draft.replace('.docx', '.pdf'), { force: true })
      return
    }
  }
  throw new Error('Номери сторінок не стабілізувалися')
})().catch((e) => { console.error(e); process.exit(1) })
