// Будівник пояснювальної записки (docx-js).
// Параметри — методичні вказівки до КР з «Веб-технологій та веб-дизайну» (дод. Б, табл. Б.1)
// та Правила оформлення НУ «Одеська політехніка» (2025) там, де методичка не визначає параметр.
const fs = require('fs')
const path = require('path')
const d = require('docx')
const {
  Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun,
  Header, PageNumber, TabStopType, Tab, ShadingType, LineRuleType, VerticalAlign, PageBreak,
} = d

const MM = 56.7
const PAGE = { w: 11906, h: 16838 }
const MARGIN = { top: Math.round(20 * MM), bottom: Math.round(20 * MM), left: Math.round(25 * MM), right: Math.round(15 * MM) }
const TEXT_W = PAGE.w - MARGIN.left - MARGIN.right // 9638
const INDENT = 709 // 1,25 см
const LINE = 360 // міжрядковий 1,5
const BLANK = 420 // один порожній рядок 14 пт × 1,5
const FONT = 'Times New Roman'
const MONO = 'Courier New'
const SZ = 28 // 14 пт

// ---------- нумерація об'єктів і перехресні посилання ----------
const state = { chapter: 0, appendix: null, counters: {}, labels: {}, cites: [], citeIndex: {}, toc: [] }
function prefix() { return state.appendix ?? String(state.chapter) }
function nextNum(kind, label) {
  const key = kind + ':' + prefix()
  state.counters[key] = (state.counters[key] ?? 0) + 1
  const num = `${prefix()}.${state.counters[key]}`
  if (label) state.labels[label] = num
  return num
}

