import { useEffect, useState } from 'react'
import { EntryForm } from './EntryForm'
import { PagesStats } from '../stats/PagesStats'
import { useLocale } from '../i18n/LocaleContext'
import type { GoogleUser } from '../auth/useGoogleAuth'

interface PagesTabProps {
  user: GoogleUser
  ready: boolean
}

type PagesMode = 'log' | 'stats'

function readPagesModeFromUrl(): PagesMode {
  return new URLSearchParams(window.location.search).get('sub') === 'stats' ? 'stats' : 'log'
}

export function PagesTab({ user, ready }: PagesTabProps) {
  const { t } = useLocale()
  const [mode, setMode] = useState<PagesMode>(readPagesModeFromUrl)

  useEffect(() => {
    const handlePopState = () => setMode(readPagesModeFromUrl())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const selectMode = (nextMode: PagesMode) => {
    const url = new URL(window.location.href)
    if (nextMode === 'stats') {
      url.searchParams.set('sub', 'stats')
      if (!url.searchParams.get('view')) url.searchParams.set('view', 'students')
    } else {
      url.searchParams.delete('sub')
      url.searchParams.delete('view')
    }
    window.history.pushState(null, '', url)
    setMode(nextMode)
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="grid w-full max-w-md grid-cols-2 gap-1 rounded-md border border-gray-200 bg-white p-1">
        {(['log', 'stats'] as const).map((nextMode) => (
          <button
            key={nextMode}
            type="button"
            onClick={() => selectMode(nextMode)}
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
