export class SheetsAccessError extends Error {}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    '/api/' + path,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  )
  if (response.status === 401) location.reload()
  if (response.status === 403) throw new SheetsAccessError('Ask an admin to share this sheet with you.')
  if (!response.ok) throw new Error((await response.text()) || 'Request failed')
  return response.json()
}
