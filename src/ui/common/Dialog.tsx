import { useEffect, useRef, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  actions: ReactNode
  onSubmit?: () => void
}

/** Native <dialog> modal: focus trapping and Escape come from the browser. */
export function Dialog({ open, title, onClose, children, actions, onSubmit }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-xl border border-line bg-surface p-0 text-text shadow-2xl backdrop:bg-black/50"
    >
      {open && (
      <form
        method="dialog"
        onSubmit={(e) => {
          if (onSubmit) {
            e.preventDefault()
            onSubmit()
          }
        }}
        className="p-5"
      >
        <h2 className="text-[16px] font-semibold">{title}</h2>
        <div className="mt-3 text-[13.5px] text-muted">{children}</div>
        <div className="mt-5 flex justify-end gap-2">{actions}</div>
      </form>
      )}
    </dialog>
  )
}

export const btnPrimary =
  'inline-flex items-center gap-2 rounded-md bg-accent px-3.5 py-1.5 text-[13px] font-medium text-accent-ink disabled:opacity-50'
export const btnSecondary =
  'inline-flex items-center gap-2 rounded-md border border-line px-3.5 py-1.5 text-[13px] text-text hover:bg-surface-2'
export const btnDanger =
  'inline-flex items-center gap-2 rounded-md bg-danger px-3.5 py-1.5 text-[13px] font-medium text-white'
export const inputClass =
  'w-full rounded-md border border-line bg-bg px-3 py-2 text-[13.5px] text-text outline-none focus:border-accent'
