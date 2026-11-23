// Титульний аркуш, завдання, анотації, перелік скорочень, вступ.
// Невідомі реквізити позначено підкресленням «____» — їх заповнює здобувач.
const META = require('../meta')

module.exports = (B, M, d) => {
  const { Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, PageBreak } = d
  const F = 'Times New Roman'
  const t = (text, o = {}) => new TextRun({ text, font: F, size: o.size ?? 28, bold: o.bold, italics: o.italics, underline: o.underline })
  const P = (children, o = {}) => new Paragraph({ alignment: o.align ?? AlignmentType.CENTER, spacing: { lineRule: 'auto', line: o.line ?? 360, before: o.before ?? 0, after: o.after ?? 0 },
    indent: o.indent, pageBreakBefore: o.pageBreakBefore, keepNext: o.keepNext, children: Array.isArray(children) ? children : [children] })
  const empty = (n = 1) => Array.from({ length: n }, () => P(t('')))

  // ---------- Титульний аркуш (додаток В методичних вказівок + реквізит інституту) ----------
  const title = [
    P(t('МІНІСТЕРСТВО ОСВІТИ І НАУКИ УКРАЇНИ', { bold: true, size: 24 })),
    P(t('НАЦІОНАЛЬНИЙ УНІВЕРСИТЕТ «ОДЕСЬКА ПОЛІТЕХНІКА»', { bold: true })),
    P(t('Навчально-науковий інститут комп’ютерних систем')),
    P(t('Кафедра інформаційних систем')),
    ...empty(4),
    P(t('КУРСОВА РОБОТА', { bold: true, size: 32 })),
    P(t('з дисципліни «Веб-технології та веб-дизайн»')),
    P(t('на тему:')),
    P(t(`«${META.topic}»`, { bold: true })),
    ...empty(3),
    P([t('Спеціальність: ', { italics: true }), t(META.specialty)], { align: AlignmentType.LEFT }),
    P([t('Освітня програма: ', { italics: true }), t(META.program)], { align: AlignmentType.LEFT }),
    P([t('Виконав: ', { italics: true }), t(`здобувач групи ${META.group}`)], { align: AlignmentType.LEFT }),
    P(t(`ПІБ ${META.studentFull}`), { align: AlignmentType.LEFT }),
    P(t('Підпис ____________________  Дата ____________________'), { align: AlignmentType.LEFT }),
    ...empty(1),
    P([t('Керівник: ', { italics: true }), t(META.supervisor)], { align: AlignmentType.LEFT }),
    P(t('Підпис ____________________  Дата ____________________'), { align: AlignmentType.LEFT }),
    ...empty(6),
    P(t(`Одеса — ${META.year}`)),
  ]

  // ---------- Завдання (додаток Г методичних вказівок) ----------
  const bd = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const borders = { top: bd, bottom: bd, left: bd, right: bd }
  const W = 9638
  const ftable = (rows, widths) => {
    const cols = widths.map((w) => Math.round(W * w))
    cols[cols.length - 1] += W - cols.reduce((a, b) => a + b, 0)
    return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: cols,
      rows: rows.map((r, ri) => new TableRow({ cantSplit: true, tableHeader: ri === 0 && r.header,
        children: (r.cells ?? r).map((c, i) => new TableCell({ borders, width: { size: cols[i], type: WidthType.DXA },
          margins: { top: 30, bottom: 30, left: 80, right: 80 },
          children: String(c).split('\n').map((ln) => new Paragraph({ spacing: { lineRule: 'auto', line: 240 }, children: [t(ln, { size: 24, bold: r.header })] })) })) })) })
  }
  const L = (text, o = {}) => P(Array.isArray(text) ? text : [t(text, o)], { align: AlignmentType.LEFT, before: o.before, after: o.after })
  const task = [
    P(t('Національний університет «Одеська політехніка»'), { pageBreakBefore: true }),
    P(t('Кафедра інформаційних систем')),
    P(t('ЗАВДАННЯ НА КУРСОВУ РОБОТУ', { bold: true })),
    P(t('з дисципліни «Веб-технології та веб-дизайн»'), { after: 120 }),
    L(`Здобувач ${META.studentFull}`),
    L(`Група ${META.group}    Спеціальність / освітня програма ${META.specialtyShort}`),
    L(`Керівник ${META.supervisor}`),
    L('1. Тема роботи', { bold: true, before: 120 }),
    L(`«${META.topic}»`),
    L('2. Мета, користувачі та вихідні дані', { bold: true, before: 120 }),
    ftable([
      ['Мета розроблення', 'Вебсистема, у якій клієнт бачить кількість вільних екземплярів обладнання на кожен день, отримує розрахунок і створює заявку, а система гарантує відсутність перетину оренд одного екземпляра'],
      ['Ролі користувачів', 'Гість, клієнт, менеджер'],
      ['Основні дані та джерела', 'Категорії, типи обладнання, фізичні екземпляри, ступінчасті тарифи, бронювання та їхня історія; демонстраційні дані синтетичні'],
      ['Обов’язковий наскрізний сценарій', 'Вибір обладнання → календар доступності → розрахунок → заявка → підтвердження менеджером → видача → повернення з платою за запізнення'],
      ['Погоджене ускладнення', 'Технічна перерва після оренди; контроль конкурентних бронювань (блокування + обмеження БД); тестування навантаженням і обсягом даних'],
      ['Поза межами роботи', 'Онлайн-оплата і стягнення застави, сповіщення електронною поштою, черга очікування, мобільний застосунок'],
    ], [0.3, 0.7]),
    L('3. Строки', { bold: true, before: 120 }),
    L('Дата видачі ____________  Термін подання роботи ____________'),
    L('Дата захисту ____________  Формат демонстрації: запуск застосунку та показ основного сценарію'),

    P(t('ПРОДОВЖЕННЯ ЗАВДАННЯ НА КУРСОВУ РОБОТУ', { bold: true }), { pageBreakBefore: true, after: 120 }),
    L(`Здобувач ${META.studentFull}    Група ${META.group}`),
    L('4. Обов’язкові функції та критерії приймання', { bold: true, before: 120 }),
    ftable([
      { header: true, cells: ['Код / функція', 'Очікуваний результат і спосіб перевірки'] },
      ['FR-AV / календар', 'Кількість вільних екземплярів на кожен день з урахуванням перерви й ремонту; модульні та інтеграційні тести'],
      ['FR-PRICE / розрахунок', 'Межі періоду включні, ступінчастий тариф, застава окремо; модульні тести формул'],
      ['FR-BOOK / бронювання', 'Рівно одне бронювання вільного екземпляра; за перетину — 409 без часткового запису; конкурентні тести'],
      ['FR-MY / власні бронювання', 'Клієнт бачить, скасовує й продовжує лише власні бронювання; тести з двома обліковими записами'],
      ['FR-MGR / обробка', 'Підтвердження, відхилення, видача, повернення з платою за запізнення; наскрізні тести'],
      ['NFR-SEC / безпека', 'Ізоляція даних користувачів, Argon2id, захист від CSRF; інтеграційні тести через HTTP'],
      ['NFR-PERF / швидкодія', 'p95 читання ≤ 800 мс за 25 користувачів; за 10 000 бронювань p95 ≤ 500 мс; експерименти на стенді'],
      ['NFR-UI / інтерфейс', 'WCAG 2.2 AA, робота з клавіатури, ширини 360–1280 px; аудит axe і наскрізні тести'],
    ], [0.3, 0.7]),
    L('Стек: React і TypeScript, Java 21 і Spring Boot, PostgreSQL 16; запуск за README або Docker Compose.'),
    L('5. Зміст пояснювальної записки та графічні матеріали', { bold: true, before: 120 }),
    L('Аналіз і вимоги; алгоритмічне забезпечення; проєктування; реалізація; забезпечення якості; висновки; джерела; додатки.'),
    L('Схеми: прецедентів, C4, розгортання, шарів, послідовності, ER-модель, класів, блок-схема; у записці та електронно. Аркуш А1: ______'),
    L('6. Календарний план і комплект подання', { bold: true, before: 120 }),
    ftable([
      { header: true, cells: ['Етап', 'Термін', 'Результат / позначка керівника'] },
      ['Аналіз і проєктування', '________', ''],
      ['Реалізація сценаріїв', '________', ''],
      ['Тестування й виправлення', '________', ''],
      ['Оформлення та подання', '________', ''],
    ], [0.4, 0.2, 0.4]),
    L('Репозиторій: архів Git-репозиторію з тегом v1.0.0; ', { before: 60 }),
    L('Завдання видав ________________  Дата ____________', { before: 60 }),
    L('Завдання прийняв ________________  Дата ____________'),
  ]

  // ---------- Анотації ----------
  const kwUa = 'вебсистема, оренда обладнання, календар доступності, бронювання, конкурентний доступ, React, Spring Boot, PostgreSQL'
  const kwEn = 'web system, equipment rental, availability calendar, booking, concurrency control, React, Spring Boot, PostgreSQL'
  const annotation = [
    B.h1('АНОТАЦІЯ', { toc: false }),
    B.p(`${META.studentShort} ${META.topic} : курсова робота з дисципліни «Веб-технології та веб-дизайн» / ${META.studentFull} ; керівник ${META.supervisorBib}. — Одеса : Нац. ун-т «Одес. політехніка», ${META.year}. — {num:totalPages} с.`),
    B.p('Курсова робота містить основну текстову частину на {num:mainPages} {num:mainLoc}, {num:figCount} {num:figWord}, {num:tabCount} {num:tabWord}, перелік джерел із {num:srcCount} {num:srcWord} на {num:srcPages} {num:srcLoc}, додатки на {num:appPages} {num:appLoc}.'),
    B.p('Розроблено вебсистему оренди обладнання, у якій клієнт бачить кількість вільних фізичних екземплярів на кожен день, отримує розрахунок за ступінчастим тарифом і надсилає заявку, а менеджер підтверджує, видає й приймає обладнання. Формалізовано модель часу з технічною перервою, запропоновано алгоритм календаря за методом різницевого масиву зі складністю O(B + D) і правило підбору екземпляра за мінімальним простоєм. Відсутність перетинів гарантовано поєднанням песимістичного блокування та обмеження EXCLUDE у PostgreSQL; контрольний експеримент показав, що обмеження забезпечує коректність, а блокування — відсутність хибних відмов.'),
    B.p('Систему реалізовано на React і TypeScript та Spring Boot 4.1 із Java 21. Виконано 55 серверних, 6 клієнтських і 15 наскрізних тестів, аудит доступності за WCAG 2.2, навантажувальне тестування (p95 = 39,1 мс за 25 віртуальних користувачів на навчальному стенді) і тестування обсягом даних, за результатами якого додано індекси, що вдвічі пришвидшили список бронювань менеджера.'),
    new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 709 }, spacing: { lineRule: 'auto', line: 360 }, children: [t('Ключові слова: ', { italics: true }), t(kwUa)] }),
  ]
  const abstract = [
    B.h1('ABSTRACT', { toc: false }),
    B.p(`${META.studentShortEn} ${META.topicEn} : course work in the discipline «Web Technologies and Web Design» / ${META.studentFullEn} ; supervisor ${META.supervisorBibEn}. — Odesa : Odesa Polytech. Nat. Univ., ${META.year}. — {num:totalPages} p.`),
    B.p('The course work contains the main text part on {num:mainPages} pages, {num:figCount} figures, {num:tabCount} tables, a list of sources with {num:srcCount} titles on {num:srcPages} pages, appendices on {num:appPages} pages.'),
    B.p('A web system for equipment rental has been developed: a client sees how many physical units are free on each day, receives a price quote based on a stepped tariff and submits a request, while a manager confirms, issues and accepts the equipment. A time model with a service buffer has been formalised; a calendar algorithm based on a difference array with O(B + D) complexity and a minimum-idle-time unit selection rule have been proposed. The absence of overlapping rentals is guaranteed by combining pessimistic locking with a PostgreSQL EXCLUDE constraint; a control experiment showed that the constraint ensures correctness, while locking prevents false rejections.'),
    B.p('The system is implemented with React and TypeScript and Spring Boot 4.1 on Java 21. 55 server, 6 client and 15 end-to-end tests, a WCAG 2.2 accessibility audit, load testing (p95 = 39.1 ms for 25 virtual users on the training environment) and data volume testing were carried out; based on the latter, indexes were added that made the manager booking list twice as fast.'),
    new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 709 }, spacing: { lineRule: 'auto', line: 360 }, children: [t('Keywords: ', { italics: true }), t(kwEn)] }),
  ]

  // ---------- Перелік скорочень ----------
  const abbr = [
    ['API', 'Application Programming Interface, програмний інтерфейс'],
    ['C4', 'Context, Containers, Components, Code, модель діаграм'],
    ['CLS', 'Cumulative Layout Shift, сумарний зсув макета'],
    ['CSP', 'Content Security Policy, політика безпеки вмісту'],
    ['CSRF', 'Cross-Site Request Forgery, підробка міжсайтового запиту'],
    ['DTO', 'Data Transfer Object, об’єкт передавання даних'],
    ['E2E', 'End-to-End, наскрізне тестування'],
    ['ER', 'Entity–Relationship, модель «сутність — зв’язок»'],
    ['FR', 'Functional Requirement, функціональна вимога'],
    ['HTTP', 'Hypertext Transfer Protocol, протокол передавання гіпертексту'],
    ['JPA', 'Jakarta Persistence API, об’єктно-реляційне відображення'],
    ['JVM', 'Java Virtual Machine, віртуальна машина Java'],
    ['LCP', 'Largest Contentful Paint, відображення найбільшого елемента'],
    ['NFR', 'Non-Functional Requirement, нефункціональна вимога'],
    ['REST', 'Representational State Transfer, стиль вебінтерфейсів'],
    ['SPA', 'Single-Page Application, односторінковий застосунок'],
    ['SQL', 'Structured Query Language, мова структурованих запитів'],
    ['TBT', 'Total Blocking Time, сумарний час блокування'],
    ['UML', 'Unified Modeling Language, уніфікована мова моделювання'],
    ['VU', 'Virtual User, віртуальний користувач'],
    ['WCAG', 'Web Content Accessibility Guidelines, настанови з доступності'],
    ['XSS', 'Cross-Site Scripting, міжсайтове виконання сценаріїв'],
    ['БД', 'база даних'],
    ['СКБД', 'система керування базами даних'],
  ]
  const abbreviations = [
    B.h1('ПЕРЕЛІК СКОРОЧЕНЬ'),
    ...abbr.map(([a, b]) => new Paragraph({ alignment: AlignmentType.LEFT, spacing: { lineRule: 'auto', line: 360 },
      tabStops: [{ type: d.TabStopType.LEFT, position: 1134 }], indent: { left: 1134, hanging: 1134 },
      children: [new TextRun({ children: [a, new d.Tab(), '— ' + b], font: F, size: 28 })] })),
  ]

  // ---------- Вступ ----------
  const bp = (head, text) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 709 }, spacing: { lineRule: 'auto', line: 360 },
    children: [t(head + ' ', { bold: true }), ...require('../lib').runs(text)] })
  const intro = [
    B.h1('ВСТУП'),
    bp('Актуальність теми роботи.', 'Прокат обладнання працює з обмеженою кількістю фізичних предметів, кожен з яких одночасно може бути лише в одного клієнта. Коли заявки ведуть у таблицях, клієнт не бачить, коли предмет вільний, а дві заявки на ті самі дати можуть потрапити до двох менеджерів. Комерційні системи прокату розв’язують цю задачу, але розраховані на широкий набір сценаріїв і платну підписку, тому актуальною є вебсистема, зосереджена на прозорому календарі доступності екземплярів і гарантованій відсутності подвійного бронювання, зокрема за одночасних запитів.'),
    bp('Мета і задачі роботи.', 'Метою роботи є розроблення вебсистеми оренди обладнання, яка показує кількість вільних екземплярів на кожен день, розраховує вартість і виключає перетин оренд одного екземпляра. Для цього необхідно:'),
    ...B.list([
      'проаналізувати предметну область і аналоги, визначити ролі, функціональні та нефункціональні вимоги',
      'формалізувати модель часу й правила ціноутворення, розробити алгоритми календаря доступності та підбору екземпляра й оцінити їхню складність',
      'спроєктувати архітектуру, інтерфейс користувача, модель даних, програмний інтерфейс і заходи безпеки',
      'реалізувати серверну та клієнтську частини вебсистеми',
      'перевірити відповідність вимогам функціональним, конкурентним, навантажувальним тестуванням, тестуванням обсягом даних і аудитом доступності',
    ]),
    bp('Об’єкт роботи.', 'Процес оренди обладнання, що має обмежену кількість фізичних екземплярів, від вибору дат до повернення.'),
    bp('Предмет роботи.', 'Методи та програмні засоби побудови вебсистеми бронювання з календарем доступності й гарантуванням відсутності перетинів за конкурентного доступу.'),
  ]

  return { title, task, annotation, abstract, abbreviations, intro }
}
