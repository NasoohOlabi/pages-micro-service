import { createContext, useContext } from 'react'

export const StudentFilterContext = createContext<((name: string) => boolean) | null>(null)

export function useStudentFilter() {
  const context = useContext(StudentFilterContext)
  if (!context) throw new Error('Student filter provider missing')
  return context
}
