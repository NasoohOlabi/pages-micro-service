import { useIsFetching } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { refreshActiveQueries } from './queryClient'
import { useLocale } from './i18n/LocaleContext'

export function DataRefresh() {
  const { t } = useLocale()
  const fetching = useIsFetching() > 0
  const [coolingDown, setCoolingDown] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!coolingDown) return
    const timer = window.setTimeout(() => setCoolingDown(false), 60_000)
    return () => window.clearTimeout(timer)
  }, [coolingDown])

  async function refresh() {
    setCoolingDown(true)
    setError(false)
    try {
      await refreshActiveQueries()
    } catch {
      setError(true)
    }
  }

  return (
    <div className="w-full max-w-7xl text-start print:hidden">
      <button type="button" onClick={() => void refresh()} disabled={fetching || coolingDown} title={t('cachedDataHint')} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 disabled:opacity-50">
        {fetching ? t('refreshingData') : coolingDown ? t('refreshDataCooldown') : t('refreshData')}
      </button>
      <p className="mt-1 text-xs text-gray-500">{t('cachedDataHint')}</p>
      {error && <p role="alert" className="mt-1 text-sm text-red-600">{t('refreshDataError')}</p>}
    </div>
  )
}
