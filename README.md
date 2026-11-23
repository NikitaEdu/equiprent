# EquipRent — вебсистема оренди обладнання з календарем доступності

Курсова робота з дисципліни «Веб-технології та веб-дизайн», варіант 12.
Клієнт обирає обладнання, бачить у календарі, скільки фізичних екземплярів вільно на кожен день,
отримує розрахунок вартості й надсилає заявку. Менеджер підтверджує або відхиляє заявки, фіксує видачу
й повернення (з платою за запізнення), бачить часову діаграму зайнятості екземплярів і звіт завантаженості.

## Межі реалізації

Реалізовано: каталог із пошуком і фільтрами; календар доступності; ступінчастий тариф і заставу;
підбір конкретного екземпляра; заявки та їхні стани; продовження оренди; технічна перерва після оренди
(погоджене ускладнення); захист від одночасного бронювання; ролі «клієнт» і «менеджер»; звіт завантаженості.

Поза межами: реальні платежі й стягнення застави, сповіщення електронною поштою, черга очікування,
мобільний застосунок. Усі дані демонстрації синтетичні.

## Технології та перевірені версії

| Складник | Версія | Призначення |
|---|---|---|
| Java (OpenJDK) | 21 | середовище виконання бекенду |
| Spring Boot | 4.1.3 | веб-API, безпека, доступ до даних |
| PostgreSQL | 16 | сховище; обмеження EXCLUDE проти перетину бронювань |
| Flyway | у складі Spring Boot | міграції схеми |
| Node.js | 22 | збирання фронтенду |
| React / TypeScript / Vite | 19 / 7 / 8 | клієнтський застосунок |
| Maven | 3.9 | збирання бекенду |

Точні версії залежностей зафіксовано в `backend/pom.xml` і `frontend/package-lock.json`.

## Структура репозиторію

```
backend/     Spring Boot: src/main/java — код, src/main/resources/db/migration — міграції, src/test — тести
frontend/    React + TypeScript: src — код, e2e — наскрізні тести Playwright
loadtest/    сценарії навантажувального тестування та тестування обсягом даних, results — результати
docs/        інструкції, опис API, схеми, протоколи (evidence), знімки екранів
Dockerfile, docker-compose.yml, .env.example
```

## Запуск через Docker (рекомендовано)

Потрібно: Docker Desktop (Windows/macOS) або Docker Engine з Compose v2.

```bash
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
# відредагуйте DB_PASSWORD у файлі .env
docker compose up --build
```

Відкрийте http://localhost:8080. Під час першого запуску Flyway створює схему, а застосунок —
демонстраційні дані (лише якщо база порожня; повторний запуск нічого не дублює).

Зупинка: `docker compose down`. Повне видалення даних: `docker compose down -v` (**незворотно видаляє базу**).

## Локальний запуск без Docker

Потрібно: JDK 21, Maven 3.9+, Node.js 22, PostgreSQL 16.

1. Створіть базу та користувача (psql від імені адміністратора):
   ```sql
   CREATE USER rental WITH PASSWORD 'ваш-пароль';
   CREATE DATABASE rental OWNER rental;
   ```
2. Зберіть фронтенд (результат потрапляє в `backend/src/main/resources/static`):
   ```bash
   cd frontend
   npm ci
   npm run build
   ```
3. Запустіть бекенд (робочий каталог `backend`):
   ```bash
   # Linux/macOS
   DB_PASSWORD=ваш-пароль mvn spring-boot:run
   # Windows PowerShell
   $env:DB_PASSWORD="ваш-пароль"; mvn spring-boot:run
   ```
4. Відкрийте http://localhost:8080.

Режим розробки інтерфейсу з гарячим перезавантаженням: бекенд запущений як вище, потім
`cd frontend && npm run dev` і відкрийте http://localhost:5173 (запити `/api` проксіюються на 8080).

### Змінні середовища

| Змінна | Типово | Опис |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/rental` | адреса бази |
| `DB_USER` | `rental` | користувач бази |
| `DB_PASSWORD` | — | пароль бази (обов'язково) |
| `SEED_DEMO_DATA` | `true` | створити демонстраційні дані на порожній базі |
| `COOKIE_SECURE` | `false` | `true` — якщо сайт працює через HTTPS |
| `APP_TIMEZONE` | `Europe/Kyiv` | часовий пояс, у якому визначається «сьогодні» |
| `PORT` | `8080` | порт HTTP |

## Демонстраційні облікові записи

Лише для навчального стенда:

| Роль | Електронна пошта | Пароль |
|---|---|---|
| Менеджер | manager@equiprent.test | Manager-Demo-2026! |
| Клієнт | olena@equiprent.test | Client-Demo-2026! |
| Клієнт | taras@equiprent.test | Client-Demo-2026! |

## Тести

```bash
# Модульні тести (без бази даних), каталог backend
mvn test

# Модульні + інтеграційні з реальною PostgreSQL та звіт покриття JaCoCo (target/site/jacoco)
# Потрібна порожня тестова база: CREATE DATABASE rental_test OWNER rental;
TEST_DB_PASSWORD=ваш-пароль mvn verify

# Тести утиліт фронтенду, каталог frontend
npx vitest run

# Наскрізні тести в браузері: застосунок має бути запущений з демонстраційними даними
npx playwright install chromium     # один раз
npx playwright test
```

Змінні для інтеграційних тестів: `TEST_DB_URL` (типово `jdbc:postgresql://localhost:5432/rental_test`),
`TEST_DB_USER`, `TEST_DB_PASSWORD`. Тести очищують таблиці тестової бази перед кожним випадком —
**не вказуйте робочу базу**.

Навантажувальні сценарії та тест обсягом даних — `loadtest/README.md`.

## Документація

- Опис API (OpenAPI 3): http://localhost:8080/swagger-ui.html, машинний документ — `/v3/api-docs`
- Інструкція користувача — `docs/user-guide.md`
- Інструкція адміністратора — `docs/admin-guide.md`
- Протоколи перевірок і журнал дефектів — `docs/evidence/`

## Перевірка стану

- `GET /actuator/health/liveness` — процес працює
- `GET /actuator/health/readiness` — застосунок готовий обслуговувати запити (з урахуванням бази)

Кожна відповідь містить заголовок `X-Request-Id`; той самий ідентифікатор потрапляє в журнал,
що спрощує пошук запиту під час діагностики.
