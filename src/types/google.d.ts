export {}

declare global {
  interface Window {
    gapi: GapiNamespace
  }
}

interface GapiNamespace {
  load(api: string, callback: () => void): void
  client: GapiClient
}

interface GapiClient {
  init(args: Record<string, unknown>): Promise<void>
  load(api: string, version: string): Promise<void>
  setToken(token: { access_token: string } | null): void
  sheets: {
    spreadsheets: {
      get(params: {
        spreadsheetId: string
        fields: string
      }): Promise<{ result: { sheets?: { properties: { sheetId: number; title: string } }[] } }>
      values: {
        get(params: {
          spreadsheetId: string
          range: string
        }): Promise<{ result: { values?: string[][] } }>
        append(params: {
          spreadsheetId: string
          range: string
          valueInputOption: string
          resource: { values: string[][] }
        }): Promise<unknown>
        update(params: {
          spreadsheetId: string
          range: string
          valueInputOption: string
          resource: { values: string[][] }
        }): Promise<unknown>
      }
    }
  }
}
