import { expect, test } from '@playwright/test'
import { CLIENT, CLIENT2, isoFromToday, login, MANAGER, openEquipment, randomOffset, shot } from './helpers'

test.describe('Основний сценарій оренди', () => {
  test('TC-E2E-01: клієнт обирає дати, бачить розрахунок, надсилає заявку; результат зберігається після оновлення',
    async ({ page }) => {
      await login(page, CLIENT)
      await openEquipment(page, 'Проєктор Full HD')
      await shot(page, 'e2e-equipment-client')
      const offset = randomOffset()
      await page.getByLabel('Початок').fill(isoFromToday(offset))
      await page.getByLabel('Завершення').fill(isoFromToday(offset + 3))

      // 4 доби: ступінь «від 3 діб» — 520 грн/доба
      await expect(page.getByText('4 × 520 грн')).toBeVisible()
      await expect(page.getByText(/^2\s080 грн$/)).toBeVisible()
      await expect(page.getByText(/Вільних екземплярів на весь період: \d/)).toBeVisible()
      await shot(page, 'e2e-quote')

      await page.getByLabel(/Коментар для менеджера/).fill('Заберу після 16:00')
      await page.getByRole('button', { name: 'Надіслати заявку' }).click()
      await expect(page.getByText(/Заявку BR-\d{6} надіслано/)).toBeVisible()
      await expect(page.getByText('Очікує підтвердження').first()).toBeVisible()
      await shot(page, 'e2e-booking-created')

      await page.reload()
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Проєктор')
      await expect(page.getByText('Заявку створено')).toBeVisible()
      await page.getByRole('link', { name: 'Мої бронювання' }).first().click()
      await expect(page.getByText('Проєктор Full HD 4000 лм').first()).toBeVisible()
      await shot(page, 'e2e-my-bookings')
    })

  test('TC-E2E-02: вибір періоду кліками в календарі та клавіатурою', async ({ page }) => {
    await openEquipment(page, 'Спальник')
    const days = page.locator('.cal-day:not([disabled])')
    await expect(days.first()).toBeVisible()
    await days.nth(1).click()
    await days.nth(3).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.cal-day[aria-pressed="true"]')).toHaveCount(3)
    await expect(page.getByText(/3 доби/).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Увійти, щоб забронювати' })).toBeVisible()
    await shot(page, 'e2e-calendar-guest')
  })

  test('TC-E2E-03: період із повністю зайнятим днем — пояснення і заблокована кнопка', async ({ page }) => {
    await login(page, CLIENT2)
    await openEquipment(page, 'Бездзеркальна камера')
    // У демонстраційних даних усі три камери зайняті на 5-й і 6-й день від сьогодні
    await page.getByLabel('Початок').fill(isoFromToday(5))
    await page.getByLabel('Завершення').fill(isoFromToday(6))
    await expect(page.getByText('На обрані дати вільних екземплярів немає')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Надіслати заявку' })).toBeDisabled()
    await shot(page, 'e2e-conflict')
  })

  test('TC-E2E-04: дата завершення раніше початку — попередження без запиту на сервер', async ({ page }) => {
    await openEquipment(page, 'Намет')
    await page.getByLabel('Початок').fill(isoFromToday(10))
    await page.getByLabel('Завершення').fill(isoFromToday(8))
    await expect(page.getByText('Дата завершення не може бути раніше дати початку')).toBeVisible()
  })
})

test.describe('Робоче місце менеджера та права доступу', () => {
  test('TC-E2E-05: менеджер підтверджує заявку, клієнт бачить новий стан', async ({ page, browser }) => {
    await login(page, CLIENT)
    await openEquipment(page, 'Екран на тринозі')
    const offset = randomOffset()
    await page.getByLabel('Початок').fill(isoFromToday(offset))
    await page.getByLabel('Завершення').fill(isoFromToday(offset + 1))
    await page.getByRole('button', { name: 'Надіслати заявку' }).click()
    await expect(page.getByText(/Заявку BR-\d{6} надіслано/)).toBeVisible()
    const number = (await page.locator('.detail-sub').innerText()).match(/BR-\d{6}/)![0]

    const ctx = await browser.newContext({ locale: 'uk-UA' })
    const mgr = await ctx.newPage()
    await login(mgr, MANAGER)
    await expect(mgr.getByRole('heading', { name: 'Заявки та оренди' })).toBeVisible()
    await mgr.getByLabel('Клієнт, пошта або номер бронювання').fill(number)
    await mgr.getByRole('button', { name: 'Знайти' }).click()
    await shot(mgr, 'e2e-manager-queue')
    await mgr.getByRole('row', { name: new RegExp(number) }).getByRole('button', { name: 'Підтвердити' }).click()
    await expect(mgr.getByText(`${number} підтверджено`)).toBeVisible()
    await ctx.close()

    await page.reload()
    await expect(page.locator('.detail-head .status')).toHaveText('Підтверджено')
  })

  test('TC-E2E-06: відхилення потребує причини, клієнт бачить її', async ({ page }) => {
    await login(page, MANAGER)
    await page.getByRole('tab', { name: 'Очікує підтвердження' }).click()
    const first = page.locator('.data-table tbody tr').first()
    await first.getByRole('link').first().click()
    const reject = page.getByRole('button', { name: 'Відхилити' })
    await expect(reject).toBeDisabled()
    await page.getByLabel('Причина відхилення').fill('Ні')
    await expect(reject).toBeDisabled()
    await page.getByLabel('Причина відхилення').fill('Екземпляр потрібен для ремонту')
    await reject.click()
    await expect(page.getByText('Заявку відхилено')).toBeVisible()
    await expect(page.getByText('Причина відхилення: Екземпляр потрібен для ремонту')).toBeVisible()
  })

  test('TC-E2E-07: клієнт не відкриває сторінки менеджера; чуже бронювання — «не знайдено»', async ({ page }) => {
    await login(page, CLIENT2)
    await page.goto('/manager')
    await expect(page.getByRole('heading', { name: 'Немає доступу' })).toBeVisible()
    await page.goto('/my/1') // бронювання № 1 у демонстраційних даних належить іншій клієнтці
    await expect(page.getByRole('heading', { name: 'Бронювання не знайдено' })).toBeVisible()
    await shot(page, 'e2e-foreign-booking')
  })

  test('TC-E2E-08: менеджер бачить часову діаграму екземплярів і звіт завантаженості', async ({ page }) => {
    await login(page, MANAGER)
    await page.getByRole('link', { name: 'Обладнання' }).click()
    await page.getByRole('button', { name: /Бездзеркальна камера/ }).click()
    await expect(page.locator('.tl-row')).toHaveCount(3)
    await expect(page.locator('.tl-bar').first()).toBeVisible()
    await shot(page, 'e2e-manager-timeline')
    await page.getByRole('link', { name: 'Завантаженість' }).click()
    await page.getByRole('button', { name: 'Сформувати' }).click()
    await expect(page.getByText('Середня завантаженість')).toBeVisible()
    await shot(page, 'e2e-manager-report')
  })

  test('TC-E2E-09: неправильний пароль — повідомлення без входу', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Електронна пошта').fill('taras@equiprent.test')
    await page.getByLabel('Пароль').fill('неправильний-пароль-123')
    await page.getByRole('button', { name: 'Увійти' }).click()
    await expect(page.getByText('Невірна електронна пошта або пароль')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Увійти' })).toBeVisible()
  })
})
