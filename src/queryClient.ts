import { QueryClient } from '@tanstack/react-query'
import { clearReferenceCache, restoreReferenceCache, saveReferenceCache } from './referenceCache'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 60_000,
      gcTime: 4 * 60 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: (query) => query.state.status !== 'error',
      retryOnMount: false,
      retry: false,
    },
    mutations: { retry: false },
  },
})

let userEmail: string | null = null
export let cacheSession = 0

export async function refreshActiveQueries() {
  await queryClient.invalidateQueries({ refetchType: 'none' })
  await queryClient.refetchQueries({ type: 'active' }, { throwOnError: true })
}

export function setQueryUser(email: string | null) {
  if (email === null) clearReferenceCache()
  if (email === userEmail) return
  userEmail = null
  cacheSession += 1
  queryClient.clear()
  if (email) restoreReferenceCache(queryClient, email)
  userEmail = email
}

queryClient.getQueryCache().subscribe((event) => {
  const kind = event.query.queryKey[0]
  if (userEmail && typeof kind === 'string' && ['roster', 'roster-title', 'teachers'].includes(kind) && event.type === 'updated' && ['success', 'invalidate', 'error'].includes(event.action.type)) {
    saveReferenceCache(queryClient, userEmail)
  }
})
