import { CircleAlert, Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useToasts } from '@/stores/toasts'

export function Toasts() {
  const { t } = useTranslation()
  const { toasts, dismiss } = useToasts()
  return (
    <div className="pointer-events-none fixed bottom-9 right-4 z-50 flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.kind === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13px] text-text shadow-xl"
        >
          {toast.kind === 'error' ? (
            <CircleAlert size={16} className="mt-px shrink-0 text-danger" />
          ) : (
            <Info size={16} className="mt-px shrink-0 text-integration" />
          )}
          <p className="min-w-0 flex-1 break-words">{toast.text}</p>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label={t('common.dismiss')}
            className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted hover:text-text"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
