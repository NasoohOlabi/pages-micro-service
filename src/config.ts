function requireEnv(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export const config = {
  googleClientId: requireEnv('VITE_GOOGLE_CLIENT_ID'),
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
