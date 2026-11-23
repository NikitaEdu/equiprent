import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { CLIENT, login, MANAGER, openEquipment, shot } from './helpers'

/**
 * Автоматизована перевірка доступності (axe-core, правила WCAG 2.0/2.1/2.2 A і AA) та адаптивності.
 * Позитивний результат сканера не доводить повної відповідності WCAG — частину критеріїв
 * перевірено вручну (див. записку, підрозділ 5.4).
 */
const results: Record<string, unknown> = {}

async function audit(page: Page, name: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
  results[name] = {
    url: page.url(), violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })),
    passes: r.passes.length, incomplete: r.incomplete.length,
  }
  return r.violations
}

test.afterAll(() => {
  mkdirSync('test-results', { recursive: true })
  writeFileSync('test-results/axe-results.json', JSON.stringify(results, null, 2))
})

test('TC-A11Y-01: сторінки клієнта без порушень WCAG A/AA за даними axe', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.equipment-tile').first()).toBeVisible()
  expect(await audit(page, 'catalog')).toEqual([])
  await openEquipment(page, 'Бездзеркальна камера')
  expect(await audit(page, 'equipment')).toEqual([])
  await page.goto('/login')
  expect(await audit(page, 'login')).toEqual([])
  await login(page, CLIENT)
  await page.goto('/my')
  await expect(page.locator('.booking-row').first()).toBeVisible()
  expect(await audit(page, 'my-bookings')).toEqual([])
})

test('TC-A11Y-02: сторінки менеджера без порушень WCAG A/AA за даними axe', async ({ page }) => {
  await login(page, MANAGER)
  await page.getByRole('tab', { name: 'Усі' }).click()
  await expect(page.locator('.data-table tbody tr').first()).toBeVisible()
  expect(await audit(page, 'manager-bookings')).toEqual([])
  await page.goto('/manager/equipment?id=1')
  await expect(page.locator('.tl-row').first()).toBeVisible()
  expect(await audit(page, 'manager-equipment')).toEqual([])
})

for (const width of [360, 768, 1280]) {
  test(`TC-RESP-${width}: без горизонтальної прокрутки сторінки на ширині ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    await expect(page.locator('.equipment-tile').first()).toBeVisible()
    const overflowCatalog = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    await shot(page, `resp-catalog-${width}`)
    await openEquipment(page, 'Бездзеркальна камера')
    const overflowItem = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    await shot(page, `resp-equipment-${width}`)
    expect(overflowCatalog).toBeLessThanOrEqual(0)
    expect(overflowItem).toBeLessThanOrEqual(0)
  })
}

test('TC-A11Y-03: календар і заявка лише з клавіатури', async ({ page }) => {
  await login(page, CLIENT)
  await openEquipment(page, 'Спальник')
  // Переходимо Tab-ом до першого доступного дня календаря
  const firstDay = page.locator('.cal-day:not([disabled])').first()
  for (let i = 0; i < 40 && !(await firstDay.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab')
  }
  await expect(firstDay).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  await expect(page.locator('.cal-day[aria-pressed="true"]')).toHaveCount(3)
  // Фокус видимий: обчислений стиль outline не «none»
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)
  expect(outline).not.toBe('none')
})
