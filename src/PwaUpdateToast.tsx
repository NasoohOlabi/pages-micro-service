import { useRegisterSW } from 'virtual:pwa-register/react'
import { useLocale } from './i18n/LocaleContext'

export function PwaUpdateToast() {
  const { t } = useLocale()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-3 bottom-3 left-3 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-md border border-gray-200 bg-white p-3 text-sm shadow-lg sm:right-4 sm:left-auto"
    >
      <p className="font-medium text-gray-900">{t('pwaUpdateAvailable')}</p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="rounded px-3 py-2 font-semibold text-gray-600 hover:bg-gray-50"
        >
          {t('dismiss')}
        </button>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="rounded bg-indigo-600 px-3 py-2 font-semibold text-white hover:bg-indigo-700"
        >
          {t('reloadPage')}
        </button>
      </div>
    </div>
  )
}
