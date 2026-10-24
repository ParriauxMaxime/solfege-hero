export function makeZip(
  entries: { name: string; data: Uint8Array; deflate?: boolean }[],
): Promise<Uint8Array>
