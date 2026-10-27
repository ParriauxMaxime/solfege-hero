import { describe, expect, it } from 'vitest'
import { parseChallenge } from '../series/challenge'
import {
  encodeSurvivalChallenge,
  parseSurvivalChallenge,
  survivalChallengeUrl,
  survivalWon,
  type SurvivalChallenge,
} from './challenge'
import {
  INITIAL_SURVIVAL,
  difficultyFor,
  isNoteExpired,
  isOver,
  precision,
  remainingShare,
  resolveNote,
  timeOut,
} from './game'
import { BLOCK_NOTES, createSurvivalSequence } from './sequence'
import { heartsText, survivalShareText } from './share'

const challenge: SurvivalChallenge = {
  config: { seed: 1234, clefs: ['treble', 'bass'], armures: true, delayS: 3 },
  score: 47,
}

describe('survival state', () => {
  it('starts with three lives and nothing played', () => {
    expect(INITIAL_SURVIVAL).toEqual({ lives: 3, score: 0, played: 0 })
  })

  it('scores a hit and keeps the lives', () => {
    expect(resolveNote(INITIAL_SURVIVAL, true)).toEqual({ lives: 3, score: 1, played: 1 })
  })

  it('loses a life on a miss and on a timeout, and is over at the third', () => {
    let state = resolveNote(INITIAL_SURVIVAL, false)
    expect(state).toEqual({ lives: 2, score: 0, played: 1 })
    state = timeOut(state)
    expect(isOver(state)).toBe(false)
    state = timeOut(state)
    expect(state.lives).toBe(0)
    expect(isOver(state)).toBe(true)
  })

  it('raises the difficulty every 20 notes shown up to 5', () => {
    expect([0, 19, 20, 39, 40, 60, 80, 500].map(difficultyFor)).toEqual([1, 1, 2, 2, 3, 4, 5, 5])
  })

  it('expires a note once the delay has passed', () => {
    expect(isNoteExpired(2999, 3)).toBe(false)
    expect(isNoteExpired(3000, 3)).toBe(true)
    expect(isNoteExpired(4999, 5)).toBe(false)
    expect(remainingShare(1500, 3)).toBe(0.5)
    expect(remainingShare(9000, 3)).toBe(0)
  })

  it('computes precision as hits over notes played', () => {
    expect(precision(INITIAL_SURVIVAL)).toBe(0)
    expect(precision({ lives: 0, score: 47, played: 50 })).toBe(94)
  })
})

describe('survival sequence', () => {
  const config = { seed: 4821, clefs: ['treble' as const, 'bass' as const], armures: true }
  const take = (count: number) => {
    const sequence = createSurvivalSequence(config)
    return Array.from({ length: count }, (_, i) => sequence.noteAt(i))
  }

  it('is deterministic for a seed, parameters and index', () => {
    expect(take(40)).toEqual(take(40))
  })

  it('does not depend on the order notes are asked for', () => {
    const forward = createSurvivalSequence(config)
    const backward = createSurvivalSequence(config)
    const ahead = forward.noteAt(25)
    forward.noteAt(3)
    expect(backward.noteAt(25)).toEqual(ahead)
  })

  it('shows two players the same sequence whatever their mistakes', () => {
    const play = (hit: (i: number) => boolean) => {
      const sequence = createSurvivalSequence(config)
      let state = INITIAL_SURVIVAL
      const seen = []
      for (let i = 0; i < 70; i++) {
        seen.push(sequence.noteAt(state.played))
        state = { ...resolveNote(state, hit(i)), lives: 3 }
      }
      return seen
    }
    expect(play((i) => i % 3 !== 0)).toEqual(play(() => true))
  })

  it('differs between seeds', () => {
    const other = createSurvivalSequence({ ...config, seed: 4822 })
    const mine = createSurvivalSequence(config)
    const sameNotes = Array.from({ length: 32 }, (_, i) => other.noteAt(i).pitch === mine.noteAt(i).pitch)
    expect(sameNotes.every(Boolean)).toBe(false)
  })

  it('goes on past several blocks and respects the clefs', () => {
    const notes = take(BLOCK_NOTES * 4)
    expect(notes).toHaveLength(BLOCK_NOTES * 4)
    expect(notes.every((note) => note.clef === 'treble' || note.clef === 'bass')).toBe(true)
  })

  it('fills every block with distinct generated notes so a block never loops', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const sequence = createSurvivalSequence({ seed: seed * 7919, clefs: ['treble', 'bass', 'alto'], armures: seed % 2 === 0 })
      for (let block = 0; block < 6; block++) {
        const notes = Array.from({ length: BLOCK_NOTES }, (_, i) => sequence.noteAt(block * BLOCK_NOTES + i))
        expect(new Set(notes).size).toBe(BLOCK_NOTES)
      }
    }
  })

  it('keeps C major without armures', () => {
    const plain = createSurvivalSequence({ ...config, armures: false })
    expect(Array.from({ length: 32 }, (_, i) => plain.noteAt(i).fifths).every((fifths) => fifths === 0)).toBe(true)
  })

  it('changes the notes once the difficulty tier is reached', () => {
    const sequence = createSurvivalSequence(config)
    const early = Array.from({ length: BLOCK_NOTES }, (_, i) => sequence.noteAt(i))
    const later = Array.from({ length: BLOCK_NOTES }, (_, i) => sequence.noteAt(BLOCK_NOTES + i))
    expect(later).not.toEqual(early)
  })
})

