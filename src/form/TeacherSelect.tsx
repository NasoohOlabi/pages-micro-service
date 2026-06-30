import { forwardRef, useEffect, useState } from 'react'
import { fetchTeachers, findTeacherByEmail, type Teacher } from '../sheets/teachersClient'
import { SheetsAccessError } from '../sheets/sheetsClient'
import { useLocale } from '../i18n/LocaleContext'

interface TeacherSelectProps {
  id: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  userEmail: string
  hasUserSetValue: boolean
}

export const TeacherSelect = forwardRef<HTMLSelectElement, TeacherSelectProps>(
  function TeacherSelect({ id, value, onChange, onBlur, userEmail, hasUserSetValue }, ref) {
    const { t } = useLocale()
    const [teachers, setTeachers] = useState<Teacher[]>([])
    const [loadError, setLoadError] = useState<string | null>(null)

    useEffect(() => {
      let cancelled = false
      fetchTeachers()
        .then((result) => {
          if (cancelled) return
          setTeachers(result)
          if (!hasUserSetValue) {
            const defaultTeacher = findTeacherByEmail(result, userEmail)
            if (defaultTeacher) onChange(defaultTeacher.name)
          }
        })
        .catch((err) => {
          if (cancelled) return
          setLoadError(
            err instanceof SheetsAccessError ? err.message : t('teacherLoadError'),
          )
        })
      return () => {
        cancelled = true
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userEmail])

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
