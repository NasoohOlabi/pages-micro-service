import { config } from '../config'
import { withTokenRetry } from '../auth/token'
import { SheetsAccessError } from './sheetsClient'

let rosterPromise: Promise<string[]> | null = null
let rosterSheetPromise: Promise<RosterSheet> | null = null

export interface RosterSheet {
  headers: string[]
  rows: string[][]
  nameColumnIndex: number
}

async function resolveTabTitle(): Promise<string> {
  const response = await withTokenRetry(() =>
    window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId: config.rosterSheetId,
      fields: 'sheets.properties',
    }),
  )
  const targetGid = Number(config.rosterGid)
  const sheet = response.result.sheets?.find((s) => s.properties.sheetId === targetGid)
  if (!sheet) {
    throw new Error(`Roster tab with gid ${config.rosterGid} not found.`)
  }
  return sheet.properties.title
}

function quoteSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`
}

function columnLetterToIndex(column: string): number {
  const index = column
    .trim()
    .toUpperCase()
    .split('')
    .reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1
  return Math.max(index, 0)
}

function handleRosterAccessError(err: unknown): never {
  const status = (err as { status?: number; result?: { error?: { code?: number } } })?.status
  const code = status ?? (err as { result?: { error?: { code?: number } } })?.result?.error?.code
  if (code === 403) {
    throw new SheetsAccessError(
      "You don't have access to the roster sheet — ask an admin to share it with you.",
    )
  }
  throw err
}

async function loadRosterNames(): Promise<string[]> {
  try {
    const title = await resolveTabTitle()
    const range = `${quoteSheetTitle(title)}!${config.rosterNameColumn}2:${config.rosterNameColumn}`
    const response = await withTokenRetry(() =>
      window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: config.rosterSheetId,
        range,
      }),
    )
    const rows = response.result.values ?? []
    const names = rows.map((row) => row[0]?.trim()).filter((name): name is string => !!name)
    return Array.from(new Set(names))
  } catch (err) {
    handleRosterAccessError(err)
  }
}

async function loadRosterSheet(): Promise<RosterSheet> {
  try {
    const title = await resolveTabTitle()
    const response = await withTokenRetry(() =>
      window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: config.rosterSheetId,
        range: `${quoteSheetTitle(title)}!A:ZZ`,
      }),
    )
    const values = response.result.values ?? []
    const headers = (values[0] ?? []).map((value) => String(value ?? '').trim())
    const rows = values
      .slice(1)
      .map((row) => row.map((value) => String(value ?? '').trim()))
      .filter((row) => row.some(Boolean))
    return { headers, rows, nameColumnIndex: columnLetterToIndex(config.rosterNameColumn) }
  } catch (err) {
    handleRosterAccessError(err)
  }
}

export async function appendRosterStudent(values: string[]): Promise<void> {
  try {
    const title = await resolveTabTitle()
    await withTokenRetry(() =>
      window.gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: config.rosterSheetId,
        range: `${quoteSheetTitle(title)}!A:ZZ`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [values] },
      }),
    )
    rosterPromise = null
    rosterSheetPromise = null
  } catch (err) {
    handleRosterAccessError(err)
  }
}

// Cached for the session: the roster rarely changes mid-session and is fetched on first use.
export function fetchRosterNames(): Promise<string[]> {
  if (!rosterPromise) {
    rosterPromise = loadRosterNames().catch((err) => {
      rosterPromise = null
      throw err
    })
  }
  return rosterPromise
}

export function fetchRosterSheet(): Promise<RosterSheet> {
  if (!rosterSheetPromise) {
    rosterSheetPromise = loadRosterSheet().catch((err) => {
      rosterSheetPromise = null
      throw err
    })
  }
  return rosterSheetPromise
}
