import { createContext, useContext } from 'react'
import type { RosterSheet } from '../sheets/rosterClient'

export const StudentFilterContext = createContext<{
  visible: (name: string) => boolean
  refresh: (sheet: RosterSheet) => void
} | null>(null)

function useFilterContext() {
  const context = useContext(StudentFilterContext)
  if (!context) throw new Error('Student filter provider missing')
  return context
}

export function useStudentFilter() {
  return useFilterContext().visible
}

export function useRefreshRoster() {
  return useFilterContext().refresh
}
