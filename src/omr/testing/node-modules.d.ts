declare module 'node:zlib' {
  export function inflateSync(data: Uint8Array): Uint8Array
  export function deflateSync(data: Uint8Array): Uint8Array
}

declare module 'node:fs' {
  export function readFileSync(path: string | URL): Uint8Array
  export function readFileSync(path: string | URL, encoding: 'utf8'): string
  export function existsSync(path: string | URL): boolean
}