// Розмітка тексту: **жирний**, _курсив_, `код`, [@ключ] — посилання на джерело,
// {fig:x} {tab:x} {lst:x} {eq:x} {sc:x} — посилання на об'єкти (заповнюються після першого проходу)
function resolveRefs(text, labels) {
  return text
    .replace(/\{fig:([\w-]+)\}/g, (_, k) => 'рис. ' + (labels[k] ?? '?'))
    .replace(/\{tab:([\w-]+)\}/g, (_, k) => 'табл. ' + (labels[k] ?? '?'))
    .replace(/\{lst:([\w-]+)\}/g, (_, k) => 'лістинг ' + (labels[k] ?? '?'))
    .replace(/\{sc:([\w-]+)\}/g, (_, k) => 'сценарій ' + (labels[k] ?? '?'))
    .replace(/\{eq:([\w-]+)\}/g, (_, k) => '(' + (labels[k] ?? '?') + ')')
    .replace(/\{app:([\w-]+)\}/g, (_, k) => 'додаток ' + (labels[k] ?? '?'))
    .replace(/\{num:([\w-]+)\}/g, (_, k) => labels[k] ?? '?')
}
function cite(keys) {
  return keys.split(',').map((k) => k.trim()).map((k) => {
    if (!(k in state.citeIndex)) { state.cites.push(k); state.citeIndex[k] = state.cites.length }
    return state.citeIndex[k]
  })
}
function formatCites(nums) {
  const s = [...new Set(nums)].sort((a, b) => a - b)
  const parts = []
  for (let i = 0; i < s.length; i++) {
    let j = i
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++
    parts.push(j - i >= 2 ? `[${s[i]}]–[${s[j]}]` : s.slice(i, j + 1).map((n) => `[${n}]`).join(', '))
    i = j
  }
  return parts.join(', ')
}
function runs(text, opts = {}) {
  const t = resolveRefs(text, state.labels).replace(/\[@([^\]]+)\]/g, (_, keys) => formatCites(cite(keys)))
  const out = []
  const re = /(\*\*[^*]+\*\*|(?<![\w\/.])_[^_\s][^_]*_(?![\w])|`[^`]+`)/g
  let last = 0
  let m
  const base = { font: FONT, size: opts.size ?? SZ, bold: opts.bold, italics: opts.italics }
  while ((m = re.exec(t))) {
    if (m.index > last) out.push(new TextRun({ ...base, text: t.slice(last, m.index) }))
    const tok = m[0]
    if (tok.startsWith('**')) out.push(new TextRun({ ...base, text: tok.slice(2, -2), bold: true }))
    else if (tok.startsWith('_')) out.push(new TextRun({ ...base, text: tok.slice(1, -1), italics: true }))
    else out.push(new TextRun({ ...base, text: tok.slice(1, -1), font: MONO, size: (opts.size ?? SZ) - 2 }))
    last = m.index + tok.length
  }
  if (last < t.length) out.push(new TextRun({ ...base, text: t.slice(last) }))
  return out
}

const body = (extra = {}) => ({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { lineRule: 'auto', line: LINE, lineRule: LineRuleType.AUTO, before: 0, after: 0 },
  indent: { firstLine: INDENT },
  widowControl: true,
  ...extra,
})

// ---------- блоки ----------
const B = {}
let prevKind = null

B.p = (text, extra = {}) => new Paragraph({ ...body(extra), children: runs(text) })

// Структурний заголовок (ВСТУП, ВИСНОВКИ…) або заголовок розділу «1 НАЗВА»
B.h1 = (text, { chapter, appendix, noBreak, toc = true } = {}) => {
  if (toc) state.toc.push({ level: 1, text })
  if (chapter !== undefined) { state.chapter = chapter; state.appendix = null }
  if (appendix !== undefined) { state.appendix = appendix }
  prevKind = 'h1'
  return new Paragraph({
    heading: d.HeadingLevel.HEADING_1,
    pageBreakBefore: !noBreak,
    alignment: AlignmentType.CENTER,
    keepNext: true, keepLines: true,
    spacing: { lineRule: 'auto', line: LINE, before: 0, after: BLANK },
    children: [new TextRun({ text, font: FONT, size: SZ, bold: true })],
  })
}
// Заголовок додатка: «ДОДАТОК А» і з нового рядка назва
B.appendix = (letter, title, label) => {
  state.appendix = letter
  if (label) state.labels[label] = letter
  state.toc.push({ level: 1, text: 'ДОДАТОК ' + letter + ' ' + title, find: title })
  prevKind = 'h1'
  return [
    new Paragraph({ heading: d.HeadingLevel.HEADING_1, pageBreakBefore: true, alignment: AlignmentType.CENTER, keepNext: true,
      spacing: { lineRule: 'auto', line: LINE, before: 0, after: 0 }, children: [new TextRun({ text: 'ДОДАТОК ' + letter, font: FONT, size: SZ, bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { lineRule: 'auto', line: LINE, before: 0, after: BLANK },
      children: [new TextRun({ text: title, font: FONT, size: SZ, bold: true })] }),
  ]
}
B.h2 = (text) => {
  state.toc.push({ level: text.startsWith('Висновки до розділу') ? 3 : 2, text })
  const p = new Paragraph({
    heading: d.HeadingLevel.HEADING_2,
    alignment: AlignmentType.LEFT, keepNext: true, keepLines: true,
    indent: { firstLine: INDENT },
    spacing: { lineRule: 'auto', line: LINE, before: prevKind === 'h1' ? 0 : BLANK, after: BLANK },
    children: [new TextRun({ text, font: FONT, size: SZ, bold: true })],
  })
  prevKind = 'h2'
  return p
}
// Пункт: «1.2.1 Назва.» і текст з нового рядка
B.h3 = (text) => {
  prevKind = 'h3'
  return new Paragraph({ ...body(), keepNext: true, keepLines: true,
    children: [new TextRun({ text, font: FONT, size: SZ, bold: true })] })
}
// Висновки до розділу — оформлюються як підрозділ без номера
B.chapterConclusion = (n) => B.h2(`Висновки до розділу ${n}`)

B.list = (items, kind = 'dash') => items.map((it, i) => {
  const last = i === items.length - 1
  const mark = kind === 'none' ? '' : kind === 'dash' ? '– ' : kind === 'num' ? `${i + 1}) ` : `${'абвгдежиклмнп'[i]}) `
  let text = it.trim()
  if (kind !== 'none' && !/[.;:]$/.test(text)) text += last ? '.' : ';'
  return new Paragraph({ ...body(), children: runs(mark + text) })
})

B.figure = (file, caption, { label, widthMm = 165, source } = {}) => {
  const num = nextNum('fig', label)
  const img = fs.readFileSync(file)
  const { width, height } = pngSize(img)
  const wPx = Math.min(widthMm, 170) * 3.7795
  const hPx = wPx * height / width
  prevKind = 'fig'
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, keepLines: true, spacing: { lineRule: 'auto', line: 240, before: BLANK, after: 60 },
      children: [new ImageRun({ type: 'png', data: img, transformation: { width: Math.round(wPx), height: Math.round(hPx) } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, keepLines: true, spacing: { lineRule: 'auto', line: 276, before: 0, after: BLANK },
      children: runs(`Рисунок ${num} — ${caption}${source ? ` (джерело: ${source})` : ''}`, { size: 24 }) }),
  ]
}
function pngSize(buf) { return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) } }

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder }
B.table = (caption, header, rows, { label, widths, size = 24, headerBold = true, firstColBold = false } = {}) => {
  const num = nextNum('tab', label)
  const n = header.length
  const ws = widths ?? Array(n).fill(1)
  const total = ws.reduce((a, b) => a + b, 0)
  const cols = ws.map((w) => Math.floor(TEXT_W * w / total))
  cols[cols.length - 1] += TEXT_W - cols.reduce((a, b) => a + b, 0)
  const cell = (text, w, bold, shade) => new TableCell({
    borders, width: { size: w, type: WidthType.DXA },
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    shading: undefined,
    children: String(text).split('\n').map((line) => new Paragraph({
      spacing: { lineRule: 'auto', line: 240, before: 0, after: 0 }, alignment: AlignmentType.LEFT,
      children: runs(line, { size, bold }),
    })),
  })
  prevKind = 'tab'
  return [
    new Paragraph({ keepNext: true, keepLines: true, alignment: AlignmentType.LEFT, indent: { firstLine: INDENT },
      spacing: { lineRule: 'auto', line: LINE, before: BLANK, after: 0 }, children: runs(`Таблиця ${num} — ${caption}`) }),
    new Table({
      width: { size: TEXT_W, type: WidthType.DXA }, columnWidths: cols,
      rows: [
        new TableRow({ tableHeader: true, cantSplit: true, children: header.map((h, i) => cell(h, cols[i], headerBold, true)) }),
        ...rows.map((r) => new TableRow({ cantSplit: true,
          children: r.map((c, i) => cell(c, cols[i], firstColBold && i === 0, false)) })),
      ],
    }),
    new Paragraph({ spacing: { lineRule: 'auto', before: 0, after: 0, line: 240 }, children: [new TextRun({ text: '', size: 8 })] }),
  ]
}

// ---------- лістинги з підсвічуванням синтаксису ----------
const KW = {
  java: 'abstract|boolean|break|case|catch|class|else|extends|final|for|if|implements|import|int|interface|long|new|null|package|private|protected|public|record|return|static|switch|this|throw|throws|try|var|void|while|true|false',
  ts: 'async|await|break|case|const|else|export|false|for|from|function|if|import|interface|let|new|null|return|switch|true|type|undefined|while|try|catch',
  sql: 'ALTER|AND|AS|BIGINT|BIGSERIAL|BOOLEAN|BY|CHECK|CONSTRAINT|CREATE|DATE|DATERANGE|DEFAULT|EXCLUDE|EXISTS|EXTENSION|FROM|GENERATED|ALWAYS|STORED|IF|IN|INDEX|INTEGER|KEY|NOT|NULL|NUMERIC|ON|OR|PRIMARY|REFERENCES|SELECT|TABLE|USING|VARCHAR|WHERE|WITH|gist|select|from|where|and|in|exists',
}
function codeRuns(line, lang) {
  const kw = KW[lang] ? new RegExp(`^(?:${KW[lang]})\\b`) : null
  const out = []
  let i = 0
  const push = (text, color, extra = {}) => out.push(new TextRun({ text, font: MONO, size: 22, color, ...extra }))
  while (i < line.length) {
    const rest = line.slice(i)
    let m
    if ((m = /^(\/\/.*|--.*)/.exec(rest)) || (m = /^(\/\*.*?\*\/|\/\*\*?.*|\*.*\*\/|^\s*\*.*)/.exec(rest)) && (rest.trimStart().startsWith('/*') || rest.trimStart().startsWith('*'))) {
      push(m[0], '6A737D', { italics: true }); i += m[0].length; continue
    }
    if ((m = /^("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`[^`]*`)/.exec(rest))) { push(m[0], '067D17'); i += m[0].length; continue }
    if ((m = /^@\w+/.exec(rest))) { push(m[0], '9E880D'); i += m[0].length; continue }
    if (kw && (m = kw.exec(rest)) && !/\w/.test(line[i - 1] ?? '')) { push(m[0], '0033B3', { bold: true }); i += m[0].length; continue }
    if ((m = /^\d+(\.\d+)?/.exec(rest)) && !/\w/.test(line[i - 1] ?? '')) { push(m[0], '1750EB'); i += m[0].length; continue }
    if ((m = /^[A-Za-z_]\w*|^\s+|^./.exec(rest))) { push(m[0], '000000'); i += m[0].length; continue }
  }
  if (!out.length) push(' ', '000000')
  return out
}
const rule = { style: BorderStyle.SINGLE, size: 2, color: '000000', space: 4 }
B.code = (caption, code, { label, lang = 'java', file } = {}) => {
  const num = nextNum('lst', label)
  const lines = code.replace(/\t/g, '    ').replace(/\s+$/, '').split('\n')
  prevKind = 'code'
  return [
    new Paragraph({ keepNext: true, keepLines: true, indent: { firstLine: INDENT }, spacing: { lineRule: 'auto', line: LINE, before: BLANK, after: 60 },
      children: runs(`Лістинг ${num} — ${caption}${file ? ` (${file})` : ''}`) }),
    ...lines.map((ln, idx) => new Paragraph({
      keepNext: idx < lines.length - 1 && lines.length < 30, keepLines: true,
      spacing: { lineRule: 'auto', line: 240, before: 0, after: idx === lines.length - 1 ? BLANK : 0 },
      border: { top: rule, bottom: rule },
      children: codeRuns(ln, lang),
    })),
  ]
}

