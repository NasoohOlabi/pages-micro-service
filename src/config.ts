function requireEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export const config = {
  firebase: {
    apiKey: requireEnv('VITE_FIREBASE_API_KEY'),
    authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: requireEnv('VITE_FIREBASE_PROJECT_ID'),
    appId: requireEnv('VITE_FIREBASE_APP_ID'),
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  },
  sheetId: requireEnv('VITE_SHEET_ID'),
  sheetRange: requireEnv('VITE_SHEET_RANGE'),
  pointsSheetRange: requireEnv('VITE_POINTS_SHEET_RANGE'),
  attendanceSheetId: requireEnv('VITE_ATTENDANCE_SHEET_ID'),
  attendanceSheetName: requireEnv('VITE_ATTENDANCE_SHEET_NAME'),
  rosterSheetId: requireEnv('VITE_ROSTER_SHEET_ID'),
  rosterGid: requireEnv('VITE_ROSTER_GID'),
  rosterNameColumn: requireEnv('VITE_ROSTER_NAME_COLUMN'),
  teachersSheetId: requireEnv('VITE_TEACHERS_SHEET_ID'),
  teachersSheetName: requireEnv('VITE_TEACHERS_SHEET_NAME'),
  teachersNameColumn: requireEnv('VITE_TEACHERS_NAME_COLUMN'),
  teachersEmailColumn: requireEnv('VITE_TEACHERS_EMAIL_COLUMN'),
}
