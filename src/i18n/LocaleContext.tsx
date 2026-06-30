import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LOCALES, RTL_LOCALES, translations, type Locale, type TranslationKey } from './translations'

const STORAGE_KEY = 'locale'

function detectLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && LOCALES.includes(stored as Locale)) return stored as Locale

  for (const lang of navigator.languages ?? [navigator.language]) {
    const base = lang.toLowerCase().split('-')[0]
    if (LOCALES.includes(base as Locale)) return base as Locale
  }
  return 'en'
}

function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'
}

interface LocaleContextValue {
  locale: Locale
  dir: 'rtl' | 'ltr'
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  const dir = dirFor(locale)

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = dir
  }, [locale, dir])

  const setLocale = (next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next)
    setLocaleState(next)
  }

  const t = useMemo(() => {
    return (key: TranslationKey, params?: Record<string, string | number>) => {
      let text: string = translations[locale][key]
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.replace(`{{${name}}}`, String(value))
        }
      }
      return text
    }
  }, [locale])

  const value = useMemo(() => ({ locale, dir, setLocale, t }), [locale, dir, t])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider')
  return ctx
}
