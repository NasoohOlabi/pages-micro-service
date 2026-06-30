import { useLocale } from '../i18n/LocaleContext'

interface SignInButtonProps {
  onClick: () => void
  disabled?: boolean
}

export function SignInButton({ onClick, disabled }: SignInButtonProps) {
  const { t } = useLocale()
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-3 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow ring-1 ring-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="m6.3 14.7 6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.7 0-14.4 4.3-17.7 10.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.4 0 10.3-2.1 14-5.5l-6.5-5.4C29.4 35.3 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.5 5.4C40.9 36.6 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z"
        />
      </svg>
      {t('signInWithGoogle')}
    </button>
  )
}
