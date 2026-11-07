export function studentKey(name: string): string {
  return name.trim().toLowerCase()
}

export function isActiveStudent(value: string | undefined): boolean {
  return value?.trim().toUpperCase() === 'TRUE'
}

export function studentVisibility(rows: string[][], nameColumn: number, allStudents: boolean) {
  const active = new Set(rows.filter((row) => isActiveStudent(row[5])).map((row) => studentKey(row[nameColumn] ?? '')))
  return (name: string) => allStudents || active.has(studentKey(name))
}