// Сценарій використання (структурні елементи напівжирні, з двокрапкою)
B.scenario = (caption, fields, { label } = {}) => {
  const num = nextNum('sc', label)
  prevKind = 'sc'
  const paras = []
  fields.forEach(([k, v], idx) => {
    const lines = Array.isArray(v) ? v : [v]
    const head = new Paragraph({ spacing: { lineRule: 'auto', line: LINE, before: 0, after: 0 }, alignment: AlignmentType.JUSTIFIED,
      border: { top: rule, bottom: rule }, keepLines: true,
      children: [new TextRun({ text: k + ': ', font: FONT, size: SZ, bold: true }), ...(Array.isArray(v) ? [] : runs(v))] })
    paras.push(head)
    if (Array.isArray(v)) lines.forEach((l) => paras.push(new Paragraph({ spacing: { lineRule: 'auto', line: LINE, before: 0, after: 0 },
      alignment: AlignmentType.JUSTIFIED, border: { top: rule, bottom: rule }, indent: { left: 284, hanging: 284 }, keepLines: true,
      children: runs(l) })))
    void idx
  })
  const last = paras[paras.length - 1]
  last.properties = last.properties // no-op; відступ після — окремим порожнім абзацом нижче
  return [
    new Paragraph({ keepNext: true, indent: { firstLine: INDENT }, spacing: { lineRule: 'auto', line: LINE, before: BLANK, after: 60 },
      children: runs(`Сценарій ${num} — ${caption}`) }),
    ...paras,
    new Paragraph({ spacing: { lineRule: 'auto', before: 0, after: 0, line: 240 }, children: [new TextRun({ text: '', size: 8 })] }),
  ]
}

