/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_SHEET_ID: string
  readonly VITE_SHEET_RANGE: string
  readonly VITE_POINTS_SHEET_RANGE: string
  readonly VITE_ATTENDANCE_SHEET_ID: string
  readonly VITE_ATTENDANCE_SHEET_NAME: string
  readonly VITE_ROSTER_SHEET_ID: string
  readonly VITE_ROSTER_GID: string
  readonly VITE_ROSTER_NAME_COLUMN: string
  readonly VITE_TEACHERS_SHEET_ID: string
  readonly VITE_TEACHERS_SHEET_NAME: string
  readonly VITE_TEACHERS_NAME_COLUMN: string
  readonly VITE_TEACHERS_EMAIL_COLUMN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
