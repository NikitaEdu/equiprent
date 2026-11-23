// Висновки, перелік джерел і додатки А–Е.
const fs = require('fs')
const path = require('path')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

module.exports = (B, M, d, { sources, citedKeys }) => {
  const { Paragraph, TextRun, AlignmentType } = d
  const MONO = 'Courier New'
  // Команди в інструкціях — моноширинний текст без підпису (це не лістинги програм)
  const cmd = (code) => code.replace(/\s+$/, '').split('\n').map((ln, i, a) => new Paragraph({
    keepNext: i < a.length - 1, keepLines: true, indent: { left: 709 },
    spacing: { lineRule: 'auto', line: 240, before: i === 0 ? 60 : 0, after: i === a.length - 1 ? 120 : 0 },
    children: [new TextRun({ text: ln || ' ', font: MONO, size: 22 })] }))

  // Мінімальний перетворювач Markdown → блоки записки (заголовки, абзаци, списки, таблиці, код)
  function md(text, { skipH1 = true, tableCaption } = {}) {
    const out = []
    const lines = text.replace(/\r/g, '').split('\n')
    let heading = ''
    let i = 0
    const inline = (s) => s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    while (i < lines.length) {
      const ln = lines[i]
      if (/^#\s/.test(ln)) { if (!skipH1) out.push(B.h3(ln.slice(2))); i++; continue }
      if (/^#{2,3}\s/.test(ln)) { heading = ln.replace(/^#+\s/, ''); out.push(B.h3(heading)); i++; continue }
      if (/^```/.test(ln)) {
        const buf = []; i++
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++])
        i++; out.push(...cmd(buf.join('\n'))); continue
      }
      if (/^\|/.test(ln)) {
        const rows = []
        while (i < lines.length && /^\|/.test(lines[i])) {
          if (!/^\|\s*-/.test(lines[i])) rows.push(lines[i].replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim())))
          i++
        }
        const cap = (tableCaption && tableCaption(heading)) || heading
        out.push(...B.table(cap, rows[0], rows.slice(1), {}))
        continue
      }
      if (/^\s*(\d+\.|-)\s/.test(ln)) {
        const kind = /^\s*\d+\./.test(ln) ? 'num' : 'dash'
        const seq = []
        let n = 0
        while (i < lines.length) {
          const l = lines[i]
          if (/^\s*(\d+\.|-)\s/.test(l)) { seq.push({ item: l.replace(/^\s*(\d+\.|-)\s/, ''), n: ++n }); i++ }
          else if (/^\s+```/.test(l)) {
            const buf = []; i++
            while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++].replace(/^\s{3}/, ''))
            i++; seq.push({ code: buf.join('\n') })
          } else if (/^\s{2,}\S/.test(l)) { seq[seq.length - 1].item += ' ' + l.trim(); i++ }
          else break
        }
        const items = seq.filter((x) => x.item !== undefined)
        seq.forEach((x) => {
          if (x.code !== undefined) { out.push(...cmd(x.code)); return }
          const last = x === items[items.length - 1]
          let txt = inline(x.item).trim()
          if (!/[.;:!?]$/.test(txt)) txt += last ? '.' : ';'
          out.push(...B.list([(kind === 'num' ? `${x.n}) ` : '– ') + txt], 'none'))
        })
        continue
      }
      if (/^>\s/.test(ln)) { out.push(B.p('**' + inline(ln.slice(2)).replace(/\*\*/g, '') + '**')); i++; continue }
      if (!ln.trim()) { i++; continue }
      const buf = [ln]; i++
      while (i < lines.length && lines[i].trim() && !/^(#|\||```|\s*(\d+\.|-)\s|>)/.test(lines[i])) buf.push(lines[i++])
      out.push(B.p(inline(buf.join(' '))))
    }
    return out
  }

  // ---------- Висновки ----------
  const conclusions = [
    B.h1('ВИСНОВКИ'),
        B.p('У роботі розроблено вебсистему оренди обладнання з календарем доступності; поставлені у вступі задачі виконано. Аналіз предметної області й трьох аналогів показав, що головна проблема прокату — подвійне бронювання фізичного предмета; сформульовано 24 функціональні та 11 нефункціональних вимог з умовами перевірки.'),
    B.p('Формалізовано модель часу з напіввідкритим інтервалом зайнятості й технічною перервою, правила тарифу та умову, за якої довша оренда не коштує менше за коротшу. Алгоритм календаря на основі масиву різниць має складність O(B + D) і на модельних даних (10⁵ інтервалів, 62 дні) працює приблизно в 37 разів швидше за наївний перебір; підбір екземпляра виконується за O(U + B).'),
    B.p('Спроєктовано модульний моноліт із сесійною автентифікацією, вісім екранів, модель даних із семи таблиць і програмний інтерфейс з форматом помилок RFC 9457. Ключове рішення — два незалежні механізми проти перетинів: песимістичне блокування екземплярів і обмеження EXCLUDE у PostgreSQL; контрольний експеримент показав, що без блокування перетинів не виникає, але клієнти отримують хибні відмови.'),
    B.p('Систему реалізовано на Spring Boot 4.1 і Java 21 та React 19 і TypeScript (реліз v1.0.0). Якість підтверджено 55 серверними, 6 клієнтськими і 15 наскрізними тестами (усі пройдено, покриття рядків серверного коду 82,2 %), аудитом доступності WCAG 2.2 A/AA без порушень після виправлень, а також експериментами на навчальному стенді: за 25 віртуальних користувачів p95 читання становив 39,1 мс без технічних помилок, конкурентний запис не залишив жодного перетину, а тестування обсягом 9693 бронювань виявило деградацію списку менеджера, яку усунули індекси, що зменшили медіанний час з 23,4 до 10,3 мс. Під час роботи зареєстровано й виправлено 14 дефектів.'),
    B.p('Обмеження результатів: вимірювання виконано на одному вузлі з двома ядрами, перевірено лише браузер Chrome, запуск через Docker на стенді не перевірено, зсув макета каталогу (CLS 0,113) перевищує ціль, а покриття гілок модулів керування каталогом низьке. Система є навчальним прототипом і не перевірялася в промисловій експлуатації.'),
    B.p('Напрями розвитку: онлайн-оплата і блокування застави, сповіщення про підтвердження й наближення строку повернення, черга очікування на зайняті дати, спільне сховище сесій і лічильників спроб входу для роботи кількох екземплярів застосунку, а також повторення вимірювань на окремих вузлах для генератора навантаження, застосунку та СКБД.'),
  ]

  // ---------- Перелік джерел ----------
  const srcList = [
    B.h1('ПЕРЕЛІК ДЖЕРЕЛ'),
    ...citedKeys.map((k, i) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { lineRule: 'auto', line: 360 }, indent: { firstLine: 709 },
      children: [new TextRun({ text: `${i + 1}. ${sources[k]}`, font: 'Times New Roman', size: 28 })] })),
  ]

  // ---------- Додаток А ----------
  const appA = [
    ...B.appendix('А', 'Інструкція користувача', 'user'),
    ...md(rd('docs/user-guide.md'), {
      tableCaption: (h) => ({ 'Хто що може робити': 'Дії за ролями', 'Стани бронювання': 'Стани бронювання', 'Типові повідомлення': 'Типові повідомлення та дії користувача' }[h]),
    }),
  ]

  appA.push(B.h3('Паспорти екранів'),
    ...B.table('Паспорти основних екранів', ['Екран', 'Ролі', 'Дані та дії', 'Стани'], [
    ['UI-01 Каталог', 'усі', 'пошук, категорія, порядок, сторінки по 12', 'завантаження (заготовки), порожній результат зі скиданням фільтрів, помилка з повтором'],
    ['UI-02 Картка обладнання', 'усі', 'календар місяця, вибір дат кліком або введенням, розрахунок, заявка', 'дати не обрано, розрахунок, немає вільного екземпляра, конфлікт 409, гість — пропозиція увійти'],
    ['UI-03 Вхід / реєстрація', 'гість', 'пошта, пароль, ім’я; підказка довжини пароля', 'помилки полів, блокування після 5 спроб'],
    ['UI-04 Мої бронювання', 'клієнт', 'список зі станами, сторінки', 'порожній список із переходом до каталогу'],
    ['UI-05 Бронювання', 'клієнт (власне), менеджер', 'умови, історія, дії залежно від стану й ролі', 'успіх дії, недозволений перехід, «не знайдено» для чужого'],
    ['UI-06 Заявки', 'менеджер', 'вкладки станів, пошук за клієнтом або номером, підтвердження', 'порожня черга, прострочене повернення'],
    ['UI-07 Обладнання', 'менеджер', 'часова діаграма екземплярів, стани екземплярів, редагування тарифів', 'помилки валідації тарифу'],
    ['UI-08 Звіт', 'менеджер', 'період, завантаженість і дохід за типами', 'порожній період'],
  ], { label: 'screens', widths: [2.2, 1.6, 3.4, 3.6], size: 22 }),
    B.h3('Основні екрани'),
    B.p('Нижче наведено екрани, на які посилається розділ 4: панель бронювання за відсутності вільного екземпляра, каталог, робоче місце менеджера та картку обладнання на вузькому екрані.'),
  ...B.figure('figures/ui-conflict.png', 'Панель бронювання за відсутності вільного екземпляра (стан UI-02)', { label: 'uiconflict', widthMm: 70 }),
  ...B.figure('figures/ui-catalog.png', 'Каталог обладнання (UI-01), ширина 1280 px', { label: 'uicatalog', widthMm: 160 }),
  ...B.figure('figures/ui-manager-queue.png', 'Черга заявок менеджера (UI-06)', { label: 'uiqueue', widthMm: 160 }),
  ...B.figure('figures/ui-mobile.png', 'Календар доступності на ширині 360 px', { label: 'uimobile', widthMm: 62 }),
  )

  // ---------- Додаток Б ----------
  const readme = rd('README.md')
  const sec = (src, from, to) => { const a = src.indexOf(from); const b = to ? src.indexOf(to, a + 1) : src.length; return src.slice(a, b) }
  const appB = [
    ...B.appendix('Б', 'Інструкція зі збирання, запуску та адміністрування', 'admin'),
    B.p('Інструкцію перевірено в середовищі Linux (див. 3.10); команди для Windows наведено там, де вони відрізняються. Робочий каталог зазначено перед кожною групою команд.'),
    ...md(sec(readme, '## Технології та перевірені версії', '## Документація'), {
      tableCaption: (h) => ({ 'Технології та перевірені версії': 'Перевірені версії засобів', 'Змінні середовища': 'Змінні середовища', 'Демонстраційні облікові записи': 'Демонстраційні облікові записи (лише навчальний стенд)' }[h]),
    }),
    ...md(rd('docs/admin-guide.md'), { tableCaption: (h) => ({ 'Небезпечні операції': 'Небезпечні операції' }[h]) }),
  ]

  // ---------- Додаток В: опис API ----------
  const api = JSON.parse(rd('docs/evidence/openapi.json'))
  const schemas = api.components.schemas
  const access = (p) => p.startsWith('/api/manager') ? 'менеджер' : p.startsWith('/api/auth') ? 'усі' : p.startsWith('/api/bookings') ? 'автентиф.' : 'усі'
  const errs = {
    'GET /api/equipment': '400 BAD_PAGE, BAD_PAGE_SIZE, BAD_SORT',
    'GET /api/equipment/{id}': '404',
    'GET /api/equipment/{id}/availability': '400 PERIOD_ORDER, PERIOD_TOO_LONG; 404',
    'GET /api/equipment/{id}/quote': '400 PERIOD_*; 404',
    'POST /api/bookings': '400 VALIDATION_FAILED, PERIOD_*; 401; 403; 404; 409 BOOKING_CONFLICT, NO_UNITS',
    'GET /api/bookings/my': '400 BAD_PAGE; 401',
    'GET /api/bookings/{id}': '401; 404',
    'POST /api/bookings/{id}/cancel': '404; 409 INVALID_TRANSITION, CANCEL_TOO_LATE',
    'POST /api/bookings/{id}/extend': '400 EXTEND_NOT_LATER, PERIOD_TOO_LONG; 404; 409 EXTEND_CONFLICT, INVALID_TRANSITION',
    'POST /api/manager/bookings/{id}/confirm': '404; 409 INVALID_TRANSITION, BOOKING_EXPIRED',
    'POST /api/manager/bookings/{id}/reject': '400 VALIDATION_FAILED; 404; 409 INVALID_TRANSITION',
    'POST /api/manager/bookings/{id}/cancel': '404; 409 INVALID_TRANSITION',
    'POST /api/manager/bookings/{id}/issue': '404; 409 INVALID_TRANSITION, ISSUE_DATE, UNIT_UNAVAILABLE',
    'POST /api/manager/bookings/{id}/return': '400 RETURN_DATE; 404; 409 INVALID_TRANSITION',
    'GET /api/manager/bookings': '400 BAD_PAGE',
    'GET /api/manager/equipment/{id}/timeline': '400 PERIOD_INVALID; 404',
    'GET /api/manager/reports/utilization': '400 PERIOD_ORDER, PERIOD_TOO_LONG',
    'POST /api/manager/equipment': '400 VALIDATION_FAILED, TARIFF_INVALID',
    'PUT /api/manager/equipment/{id}': '400 VALIDATION_FAILED, TARIFF_INVALID; 404; 409 CONCURRENT_MODIFICATION',
    'POST /api/manager/equipment/{id}/units': '400 VALIDATION_FAILED; 404; 409 INVENTORY_TAKEN',
    'PATCH /api/manager/units/{unitId}': '400 VALIDATION_FAILED; 404',
    'POST /api/auth/register': '400 VALIDATION_FAILED, WEAK_PASSWORD; 409 EMAIL_TAKEN',
    'POST /api/auth/login': '401 BAD_CREDENTIALS; 429 LOGIN_LOCKED',
  }
  const purpose = {
    'GET /api/categories': 'Перелік категорій', 'GET /api/equipment': 'Каталог: пошук, категорія, порядок, сторінки',
    'GET /api/equipment/{id}': 'Картка типу обладнання з тарифом', 'GET /api/equipment/{id}/availability': 'Вільні екземпляри по днях (≤ 62 дні)',
    'GET /api/equipment/{id}/quote': 'Розрахунок і доступність періоду', 'POST /api/bookings': 'Створення бронювання',
    'GET /api/bookings/my': 'Власні бронювання', 'GET /api/bookings/{id}': 'Бронювання з історією (власне або будь-яке для менеджера)',
    'POST /api/bookings/{id}/cancel': 'Скасування', 'POST /api/bookings/{id}/extend': 'Продовження',
    'GET /api/manager/bookings': 'Список із фільтрами стану, типу, пошуку', 'POST /api/manager/bookings/{id}/confirm': 'Підтвердження',
    'POST /api/manager/bookings/{id}/reject': 'Відхилення з причиною', 'POST /api/manager/bookings/{id}/cancel': 'Скасування менеджером',
    'POST /api/manager/bookings/{id}/issue': 'Видача', 'POST /api/manager/bookings/{id}/return': 'Повернення, плата за запізнення',
    'GET /api/manager/equipment/{id}/timeline': 'Часова діаграма екземплярів', 'GET /api/manager/reports/utilization': 'Звіт завантаженості',
    'POST /api/manager/equipment': 'Створення типу обладнання', 'GET /api/manager/equipment/{id}': 'Тип для редагування',
    'PUT /api/manager/equipment/{id}': 'Зміна типу і тарифу', 'POST /api/manager/equipment/{id}/archive': 'Приховати з каталогу',
    'POST /api/manager/equipment/{id}/restore': 'Повернути в каталог', 'GET /api/manager/equipment/{id}/units': 'Екземпляри типу',
    'POST /api/manager/equipment/{id}/units': 'Додавання екземпляра', 'PATCH /api/manager/units/{unitId}': 'Робочий стан екземпляра',
    'GET /api/auth/csrf': 'Видача токена CSRF', 'GET /api/auth/me': 'Поточний користувач (204 для гостя)',
    'POST /api/auth/register': 'Реєстрація клієнта', 'POST /api/auth/login': 'Вхід',
  }
  const ops = []
  for (const [p, o] of Object.entries(api.paths)) for (const [m, op] of Object.entries(o)) {
    const key = `${m.toUpperCase()} ${p}`
    const params = (op.parameters ?? []).map((x) => x.in === 'path' ? `{${x.name}}` : x.name + (x.required ? '*' : '')).filter((x) => !x.startsWith('{')).join(', ')
    const body = (op.requestBody?.content?.['application/json']?.schema?.$ref ?? '').split('/').pop()
    ops.push([key, purpose[key] ?? '', access(p), [params, body && 'тіло ' + body].filter(Boolean).join('; ') || '—',
      Object.keys(op.responses).join(', '), errs[key] ?? '404 для неіснуючого ресурсу'])
  }
  ops.push(['POST /api/auth/logout', 'Вихід, знищення сесії', 'автентиф.', '—', '204', '—'])
  const order = (k) => ['/api/categories', '/api/equipment', '/api/bookings', '/api/manager/bookings', '/api/manager/equipment', '/api/manager/units', '/api/manager/reports', '/api/auth']
    .findIndex((pfx) => k.split(' ')[1].startsWith(pfx))
  ops.sort((a, b) => order(a[0]) - order(b[0]) || a[0].split(' ')[1].localeCompare(b[0].split(' ')[1]))
  const fieldRows = (name) => Object.entries(schemas[name].properties).map(([k, v]) => {
    const req = (schemas[name].required ?? []).includes(k)
    const type = v.type === 'array' ? `масив ${(v.items?.$ref ?? '').split('/').pop()}` : (v.type ?? '') + (v.format ? ` (${v.format})` : '')
    const lim = [v.minLength ? `довжина ≥ ${v.minLength}` : '', v.maxLength ? `довжина ≤ ${v.maxLength}` : '', v.minimum !== undefined ? `≥ ${v.minimum}` : '',
      v.maximum !== undefined ? `≤ ${v.maximum}` : '', v.enum ? v.enum.join(' | ') : ''].filter(Boolean).join('; ')
    return [`${name}.${k}`, type, req ? 'так' : 'ні', lim || '—']
  })
  const ex = rd('docs/evidence/api-examples.txt')
  const exBlock = (title) => { const s = ex.indexOf('### ' + title); const e = ex.indexOf('###', s + 4); return ex.slice(s, e < 0 ? undefined : e).split('\n').slice(1).filter((l) => l.trim() && !l.startsWith('---')) }
  const pretty = (line) => line.startsWith('{') ? JSON.stringify(JSON.parse(line), null, 2) : line
  const appV = [
    ...B.appendix('В', 'Опис програмного інтерфейсу', 'api'),
    B.p('Базова адреса — корінь застосунку (типово http://localhost:8080). Формат даних — JSON у кодуванні UTF-8, дати — ISO 8601 (YYYY-MM-DD). Автентифікація — сесійне cookie JSESSIONID, яке встановлюється після POST /api/auth/login. Для методів, що змінюють стан, потрібен заголовок X-XSRF-TOKEN зі значенням cookie XSRF-TOKEN (отримується запитом GET /api/auth/csrf). Машинний опис OpenAPI 3.1 доступний за адресою /v3/api-docs, інтерактивний — /swagger-ui.html.'),
    B.p('Перелік операцій наведено в табл. В.1. Позначка * — обов’язковий параметр запиту. Окрім зазначених, будь-яка операція може повернути 401 (немає сесії для захищеного маршруту), 403 (бракує ролі або токена CSRF) і 500 (неочікувана помилка, без внутрішніх подробиць).'),
    ...B.table('Операції програмного інтерфейсу', ['Метод і маршрут', 'Призначення', 'Доступ', 'Параметри / тіло', 'Успіх', 'Відмови (HTTP і code)'], ops,
      { widths: [3.3, 2.6, 1.3, 2.2, 0.9, 3.1], size: 18 }),
    B.p('Поля тіл запитів наведено в табл. В.2. Обмеження перевіряються на сервері (Bean Validation); порушення повертається як 400 VALIDATION_FAILED зі списком fieldErrors.'),
    ...B.table('Поля тіл запитів', ['Поле', 'Тип', 'Обов’язкове', 'Обмеження'],
      ['CreateBookingRequest', 'ExtendRequest', 'RejectRequest', 'ReturnRequest', 'RegisterRequest', 'LoginRequest', 'EquipmentTypeRequest', 'TariffTierRequest', 'UnitRequest', 'UnitStatusRequest'].flatMap(fieldRows),
      { widths: [4.2, 2.2, 1.4, 3], size: 20 }),
    B.p('Усі помилки мають формат Problem Details (RFC 9457) з медіатипом application/problem+json і додатковими полями code та fieldErrors. Нижче наведено фактичні відповіді, отримані від застосунку скриптом docs/thesis/tools/api-examples.sh.'),
    B.p('Успішне створення бронювання (201 Created):'),
    ...cmd(exBlock('POST /api/bookings\n').map(pretty).join('\n').split('\n').slice(0, 40).join('\n')),
    B.p('Вільних екземплярів на обрані дати немає (409 Conflict):'),
    ...cmd(exBlock('POST /api/bookings (ті самі').map(pretty).join('\n')),
    B.p('Порушено обов’язковість полів (400 Bad Request):'),
    ...cmd(exBlock('POST /api/bookings (без').map(pretty).join('\n')),
  ]

  // ---------- Додаток Г: протоколи ----------
  const prot = JSON.parse(rd('docs/evidence/test-protocol.json'))
  const env = JSON.parse(rd('loadtest/results/read-scenario.json')).environment
  const rows = (list) => list.map((t) => [t.name, t.status, String(t.timeSec).replace('.', ',')])
  const appG = [
    ...B.appendix('Г', 'Протоколи перевірок', 'tests'),
    B.p(`Об’єкт перевірки — реліз v1.0.0. Середовище: ${env.os}, ${env.cores} ядра ${env.cpu}, ${env.memoryGb} ГБ пам’яті; ${env.java}; ${env.postgres.replace('psql ', '')}; Node.js ${env.node.replace('v', '')}; Google Chrome 153. Дата виконання — 22.11.2026. Протокол сформовано автоматично зі звітів JUnit (каталог backend/target), Vitest і Playwright скриптом docs/thesis/tools/test-protocol.py; вихідні звіти та результати експериментів збережено в каталогах docs/evidence і loadtest/results.`),
  ...B.table('Матриця простежуваності вимог і тестів', ['Вимога', 'Тест-кейси', 'Результат'], [
    ['FR-CAT-01…03', 'TC-SEC-01, TC-CAT-01, TC-E2E-01', 'Пройдено'],
    ['FR-AV-01…03', 'TC-AV-01…05, TC-AV-08, TC-BOOK-03, TC-E2E-02', 'Пройдено'],
    ['FR-PRICE-01…03', 'TC-PRICE-01…05, TC-FE-02, TC-E2E-01', 'Пройдено'],
    ['FR-BOOK-01', 'TC-BOOK-01, TC-AV-06, TC-AV-07, TC-E2E-01', 'Пройдено'],
    ['FR-BOOK-02', 'TC-BOOK-02, TC-BOOK-04, TC-CONC-01…03, TC-E2E-03', 'Пройдено'],
    ['FR-BOOK-03', 'TC-BOOK-05, TC-E2E-04, TC-FE-03', 'Пройдено'],
    ['FR-MY-01…03', 'TC-ACCESS-02, TC-BOOK-07, TC-BOOK-08', 'Пройдено'],
    ['FR-MGR-01…04', 'TC-FLOW-01, TC-FLOW-02, TC-PRICE-04, TC-E2E-05, TC-E2E-06, TC-E2E-08', 'Пройдено'],
    ['FR-ADM-01, FR-ADM-02', 'TC-PRICE-06…08, TC-AV-08, TC-E2E-08', 'Пройдено частково: форми керування каталогом перевірено вручну'],
    ['FR-REP-01', 'TC-REP-01, TC-REP-02', 'Пройдено'],
    ['FR-AUTH-01, FR-AUTH-02', 'TC-AUTH-01, TC-AUTH-02, TC-E2E-09', 'Пройдено'],
    ['NFR-SEC-01…03', 'TC-SEC-02…07, TC-ACCESS-02, TC-PWD-01…03, TC-E2E-07', 'Пройдено'],
    ['NFR-DATA-01, NFR-DATA-02', 'TC-CONC-01…03, TC-BOOK-09, сценарій запису (5.6), перевірка перезапуску', 'Пройдено'],
    ['NFR-PERF-01, NFR-PERF-02', 'Навантажувальний експеримент (5.6), тест обсягом даних (5.7)', 'Пройдено на стенді'],
    ['NFR-UI-01…03', 'TC-A11Y-01…03, TC-RESP-360/768/1280', 'Пройдено (автоматичний аудит і ручна перевірка)'],
    ['NFR-RUN-01', 'Запуск за README на порожній базі', 'Пройдено для штатного запуску; Docker не перевірено'],
  ], { label: 'trace', widths: [2.4, 5, 2.4], size: 22 }),
    B.p('Журнал дефектів, зареєстрованих під час тестування, наведено в табл. Г.2; повні описи з кроками відтворення — у файлі docs/evidence/defects.md.'),
  ...B.table('Журнал дефектів (скорочено)', ['ID', 'Як виявлено', 'Суть', 'Вплив', 'Виправлення'], [
    ['DEF-01', 'Перший запуск інтеграційних тестів', 'PostgreSQL 16 відхиляє застарілий пояс Europe/Kiev, переданий JVM', 'Критичний', 'Процес працює в UTC, «сьогодні» — через Clock із поясом Europe/Kyiv'],
    ['DEF-02', 'Перевірка схеми Hibernate', 'SMALLINT у схемі проти int у сутностях', 'Критичний', 'Типи стовпців — INTEGER'],
    ['DEF-03', 'TC-SEC-01', 'Каталог без фільтрів повертав 500', 'Високий', 'Порожні специфікації відкидаються'],
    ['DEF-04', 'TC-SEC-06', 'Помилки валідації без code і fieldErrors', 'Середній', 'Власний обробник замість вбудованого'],
    ['DEF-05', 'TC-FLOW-01', 'Неточний код помилки при недопустимому переході', 'Низький', 'Перехід перевіряється до дат'],
    ['DEF-06', 'TC-AUTH-01', 'Тестова інфраструктура не перевіряла справжній потік CSRF', 'Хибна відмова тесту', 'Окремий тест зі справжнім HTTP-клієнтом'],
    ['DEF-07', 'Консоль браузера', 'CSP блокувала вбудовані шрифти', 'Середній', 'Шрифти окремими файлами, font-src'],
    ['DEF-08', 'Консоль браузера', '401 для гостя на кожній сторінці', 'Низький', '204 для гостя'],
    ['DEF-09', 'TC-A11Y-01', 'Контраст тексту 3,75–4,03 : 1', 'Середній', 'Кольори затемнено до ≥ 4,5 : 1'],
    ['DEF-10', 'TC-A11Y-01', 'Доступне ім’я кнопок дня не містить видимого тексту', 'Середній', 'Видимий текст + прихований опис'],
    ['DEF-11', 'Lighthouse', 'Послідовне завантаження, зсув макета', 'Середній', 'Паралельні запити, заготовки'],
    ['DEF-12', 'Lighthouse', 'Відповіді без стиснення, зайвий код', 'Середній', 'gzip, окремі частини коду'],
    ['DEF-13', 'Ручна оцінка результатів axe', 'Контраст підписів часової діаграми 2,95–4,04 : 1', 'Середній', 'Темніші кольори станів, підпис у межах оренди'],
    ['DEF-14', 'Ручна оцінка результатів axe', 'Посилання aria-describedby на відсутні елементи; aria-label без ролі', 'Низький', 'Посилання лише за наявності помилки; role="region"'],
  ], { label: 'defects', widths: [1.2, 2, 3, 1.5, 2.9], size: 20 }),
    B.p('Протокол навантажувального експерименту (розділ 5.6) наведено в табл. Г.3.'),
    ...B.table('Протокол навантажувального експерименту', ['Параметр', 'Значення'], [
    ['Стенд і дані', 'Див. 3.10; демонстраційний набір: 16 типів, 38 екземплярів'],
    ['Сценарій читання', 'Сторінка каталогу, календар місяця й розрахунок для випадкового типу; без пауз; прогрів 60 с; три рівні — 5, 10, 25 користувачів по 180 с'],
    ['Сценарій запису', '10 користувачів протягом 60 с створюють бронювання на випадкові типи й періоди в межах 170 днів'],
    ['Пороги', 'p95 ≤ 800 мс; частка технічних помилок (5xx, мережеві) < 1 %; відповіді 409 — очікуваний бізнес-результат'],
    ['Контроль коректності', 'Закон Літтла; перевірка перетинів у БД після запису'],
  ], { label: 'loadproto', widths: [2.6, 7] }),
    B.p('Результати автоматизованих тестів релізу v1.0.0 наведено в табл. Г.4–Г.7.'),
    ...B.table('Модульні тести серверної частини (JUnit 5)', ['Тест-кейс', 'Результат', 'Час, с'], rows(prot.unit), { widths: [7.6, 1.3, 0.8], size: 20 }),
    ...B.table('Інтеграційні тести (Spring Boot Test, PostgreSQL 16)', ['Тест-кейс', 'Результат', 'Час, с'], rows(prot.integration), { widths: [7.6, 1.3, 0.8], size: 20 }),
    ...B.table('Модульні тести клієнтської частини (Vitest)', ['Тест-кейс', 'Результат', 'Час, с'], rows(prot.vitest), { widths: [7.6, 1.3, 0.8], size: 20 }),
    ...B.table('Наскрізні тести (Playwright, Chrome)', ['Тест-кейс', 'Результат', 'Час, с'], rows(prot.e2e), { widths: [7.6, 1.3, 0.8], size: 20 }),
    B.p('Результати нефункціональних перевірок (навантаження, обсяг даних, Lighthouse, перевірка після перезапуску, контрольний експеримент без блокування) наведено в розділі 5; первинні дані у форматі JSON і CSV — у каталогах loadtest/results і docs/evidence.'),
  ]

  // ---------- Додаток Д: лістинги ----------
  const method = (file, sig) => {
    const src = rd(file).split('\n')
    let i = src.findIndex((l) => l.includes(sig))
    while (i > 0 && /^\s*(@|\*|\/\*\*)/.test(src[i - 1])) i--
    const out = []
    let depth = 0, started = false
    for (let k = i; k < src.length; k++) {
      out.push(src[k])
      for (const ch of src[k].replace(/"(?:[^"\\]|\\.)*"/g, '')) { if (ch === '{') { depth++; started = true } else if (ch === '}') depth-- }
      if (started && depth === 0) break
    }
    const ind = Math.min(...out.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length))
    return out.map((l) => l.slice(ind)).join('\n')
  }
  const appD = [
    ...B.appendix('Д', 'Блок-схема алгоритму та лістинги ключових модулів', 'listings'),
    B.p('Блок-схему атомарного створення бронювання (розділ 2.4) наведено на {fig:atomicflow}.'),
    ...B.figure('figures/atomic-flow.png', 'Блок-схема атомарного створення бронювання', { label: 'atomicflow', widthMm: 105 }),
    B.p('Нижче наведено повні тексти методів, на яких ґрунтуються гарантії системи. Повний код міститься в репозиторії (тег v1.0.0).'),
    ...B.code('Обчислення кількості вільних екземплярів по днях', method('backend/src/main/java/ua/opu/equiprent/availability/AvailabilityCalculator.java', 'public static int[] dailyFree'), { file: 'AvailabilityCalculator.java' }),
    ...B.code('Підбір екземпляра за мінімальним простоєм', method('backend/src/main/java/ua/opu/equiprent/availability/AvailabilityCalculator.java', 'public static Optional<Long> chooseUnit'), { file: 'AvailabilityCalculator.java' }),
    ...B.code('Додавання CSRF-токена та розбір помилок у клієнті', method('frontend/src/lib/api.ts', 'async function request<T>'), { label: 'apits', lang: 'ts', file: 'api.ts' }),
  ...B.code('Перевірка переходу стану та запис історії', [
    'void transition(BookingStatus target, BookingEventType eventType, AppUser actor, String note, Instant now) {',
    '    if (!status.canTransitionTo(target)) {',
    '        throw ApiException.conflict("INVALID_TRANSITION", "Неможливо змінити стан бронювання з «"',
    '                + BookingLabels.status(status) + "» на «" + BookingLabels.status(target) + "»");',
    '    }',
    '    BookingStatus from = status;',
    '    status = target;',
    '    updatedAt = now;',
    '    events.add(new BookingEvent(this, eventType, from, target, actor, note, now));',
    '}',
  ].join('\n'), { label: 'transition', file: 'Booking.java' }),
    ...B.code('Перевірка коректності тарифної сітки', method('backend/src/main/java/ua/opu/equiprent/pricing/PricingService.java', 'public void validateTiers'), { file: 'PricingService.java' }),
    ...B.code('Перетворення порушення обмеження EXCLUDE на конфлікт 409', method('backend/src/main/java/ua/opu/equiprent/common/GlobalExceptionHandler.java', 'public ProblemDetail handleIntegrity'), { file: 'GlobalExceptionHandler.java' }),
    ...B.code('Міграція V2: індекси для списку бронювань менеджера', rd('backend/src/main/resources/db/migration/V2__booking_list_indexes.sql').trim(), { lang: 'sql', file: 'V2__booking_list_indexes.sql' }),
  ]

  return { conclusions, srcList, appendices: [...appA, ...appB, ...appV, ...appG, ...appD] }
}
