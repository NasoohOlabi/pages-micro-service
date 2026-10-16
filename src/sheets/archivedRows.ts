export function sheetDataRows(rows: string[][], includeArchived = false): string[][] {
  const archivedIndex = (rows[0] ?? []).findIndex(
    (header) => header.trim().toLowerCase() === 'archived',
  )
  return rows.slice(1).filter(
    (row) => includeArchived || row[archivedIndex]?.trim().toLowerCase() !== 'yes',
  )
}
