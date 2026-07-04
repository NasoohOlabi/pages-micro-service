export {}

declare global {
  interface Window {
    gapi: GapiNamespace
    google: GoogleNamespace
  }

  interface GoogleNamespace {
    accounts: {
      oauth2: {
        initTokenClient(config: TokenClientConfig): TokenClient
      }
    }
  }

  interface TokenClientConfig {
    client_id: string
    scope: string
    callback: (response: TokenResponse) => void
    error_callback?: (error: TokenError) => void
  }

  interface TokenResponse {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  interface TokenError {
    type?: string
    message?: string
  }

  interface TokenClient {
    requestAccessToken(overrideConfig?: { prompt?: string; hint?: string }): void
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