describe('survival challenge link', () => {
  it('writes the documented hash', () => {
    expect(encodeSurvivalChallenge(challenge)).toBe('v=1234&c=sol-fa&k=1&d=3&n=47')
  })

  it('round-trips', () => {
    expect(parseSurvivalChallenge(encodeSurvivalChallenge(challenge))).toEqual(challenge)
    expect(parseSurvivalChallenge(`#${encodeSurvivalChallenge(challenge)}`)).toEqual(challenge)
  })

  it('builds a full url', () => {
    expect(survivalChallengeUrl('https://x.test/app/', challenge)).toBe('https://x.test/app/survival/#v=1234&c=sol-fa&k=1&d=3&n=47')
  })

  it('rejects Series links, with or without a version', () => {
    expect(parseSurvivalChallenge('s=4821&c=sol&k=1&v=2&t=47')).toBeNull()
    expect(parseSurvivalChallenge('s=4821&c=sol&k=1&v=2&d=3&n=4')).toBeNull()
  })

  it('is not read as a Series link', () => {
    expect(parseChallenge(encodeSurvivalChallenge(challenge))).toBeNull()
  })

  it('rejects an invalid delay, version, clef list or score', () => {
    expect(parseSurvivalChallenge('v=1234&c=sol&k=1&d=4&n=47')).toBeNull()
    expect(parseSurvivalChallenge('v=1234&c=sol&k=1&n=47')).toBeNull()
    expect(parseSurvivalChallenge('v=2&c=sol&k=1&d=3&n=47')?.config.seed).toBe(2)
    expect(parseSurvivalChallenge('v=abc&c=sol&k=1&d=3&n=47')).toBeNull()
    expect(parseSurvivalChallenge('v=1234&c=xx&k=1&d=3&n=47')).toBeNull()
    expect(parseSurvivalChallenge('v=1234&c=sol&k=1&d=3&n=-1')).toBeNull()
    expect(parseSurvivalChallenge('v=1234&c=sol&k=1&d=3')).toBeNull()
    expect(parseSurvivalChallenge('')).toBeNull()
  })

  it('wins only with a strictly higher score', () => {
    expect(survivalWon(48, 47)).toBe(true)
    expect(survivalWon(47, 47)).toBe(false)
    expect(survivalWon(3, 47)).toBe(false)
  })
})

describe('survival share text', () => {
  it('shows hearts kept then lost', () => {
    expect(heartsText(3)).toBe('❤️❤️❤️')
    expect(heartsText(2)).toBe('❤️❤️🖤')
    expect(heartsText(0)).toBe('🖤🖤🖤')
  })

  it('formats the title line and the call to action', () => {
    const text = survivalShareText({ seed: 1234, score: 47, lives: 1 })
    expect(text).toBe('Solfège hero · Survie #1234 · 🎯 47 notes · ❤️🖤🖤\nBats-moi !')
  })

  it('uses the singular for one note', () => {
    expect(survivalShareText({ seed: 1234, score: 1, lives: 0 })).toContain('🎯 1 note ·')
  })
})
