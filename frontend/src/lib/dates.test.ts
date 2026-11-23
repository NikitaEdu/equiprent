import { describe, expect, it } from 'vitest'
import {
  addDays, addMonths, days, endOfMonth, isIsoDate, rentalDays, todayKyiv, weekdayMondayFirst,
} from './dates'

describe('календарна арифметика', () => {
  it('TC-FE-01: додавання днів через межу місяця, року та переходу на літній час', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-03-28', 1)).toBe('2027-03-29') // перехід на літній час в Україні
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('TC-FE-02: тривалість оренди рахується з включними межами', () => {
    expect(rentalDays('2026-12-10', '2026-12-10')).toBe(1)
    expect(rentalDays('2026-12-10', '2026-12-13')).toBe(4)
    expect(rentalDays('2027-03-27', '2027-03-30')).toBe(4)
  })

  it('TC-FE-03: перевірка формату дати відхиляє неіснуючі дні', () => {
    expect(isIsoDate('2026-02-29')).toBe(false)
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('1.12.2026')).toBe(false)
  })

  it('TC-FE-04: межі місяців і день тижня з понеділка', () => {
    expect(endOfMonth('2026-02-01')).toBe('2026-02-28')
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01')
    expect(weekdayMondayFirst('2026-12-07')).toBe(0) // понеділок
    expect(weekdayMondayFirst('2026-12-06')).toBe(6) // неділя
  })

  it('TC-FE-05: «сьогодні» визначається за Києвом, а не за UTC', () => {
    // 31.12.2026 23:30 UTC — у Києві вже 1 січня
    expect(todayKyiv(new Date(Date.UTC(2026, 11, 31, 23, 30)))).toBe('2027-01-01')
  })

  it('TC-FE-06: відмінювання слова «доба»', () => {
    expect(days(1)).toBe('1 доба')
    expect(days(3)).toBe('3 доби')
    expect(days(5)).toBe('5 діб')
    expect(days(11)).toBe('11 діб')
    expect(days(21)).toBe('21 доба')
  })
})
