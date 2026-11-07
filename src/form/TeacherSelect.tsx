import { useQuery } from '@tanstack/react-query'
import { forwardRef, useEffect } from 'react'
import { teachersQueryOptions, findTeacherByEmail } from '../sheets/teachersClient'
import { SheetsAccessError } from '../sheets/sheetsClient'
import { useLocale } from '../i18n/LocaleContext'

interface TeacherSelectProps {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  userEmail: string
  hasUserSetValue: boolean
  ready: boolean
}

export const TeacherSelect = forwardRef<HTMLSelectElement, TeacherSelectProps>(
  function TeacherSelect({ id, value, onChange, onBlur, userEmail, hasUserSetValue, ready }, ref) {
    const { t } = useLocale()
    const teachersQuery = useQuery({ ...teachersQueryOptions, enabled: ready })
    const teachers = teachersQuery.data ?? []
    const loadError = teachersQuery.error ? teachersQuery.error instanceof SheetsAccessError ? teachersQuery.error.message : t('teacherLoadError') : null
    useEffect(() => {
      if (!hasUserSetValue && teachersQuery.data) {
        const teacher = findTeacherByEmail(teachersQuery.data, userEmail)
        if (teacher && value !== teacher.name) onChange(teacher.name)
      }
    }, [teachersQuery.data, userEmail, hasUserSetValue, onChange, value])

    return (
      <div>
        <select
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="w-full rounded-md border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none"
        >
          <option value="" disabled>
            {t('selectTeacher')}
          </option>
          {teachers.map((teacher) => (
            <option key={teacher.email || teacher.name} value={teacher.name}>
              {teacher.name}
            </option>
          ))}
        </select>
        {loadError && <p className="mt-1 text-sm text-red-600">{loadError}</p>}
      </div>
    )
  },
)
