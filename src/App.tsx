import { lazy, Suspense } from 'react'
import { Sidebar, TAB_LABELS } from './Sidebar'
import { StudentFilter } from './students/StudentFilter'
import { useGoogleAuth } from './auth/useGoogleAuth'
import { SignInButton } from './auth/SignInButton'
import { LanguageSwitcher } from './i18n/LanguageSwitcher'
import { UserMenu } from './auth/UserMenu'
import { useLocale } from './i18n/LocaleContext'
import { PwaUpdateToast } from './PwaUpdateToast'
import { DataRefresh } from './DataRefresh'
import { useQueryState } from './url/queryState'

const ActivationView = lazy(() =>
  import('./form/ActivationView').then((module) => ({ default: module.ActivationView })),
)
const PagesTab = lazy(() => import('./form/PagesTab').then((module) => ({ default: module.PagesTab })))
const PointsForm = lazy(() => import('./form/PointsForm').then((module) => ({ default: module.PointsForm })))
const CstForm = lazy(() => import('./form/CstForm').then((module) => ({ default: module.CstForm })))
const AttendanceForm = lazy(() =>
  import('./form/AttendanceForm').then((module) => ({ default: module.AttendanceForm })),
)
const GroupView = lazy(() => import('./form/GroupView').then((module) => ({ default: module.GroupView })))
const RosterView = lazy(() => import('./form/RosterView').then((module) => ({ default: module.RosterView })))
const FinalsView = lazy(() => import('./stats/FinalsView').then((module) => ({ default: module.FinalsView })))
const MemorizationView = lazy(() =>
  import('./stats/MemorizationView').then((module) => ({ default: module.MemorizationView })),
)

function App() {
  const { ready, user, error, signIn, signOut } = useGoogleAuth()
  const { t } = useLocale()
  const [state] = useQueryState()
  const activeTab = state.tab

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-start gap-2 bg-gray-50 px-4 pt-28 pb-3 sm:gap-6 sm:pt-28 sm:pb-8 print:min-h-0 print:justify-start print:gap-0 print:bg-white print:p-0">
      <LanguageSwitcher className="absolute top-2 left-2 sm:top-4 sm:left-4 print:hidden" />
      {user && (
        <UserMenu
          user={user}
          onSignOut={signOut}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 print:hidden"
        />
      )}

      <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl print:hidden">
        {t(user ? TAB_LABELS[activeTab] : 'appTitle')}
      </h1>

      {error && <p className="max-w-md text-center text-sm text-red-600 print:hidden">{error}</p>}

      {!user ? (
        <SignInButton onClick={signIn} disabled={!ready} />
      ) : (
        <div className="flex w-full max-w-7xl flex-col items-center gap-2 sm:gap-3 print:max-w-none print:gap-0">
          <DataRefresh />
          <StudentFilter key={user.email} ready={ready}>
            <div className="flex w-full flex-col items-start gap-4 lg:flex-row lg:gap-6 print:block">
              <Sidebar />
              <main
                className="flex min-w-0 w-full flex-1 justify-center print:block"
                aria-label={t(TAB_LABELS[activeTab])}
              >
                <Suspense fallback={null}>
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
                </Suspense>
              </main>
            </div>
          </StudentFilter>
        </div>
      )}
      <PwaUpdateToast />
    </div>
  )
}

export default App