// Формула: по центру, номер праворуч; пояснення «де …» з відступом 1,25 см
B.formula = (mathChildren, { label, explain = [] } = {}) => {
  const num = label === false ? null : nextNum('eq', label)
  prevKind = 'eq'
  const out = [new Paragraph({
    keepNext: explain.length > 0, spacing: { lineRule: 'auto', line: LINE, before: BLANK, after: explain.length ? BLANK : BLANK },
    tabStops: [{ type: TabStopType.CENTER, position: Math.round(TEXT_W / 2) }, { type: TabStopType.RIGHT, position: TEXT_W }],
    children: [new TextRun({ children: [new Tab()] }), new d.Math({ children: mathChildren }), ...(num ? [new TextRun({ children: [new Tab(), `(${num})`], font: FONT, size: SZ })] : [])],
  })]
  explain.forEach(([sym, text], i) => {
    out.push(new Paragraph({
      spacing: { lineRule: 'auto', line: LINE, before: 0, after: i === explain.length - 1 ? 0 : 0 }, alignment: AlignmentType.LEFT,
      indent: { left: INDENT, hanging: i === 0 ? INDENT : 0 },
      tabStops: [{ type: TabStopType.LEFT, position: INDENT }],
      children: [...(i === 0 ? [new TextRun({ children: ['де', new Tab()], font: FONT, size: SZ })] : []),
        new TextRun({ text: sym, font: FONT, size: SZ, italics: true }), ...runs(' — ' + text + (i === explain.length - 1 ? '.' : ';'))],
    }))
  })
  return out
}
const M = {
  r: (t, italic = true) => new d.MathRun(t),
  frac: (n, den) => new d.MathFraction({ numerator: n, denominator: den }),
  sub: (base, sub) => new d.MathSubScript({ children: base, subScript: sub }),
}

