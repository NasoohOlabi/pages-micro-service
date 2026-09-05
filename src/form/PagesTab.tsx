import { EntryForm } from './EntryForm'
import { PagesStats } from '../stats/PagesStats'
import { useLocale } from '../i18n/LocaleContext'
import type { GoogleUser } from '../auth/useGoogleAuth'
import { useQueryState } from '../url/queryState'

interface PagesTabProps {
  user: GoogleUser
  ready: boolean
}

export function PagesTab({ user, ready }: PagesTabProps) {
  const { t } = useLocale()
  const [state, setQuery] = useQueryState()
  const mode = state.tab === 'pages' && state.sub === 'stats' ? 'stats' : 'log'

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="grid w-full max-w-md grid-cols-2 gap-1 rounded-md border border-gray-200 bg-white p-1">
        {(['log', 'stats'] as const).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            onClick={() => setQuery({ sub: nextMode }, 'push')}
            aria-current={mode === nextMode ? 'page' : undefined}
            className={`min-h-10 rounded px-3 text-sm font-semibold ${
              nextMode === mode ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {nextMode === 'log' ? t('pagesLogSubTab') : t('pagesStatsSubTab')}
          </button>
        ))}
      </div>
      {mode === 'log' ? <EntryForm user={user} ready={ready} /> : <PagesStats ready={ready} />}
    </div>
  )
}
