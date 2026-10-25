export function plural(count: number, one: string, many: string): string {
  return count < 2 ? one : many
}
