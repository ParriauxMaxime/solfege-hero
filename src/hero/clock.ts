export interface BeatClock {
  beatAt(time: number): number
  timeAt(beat: number): number
  bpm: number
}

const SECONDS_PER_MINUTE = 60

export function createBeatClock(startTime: number, startBeat: number, bpm: number): BeatClock {
  return {
    bpm,
    beatAt: (time) => startBeat + ((time - startTime) * bpm) / SECONDS_PER_MINUTE,
    timeAt: (beat) => startTime + ((beat - startBeat) * SECONDS_PER_MINUTE) / bpm,
  }
}

export function withTempo(clock: BeatClock, time: number, bpm: number): BeatClock {
  return createBeatClock(time, clock.beatAt(time), bpm)
}
