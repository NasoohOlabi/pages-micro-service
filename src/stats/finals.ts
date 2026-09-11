export interface FinalsStanding {
  name: string
  group: string
  pages: number
  cst: number
  score: number
}

function studentKey(name: string): string {
  return name.trim().toLowerCase()
}

export function computeFinalsStandings(args: {
  names: string[]
  groups: Map<string, string>
  pageRows: { student: string }[]
  pointRows: { student: string; points: number }[]
  cstRows: { student: string }[]
  pageFactor: number
  cstFactor: number
}): FinalsStanding[] {
  const byKey = new Map<string, { name: string; pages: number; points: number; cst: number }>()

  const ensure = (name: string) => {
    const key = studentKey(name)
    if (!key) return null
    const existing = byKey.get(key)
    if (existing) return existing
    const created = { name: name.trim(), pages: 0, points: 0, cst: 0 }
    byKey.set(key, created)
    return created
  }

  for (const name of args.names) ensure(name)
  for (const row of args.pageRows) {
    const student = ensure(row.student)
    if (student) student.pages += 1
  }
  for (const row of args.pointRows) {
    const student = ensure(row.student)
    if (student) student.points += row.points
  }
  for (const row of args.cstRows) {
    const student = ensure(row.student)
    if (student) student.cst += 1
  }

  return [...byKey.values()]
    .map((student) => ({
      name: student.name,
      group: args.groups.get(studentKey(student.name)) ?? '',
      pages: student.pages,
      cst: student.cst,
      score: student.points + student.pages * args.pageFactor + student.cst * args.cstFactor,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}
