import { LOCALES } from './translations'
import { useLocale } from './LocaleContext'

const LABELS: Record<string, string> = { en: 'EN', ar: 'AR' }

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useLocale()

  return (
    <div className={`flex items-center gap-1 rounded-md bg-white p-1 shadow ring-1 ring-gray-200 ${className}`}>
      <span className="sr-only">{t('language')}</span>
      {LOCALES.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => setLocale(value)}
          aria-pressed={locale === value}
          className={`rounded px-2 py-1 text-xs font-medium ${
            locale === value ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {LABELS[value]}
        </button>
      ))}
    </div>
  )
}
