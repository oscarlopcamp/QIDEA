/** Ask the user for a .zip file. Resolves with null when the picker is cancelled. */
export function pickZipFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip,application/zip'
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true })
    input.addEventListener('cancel', () => resolve(null), { once: true })
    input.click()
  })
}
