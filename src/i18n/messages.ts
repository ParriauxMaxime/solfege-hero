import type { fr } from './fr'

type Widen<T> = T extends string ? string : { -readonly [K in keyof T]: Widen<T[K]> }

export type Messages = Widen<typeof fr>

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>
}[keyof T & string]

export type MessageKey = Leaves<Messages>
