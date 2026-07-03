export {}

declare global {
  interface Window {
    gapi: GapiNamespace
    google: GoogleIdentityNamespace
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

interface GoogleIdentityNamespace {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string
        scope: string
        callback: (response: TokenResponse) => void
        error_callback?: (error: TokenClientError) => void
      }): TokenClient
      revoke(accessToken: string, callback?: () => void): void
    }
  }
}

interface TokenClient {
  requestAccessToken(overrideConfig?: { prompt?: '' | 'consent' | 'select_account' }): void
}

interface TokenResponse {
  access_token: string
  expires_in?: number
  scope?: string
  error?: string
}

interface TokenClientError {
  type?: string
  message?: string
}
