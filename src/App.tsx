import { Sidebar, TAB_LABELS } from './Sidebar'
import { ActivationView } from './form/ActivationView'
import { StudentFilter } from './students/StudentFilter'
import { useGoogleAuth } from './auth/useGoogleAuth'
import { SignInButton } from './auth/SignInButton'
import { PagesTab } from './form/PagesTab'
import { PointsForm } from './form/PointsForm'
import { CstForm } from './form/CstForm'
import { AttendanceForm } from './form/AttendanceForm'
import { GroupView } from './form/GroupView'
import { RosterView } from './form/RosterView'
import { FinalsView } from './stats/FinalsView'
import { MemorizationView } from './stats/MemorizationView'
import { LanguageSwitcher } from './i18n/LanguageSwitcher'
import { UserMenu } from './auth/UserMenu'
import { useLocale } from './i18n/LocaleContext'
import { PwaUpdateToast } from './PwaUpdateToast'
import { DataRefresh } from './DataRefresh'
import { useQueryState } from './url/queryState'

function App() {
  const { ready, user, accessToken, error, signIn, signOut } = useGoogleAuth()
  const { t } = useLocale()
  const [state] = useQueryState()
  const activeTab = state.tab

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-start gap-2 bg-gray-50 px-4 pt-28 pb-3 sm:gap-6 sm:pt-28 sm:pb-8 print:min-h-0 print:justify-start print:gap-0 print:bg-white print:p-0">
      <LanguageSwitcher className="absolute top-2 left-2 sm:top-4 sm:left-4 print:hidden" />
      {user && <UserMenu user={user} onSignOut={signOut} className="absolute top-2 right-2 sm:top-4 sm:right-4 print:hidden" />}

      <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl print:hidden">{t(user && accessToken ? TAB_LABELS[activeTab] : 'appTitle')}</h1>

      {error && <p className="max-w-md text-center text-sm text-red-600 print:hidden">{error}</p>}

      {!user ? (
        <SignInButton onClick={signIn} disabled={!ready} />
      ) : (
        <div className="flex w-full max-w-7xl flex-col items-center gap-2 sm:gap-3 print:max-w-none print:gap-0">
          {!accessToken ? (
            <SignInButton onClick={signIn} disabled={!ready} />
          ) : (
            <>
              <DataRefresh />
              <StudentFilter key={user.email} ready={ready}>
                <div className="flex w-full flex-col items-start gap-4 lg:flex-row lg:gap-6 print:block">
                  <Sidebar />
                  <main className="flex min-w-0 w-full flex-1 justify-center print:block" aria-label={t(TAB_LABELS[activeTab])}>
                {activeTab === 'pages' ? (
                  <PagesTab user={user} ready={ready} />
                ) : activeTab === 'memorization' ? (
                  <MemorizationView ready={ready} />
                ) : activeTab === 'points' ? (
                  <PointsForm user={user} ready={ready} />
                ) : activeTab === 'cst' ? (
                  <CstForm ready={ready} />
                ) : activeTab === 'students' ? (
                  <RosterView ready={ready} />
                ) : activeTab === 'activation' ? (
                  <ActivationView ready={ready} />
                ) : activeTab === 'groups' ? (
                  <GroupView ready={ready} />
                ) : activeTab === 'finals' ? (
                  <FinalsView ready={ready} />
                ) : (
                  <AttendanceForm ready={ready} />
                )}
                  </main>
                </div>
              </StudentFilter>
            </>
          )}
        </div>
      )}
      <PwaUpdateToast />
    </div>
  )
}

export default App