B.pageBreak = () => new Paragraph({ children: [new PageBreak()] })
B.center = (text, { bold, size = SZ, after = 0, before = 0, italics, upper } = {}) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { lineRule: 'auto', line: LINE, before, after },
  children: [new TextRun({ text: upper ? text.toUpperCase() : text, font: FONT, size, bold, italics })],
})
B.left = (text, { bold, size = SZ, after = 0, before = 0, indent = 0 } = {}) => new Paragraph({
  alignment: AlignmentType.LEFT, spacing: { lineRule: 'auto', line: LINE, before, after }, indent: { left: indent },
  children: runs(text, { size, bold }),
})

function header() {
  return new Header({ children: [new Paragraph({
    alignment: AlignmentType.RIGHT, indent: { right: -Math.round(5 * MM) },
    children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SZ })],
  })] })
}
const sectionProps = {
  page: {
    size: { width: PAGE.w, height: PAGE.h },
    margin: { ...MARGIN, header: Math.round(10 * MM), footer: Math.round(10 * MM) },
  },
  titlePage: true,
}
function document(children, { title }) {
  return new d.Document({
    creator: 'Татчук Нікіта', title, language: 'uk-UA',
    styles: {
      default: { document: { run: { font: FONT, size: SZ, language: { value: 'uk-UA' } }, paragraph: { spacing: { lineRule: 'auto', line: LINE } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: FONT, size: SZ, bold: true, color: '000000' }, paragraph: { spacing: { before: 0, after: BLANK }, keepNext: true, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: FONT, size: SZ, bold: true, color: '000000' }, paragraph: { spacing: { before: BLANK, after: BLANK }, keepNext: true, outlineLevel: 1 } },
      ],
    },
    sections: [{ properties: sectionProps, headers: { default: header(), first: new Header({ children: [new Paragraph({ children: [] })] }) }, children }],
  })
}

module.exports = { B, M, d, state, runs, document, TEXT_W, INDENT, LINE, BLANK, FONT, SZ, MM, resolveRefs, cite }
