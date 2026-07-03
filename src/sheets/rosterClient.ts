import { config } from '../config'
import { withTokenRetry } from '../auth/token'
import { SheetsAccessError } from './sheetsClient'

let rosterPromise: Promise<string[]> | null = null

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
    const status = (err as { status?: number; result?: { error?: { code?: number } } })?.status
    const code = status ?? (err as { result?: { error?: { code?: number } } })?.result?.error?.code
    if (code === 403) {
      throw new SheetsAccessError(
        "You don't have access to the roster sheet — ask an admin to share it with you.",
      )
    }
    throw err
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
