export const MIN_BPM = 40
export const MAX_BPM = 200
export const START_BPM_MIN = 40
export const START_BPM_MAX = 160

const HITS_PER_SPEEDUP = 8
const SPEEDUP_BPM = 2
const MISS_SLOWDOWN_BPM = 4

export interface TempoState {
  bpm: number
  hitsInRow: number
}

const clampBpm = (bpm: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, bpm))

export function adaptTempo(state: TempoState, hit: boolean): TempoState {
  if (!hit) return { bpm: clampBpm(state.bpm - MISS_SLOWDOWN_BPM), hitsInRow: 0 }
  const hitsInRow = state.hitsInRow + 1
  if (hitsInRow < HITS_PER_SPEEDUP) return { bpm: state.bpm, hitsInRow }
  return { bpm: clampBpm(state.bpm + SPEEDUP_BPM), hitsInRow: 0 }
}
