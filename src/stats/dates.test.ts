import { describe, expect, it } from 'vitest'
import { setLanguage } from '../i18n'
import { addDays, addWeeks, dayRange, isWeekKey, shortDateLabel, shortMonthLabel, weekKeyOf, weekdayIndex, weekdayInitial } from './dates'

describe('weekKeyOf', () => {
  it.each([
    ['2026-01-01', '2026-W01'],
    ['2027-01-01', '2026-W53'],
    ['2024-12-30', '2025-W01'],
    ['2026-10-25', '2026-W43'],
    ['2026-10-26', '2026-W44'],
  ])('%s is in %s', (day, week) => {
    expect(weekKeyOf(day)).toBe(week)
  })
})

describe('addWeeks', () => {
  it('moves across year boundaries', () => {
    expect(addWeeks('2026-W01', -1)).toBe('2025-W52')
    expect(addWeeks('2026-W53', 1)).toBe('2027-W01')
    expect(addWeeks('2026-W10', 0)).toBe('2026-W10')
    expect(addWeeks('2026-W43', -4)).toBe('2026-W39')
  })
})

describe('dayRange', () => {
  it('lists consecutive days ending on last, oldest first', () => {
    expect(dayRange('2026-03-01', 3)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01'])
  })

  it('is empty for a zero count', () => {
    expect(dayRange('2026-03-01', 0)).toEqual([])
  })
})

describe('isWeekKey', () => {
  it('accepts real ISO weeks only', () => {
    expect(isWeekKey('2026-W53')).toBe(true)
    expect(isWeekKey('2026-W01')).toBe(true)
    expect(isWeekKey('2025-W53')).toBe(false)
    expect(isWeekKey('2026-W00')).toBe(false)
    expect(isWeekKey('2026-43')).toBe(false)
    expect(isWeekKey(42)).toBe(false)
  })
})

describe('small helpers', () => {
  it('numbers weekdays from Monday', () => {
    expect(weekdayIndex('2026-10-26')).toBe(0)
    expect(weekdayIndex('2026-10-25')).toBe(6)
  })

  it('adds days and formats short labels', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(shortDateLabel('2026-10-24')).toBe('24 oct')
    expect(shortDateLabel('2026-02-03')).toBe('3 févr')
    expect(shortMonthLabel('2026-08-01')).toBe('août')
    expect([0, 2, 4].map(weekdayInitial)).toEqual(['L', 'M', 'V'])
  })

  it('formats labels in English', () => {
    setLanguage('en')
    try {
      expect(shortDateLabel('2026-10-24')).toBe('24 Oct')
      expect(shortMonthLabel('2026-01-01')).toBe('Jan')
      expect([0, 2, 4].map(weekdayInitial)).toEqual(['M', 'W', 'F'])
    } finally {
      setLanguage('fr')
    }
  })
})
