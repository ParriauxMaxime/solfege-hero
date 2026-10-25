let open = false

/** True while the import flow owns the hardware back button; kept apart so the app can ask without loading the flow. */
export function isOmrImportOpen(): boolean {
  return open
}

export function setOmrImportOpen(value: boolean): void {
  open = value
}
