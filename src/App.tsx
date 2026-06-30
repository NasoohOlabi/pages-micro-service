import { useGoogleAuth } from './auth/useGoogleAuth'
import { SignInButton } from './auth/SignInButton'
import { EntryForm } from './form/EntryForm'
import { LanguageSwitcher } from './i18n/LanguageSwitcher'
import { useLocale } from './i18n/LocaleContext'

function App() {
  const { ready, user, error, signIn, signOut } = useGoogleAuth()
  const { t } = useLocale()

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-gray-50 px-4">
      <LanguageSwitcher className="absolute top-4 end-4" />

      <h1 className="text-2xl font-semibold text-gray-900">{t('appTitle')}</h1>

      {error && <p className="max-w-md text-center text-sm text-red-600">{error}</p>}

      {!user ? (
        <SignInButton onClick={signIn} disabled={!ready} />
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-2">
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
          <EntryForm user={user} ready={ready} />
        </div>
      )}
    </div>
  )
}

export default App
