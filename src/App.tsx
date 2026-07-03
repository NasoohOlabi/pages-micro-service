import { useEffect, useState } from 'react'
import { useGoogleAuth } from './auth/useGoogleAuth'
import { SignInButton } from './auth/SignInButton'
import { EntryForm } from './form/EntryForm'
import { PointsForm } from './form/PointsForm'
import { AttendanceForm } from './form/AttendanceForm'
import { LanguageSwitcher } from './i18n/LanguageSwitcher'
import { useLocale } from './i18n/LocaleContext'

type AppTab = 'pages' | 'points' | 'attendance'

function readTabFromUrl(): AppTab {
  const tab = new URLSearchParams(window.location.search).get('tab')
  return tab === 'points' || tab === 'attendance' ? tab : 'pages'
}

function App() {
  const { ready, user, accessToken, error, signIn, signOut } = useGoogleAuth()
  const { t } = useLocale()
  const [activeTab, setActiveTab] = useState<AppTab>(readTabFromUrl)

  useEffect(() => {
    const handlePopState = () => setActiveTab(readTabFromUrl())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const selectTab = (tab: AppTab) => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.pushState(null, '', url)
    setActiveTab(tab)
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-start gap-6 bg-gray-50 px-4 py-8 sm:justify-center">
      <LanguageSwitcher className="absolute top-4 end-4" />

      <h1 className="text-2xl font-semibold text-gray-900">{t('appTitle')}</h1>

      {error && <p className="max-w-md text-center text-sm text-red-600">{error}</p>}

      {!user ? (
        <SignInButton onClick={signIn} disabled={!ready} />
      ) : (
        <div className="flex w-full max-w-2xl flex-col items-center gap-3">
          <div className="flex w-full max-w-md items-center justify-between px-6 text-sm text-gray-500">
            <span>{t('signedInAs', { email: user.email })}</span>
            <button
              type="button"
              onClick={signOut}
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              {t('signOut')}
            </button>
          </div>
          <div className="grid w-full max-w-md grid-cols-3 gap-1 rounded-md border border-gray-200 bg-white p-1">
            {(['pages', 'points', 'attendance'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => selectTab(tab)}
                aria-current={activeTab === tab ? 'page' : undefined}
                className={`min-h-10 rounded px-3 text-sm font-semibold ${
                  activeTab === tab
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab === 'pages'
                  ? t('pagesTab')
                  : tab === 'points'
                    ? t('pointsTab')
                    : t('attendanceTab')}
              </button>
            ))}
          </div>
          {activeTab === 'pages' ? (
            <EntryForm user={user} ready={ready && accessToken !== null} />
          ) : activeTab === 'points' ? (
            <PointsForm user={user} ready={ready && accessToken !== null} />
          ) : (
            <AttendanceForm ready={ready && accessToken !== null} />
          )}
        </div>
      )}
    </div>
  )
}

export default App
