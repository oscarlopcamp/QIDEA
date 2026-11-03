import { BookOpen, FolderPlus, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { QideaMark } from '@/ui/brand/Logo'

const STAGES = [
  'Requirements',
  'Analysis',
  'Design',
  'Implementation',
  'Testing',
  'Validation',
  'Deployment',
  'Maintenance',
]

const LANES = [
  { key: 'Classical', color: 'var(--lane-classical)' },
  { key: 'Quantum', color: 'var(--lane-quantum)' },
  { key: 'Integration', color: 'var(--lane-integration)' },
] as const

export function WelcomeView() {
  const { t } = useTranslation()
  const soon = t('welcome.comingSoon')

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden">
      <div className="mx-auto max-w-[880px] px-4 py-10 sm:px-10 sm:py-16">
        <QideaMark size={64} animate />
        <h1 className="mt-6 max-w-[18ch] text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] text-text sm:text-[44px]">
          {t('welcome.title')}
        </h1>
        <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-muted">{t('welcome.lead')}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            disabled
            title={soon}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 font-medium text-accent-ink disabled:opacity-90"
          >
            <FolderPlus size={16} /> {t('welcome.newProject')}
          </button>
          <button
            type="button"
            disabled
            title={soon}
            className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-text"
          >
            <Sparkles size={16} /> {t('welcome.openSample')}
          </button>
          <button
            type="button"
            disabled
            title={soon}
            className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-text"
          >
            <BookOpen size={16} /> {t('welcome.startLesson')}
          </button>
        </div>

        <h2 className="mt-14 text-[15px] font-semibold text-text">{t('welcome.lanesTitle')}</h2>
        {/* A miniature of the project manager: lanes run across the lifecycle stages. */}
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[140px_repeat(8,1fr)] border-b border-line text-[11.5px] text-muted">
              <span />
              {STAGES.map((s) => (
                <span key={s} className="px-2 py-2">
                  {s}
                </span>
              ))}
            </div>
            {LANES.map(({ key, color }, laneIdx) => (
              <div
                key={key}
                className="grid grid-cols-[140px_repeat(8,1fr)] items-center border-b border-line last:border-b-0"
              >
                <div className="flex items-center gap-2 px-3 py-3">
                  <span className="h-3 w-3 rounded-full" style={{ background: color }} />
                  <span className="text-[13px] font-medium text-text">{t(`welcome.lane${key}`)}</span>
                </div>
                {STAGES.map((s, i) => (
                  <div key={s} className="px-2 py-3">
                    {(i + laneIdx) % 3 !== 2 && (
                      <span
                        className="block h-1.5 rounded-full"
                        style={{ background: color, opacity: i < 4 ? 0.9 : 0.35 }}
                      />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <dl className="mt-6 grid gap-5 sm:grid-cols-3">
          {LANES.map(({ key, color }) => (
            <div key={key} className="border-l-2 pl-3" style={{ borderColor: color }}>
              <dt className="text-[13px] font-semibold text-text">{t(`welcome.lane${key}`)}</dt>
              <dd className="mt-1 text-[13px] leading-relaxed text-muted">{t(`welcome.lane${key}Desc`)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
