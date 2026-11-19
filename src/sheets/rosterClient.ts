import { api } from '../api'

let rosterPromise: Promise<string[]> | null = null
let rosterSheetPromise: Promise<RosterSheet> | null = null

export interface RosterSheet {
  headers: string[]
  rows: string[][]
  nameColumnIndex: number
}

export async function appendRosterStudent(values: string[]) {
  await api('roster', values)
  rosterPromise = null
  rosterSheetPromise = null
}

// Cached for the session: the roster rarely changes mid-session and is fetched on first use.
export function fetchRosterNames(): Promise<string[]> {
  if (!rosterPromise) {
    rosterPromise = api<string[]>('names').catch((err) => {
      rosterPromise = null
      throw err
    })
  }
  return rosterPromise
}

export function fetchRosterSheet(): Promise<RosterSheet> {
  if (!rosterSheetPromise) {
    rosterSheetPromise = api<RosterSheet>('roster').catch((err) => {
      rosterSheetPromise = null
      throw err
    })
  }
  return rosterSheetPromise
}
