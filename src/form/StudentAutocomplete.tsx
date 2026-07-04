import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import Fuse from 'fuse.js'
import { fetchRosterNames } from '../sheets/rosterClient'
import { SheetsAccessError } from '../sheets/sheetsClient'
import { englishKeysToArabic } from '../utils/keymap'
import { useLocale } from '../i18n/LocaleContext'

interface StudentAutocompleteProps {
  id: string
  value: string
  onChange: (value: string) => void
  onSelect?: (value: string) => void
  onBlur: () => void
  ready: boolean
}

export const StudentAutocomplete = forwardRef<HTMLInputElement, StudentAutocompleteProps>(
  function StudentAutocomplete({ id, value, onChange, onSelect, onBlur, ready }, forwardedRef) {
    const { t } = useLocale()
    const [names, setNames] = useState<string[]>([])
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement)

    useEffect(() => {
      if (!ready) return
      let cancelled = false
      fetchRosterNames()
        .then((result) => {
          if (!cancelled) setNames(result)
        })
        .catch((err) => {
          if (cancelled) return
          setLoadError(
            err instanceof SheetsAccessError ? err.message : t('rosterLoadError'),
          )
        })
      return () => {
        cancelled = true
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready])

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const fuse = useMemo(
      () => new Fuse(names, { threshold: 0.4, ignoreLocation: true }),
      [names],
    )

    const matches = useMemo(() => {
      if (!value.trim()) return names.slice(0, 8)
      const keymapValue = englishKeysToArabic(value)
      const results = fuse.search(value)
      if (keymapValue !== value) results.push(...fuse.search(keymapValue))
      const seen = new Set<string>()
      const deduped: string[] = []
      for (const result of results) {
        if (seen.has(result.item)) continue
        seen.add(result.item)
        deduped.push(result.item)
        if (deduped.length === 8) break
      }
      return deduped
    }, [fuse, names, value])

    function selectMatch(name: string) {
      ;(onSelect ?? onChange)(name)
      setIsOpen(false)
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
      if (!isOpen || matches.length === 0) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setHighlightedIndex((i) => Math.min(i + 1, matches.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setHighlightedIndex((i) => Math.max(i - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        selectMatch(matches[highlightedIndex])
      } else if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    return (
      <div ref={containerRef} className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          autoComplete="off"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setHighlightedIndex(0)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:border-indigo-500 focus:outline-none sm:py-3"
        />
        {loadError && <p className="mt-1 text-sm text-red-600">{loadError}</p>}
        {isOpen && matches.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white text-sm shadow-lg">
            {matches.map((name, index) => (
              <li key={name}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectMatch(name)}
                  className={`block w-full px-3 py-3 text-start ${
                    index === highlightedIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  },
)
