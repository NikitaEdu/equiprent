# Пояснювальна записка

Джерело записки — модулі JavaScript у `chapters/` (розділи, титул, завдання, додатки), бібліографія `sources.js`,
реквізити `meta.js`. Збирання DOCX і PDF:

```bash
cd docs/thesis
node build.js        # потрібні: Node.js 22, пакет docx, LibreOffice (з модулем Math), poppler-utils, python3
```

Результат — `out/Татчук_АІ-245_курсова_EquipRent.docx` і `.pdf`. Скрипт робить кілька проходів: збирає мітки
й порядок джерел, верстає документ, знаходить номери сторінок заголовків у PDF і заповнює зміст та обсяги в анотації.

Схеми: вихідні файли в `figures-src/` (Graphviz `.dot`, SVG) і `diagrams/` (Python); растрові версії — `figures/`.
Допоміжні скрипти: `tools/test-protocol.py` (протокол тестів для додатка Г), `tools/api-examples.sh`
(приклади запитів для додатка В), `tools/fix-math.py` (розмір і гарнітура формул).
