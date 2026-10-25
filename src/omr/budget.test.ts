import { describe, expect, it } from 'vitest'
import { DEFAULT_MAX_WIDTH, grayFromRows, PHONE_MAX_WIDTH, planWidth, PROBE_WIDTH, WORKING_UNIT } from './budget'
import { resizeGray } from './image'
import { blankPage, fillRect } from './testing/draw'

const A4 = 1.414

describe('planWidth', () => {
  it('renders at the width that gives the working staff spacing', () => {
    expect(planWidth(PROBE_WIDTH, 8, A4, 8)).toEqual({ width: 1600, reduced: false })
  })

  it('caps at the default maximum without calling it a reduction', () => {
    expect(planWidth(PROBE_WIDTH, 5, A4, 8)).toEqual({ width: DEFAULT_MAX_WIDTH, reduced: false })
    expect(planWidth(PROBE_WIDTH, null, A4, undefined)).toEqual({ width: DEFAULT_MAX_WIDTH, reduced: false })
  })

  it('never renders below the probe nor above the source', () => {
    expect(planWidth(PROBE_WIDTH, 40, A4, 8).width).toBe(PROBE_WIDTH)
    expect(planWidth(600, 4, A4, 8, 900).width).toBe(900)
  })

  it('uses the phone cap on a device with 4 GB or less and says so', () => {
    expect(planWidth(PROBE_WIDTH, 5, A4, 4)).toEqual({ width: PHONE_MAX_WIDTH, reduced: true })
    expect(planWidth(PROBE_WIDTH, 5, A4, 2).reduced).toBe(true)
    expect(planWidth(PROBE_WIDTH, 5, A4, 6).reduced).toBe(false)
  })

  it('does not call a reduction a page that already fits the phone cap', () => {
    expect(planWidth(PROBE_WIDTH, 12, A4, 4)).toEqual({ width: Math.round((PROBE_WIDTH * WORKING_UNIT) / 12), reduced: false })
  })

  it('uses the phone cap for a page over 12 megapixels', () => {
    expect(planWidth(PROBE_WIDTH, 5, 2, 8)).toEqual({ width: PHONE_MAX_WIDTH, reduced: true })
  })
})

describe('grayFromRows', () => {
  it('reads strips and assembles one gray page', () => {
    const calls: number[] = []
    const gray = grayFromRows({
      width: 2,
      height: 300,
      rows: (y, count) => {
        calls.push(count)
        const rgba = new Uint8ClampedArray(2 * count * 4).fill(y < 128 ? 0 : 255)
        for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255
        return rgba
      },
    })
    expect(calls).toEqual([128, 128, 44])
    expect(gray.data.length).toBe(600)
    expect(gray.data[0]).toBe(0)
    expect(gray.data[599]).toBe(255)
  })
})

describe('resizeGray enlarging', () => {
  it('interpolates a thin line into a thicker, smoother one', () => {
    const page = blankPage(40, 40)
    fillRect(page, 0, 19, 39, 20, 0)
    const big = resizeGray(page, 2)
    expect(big.width).toBe(80)
    expect(big.height).toBe(80)
    expect(big.data[40 * 80 + 40]).toBeLessThan(40)
    expect(big.data[5 * 80 + 40]).toBe(255)
  })
})
