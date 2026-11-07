import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 15 * 60_000,
      refetchOnWindowFocus: false,
      retry: false,
    },
    mutations: { retry: false },
  },
})

let userEmail: string | null = null
export let cacheSession = 0

export function setQueryUser(email: string | null) {
  if (email === userEmail) return
  userEmail = email
  cacheSession += 1
  queryClient.clear()
}
