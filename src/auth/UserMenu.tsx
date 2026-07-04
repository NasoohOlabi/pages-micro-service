import { useEffect, useRef, useState } from 'react'
import type { GoogleUser } from './useGoogleAuth'
import { useLocale } from '../i18n/LocaleContext'

interface UserMenuProps {
  user: GoogleUser
  onSignOut: () => void
  className?: string
}

export function UserMenu({ user, onSignOut, className }: UserMenuProps) {
  const { t } = useLocale()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className={className ?? 'relative'}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex size-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500"
      >
        {initial}
      </button>
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-64 rounded-md border border-gray-200 bg-white p-2 text-start shadow-lg"
        >
          <p className="truncate px-2 py-1 text-sm text-gray-500">
            {t('signedInAs', { email: user.email })}
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false)
              onSignOut()
            }}
            className="mt-1 block w-full rounded px-2 py-2 text-start text-sm font-medium text-indigo-600 hover:bg-indigo-50"
          >
            {t('signOut')}
          </button>
        </div>
      )}
    </div>
  )
}
