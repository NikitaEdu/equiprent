import { expect, type Page } from '@playwright/test'

export const CLIENT = { email: 'olena@equiprent.test', password: 'Client-Demo-2026!' }
export const CLIENT2 = { email: 'taras@equiprent.test', password: 'Client-Demo-2026!' }
export const MANAGER = { email: 'manager@equiprent.test', password: 'Manager-Demo-2026!' }

export async function login(page: Page, who: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('Електронна пошта').fill(who.email)
  await page.getByLabel('Пароль').fill(who.password)
  await page.getByRole('button', { name: 'Увійти' }).click()
  await expect(page.getByRole('button', { name: 'Вийти' })).toBeVisible()
}

/** Дата «сьогодні + n» за Києвом у форматі YYYY-MM-DD. */
export function isoFromToday(n: number): string {
  const kyiv = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date())
  const [y, m, d] = kyiv.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

/** Випадковий зсув, щоб повторні запуски не конфліктували з попередніми бронюваннями. */
export function randomOffset(min = 30, max = 160): number {
  return min + Math.floor(Math.random() * (max - min))
}

export async function openEquipment(page: Page, name: string) {
  await page.goto('/')
  await page.getByLabel('Пошук за назвою або брендом').fill(name)
  await page.getByRole('button', { name: 'Знайти' }).click()
  await page.getByRole('link', { name: new RegExp(name) }).first().click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(name)
}

export async function shot(page: Page, name: string) {
  if (process.env.E2E_SCREENSHOTS) {
    await page.screenshot({ path: `${process.env.E2E_SCREENSHOTS}/${name}.png`, fullPage: true })
  }
}
