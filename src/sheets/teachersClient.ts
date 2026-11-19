import { api } from '../api'

export interface Teacher {
  name: string
  email: string
}

let teachersPromise: Promise<Teacher[]> | null = null

// Cached for the session: the teacher list rarely changes mid-session and is fetched on first use.
export function fetchTeachers(): Promise<Teacher[]> {
  if (!teachersPromise) {
    teachersPromise = api<Teacher[]>('teachers').catch((err) => {
      teachersPromise = null
      throw err
    })
  }
  return teachersPromise
}

export function findTeacherByEmail(teachers: Teacher[], email: string): Teacher | undefined {
  const normalized = email.trim().toLowerCase()
  return teachers.find((teacher) => teacher.email.trim().toLowerCase() === normalized)
}
