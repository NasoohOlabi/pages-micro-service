export function sheetDataRows(rows: string[][], includeArchived = false): string[][] {
  const archivedIndex = (rows[0] ?? []).findIndex(
    (header) => ['archived', 'مؤرشفة'].includes(header.trim().toLowerCase()),
  )
  return rows.slice(1).filter(
    (row) => includeArchived || row[archivedIndex]?.trim().toLowerCase() !== 'yes',
  )
}
