import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'

const STORAGE_KEY = 'quran-reference-cache-v1'
const rows = z.array(z.array(z.string()))
const timestamp = z.number().nonnegative().finite()
const state = { dataUpdatedAt: timestamp, isInvalidated: z.boolean() }
const entrySchema = z.union([
  z.object({
    ...state,
    queryKey: z.tuple([z.literal('roster'), z.string(), z.string(), z.string()]),
    data: z.object({ title: z.string(), headers: z.array(z.string()), rows, nameColumnIndex: z.number().int().nonnegative() }),
  }),
  z.object({
    ...state,
    queryKey: z.tuple([z.literal('roster-title'), z.string(), z.string()]),
    data: z.string(),
  }),
  z.object({
    ...state,
    queryKey: z.tuple([z.literal('teachers'), z.string(), z.string(), z.string(), z.string()]),
    data: z.array(z.object({ name: z.string(), email: z.string() })),
  }),
])
const cacheSchema = z.object({ email: z.string(), entries: z.array(entrySchema) })

export function clearReferenceCache() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage can be unavailable in private browsing or when browser policy blocks it.
  }
}

export function saveReferenceCache(client: QueryClient, email: string) {
  try {
    const entries = client.getQueryCache().getAll().flatMap((query) => {
      const parsed = entrySchema.safeParse({ queryKey: query.queryKey, ...query.state })
      return parsed.success ? [parsed.data] : []
    })
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, entries }))
  } catch {
    // The in-memory cache still works when storage is full or unavailable.
  }
}

export function restoreReferenceCache(client: QueryClient, email: string) {
  try {
    const parsed = cacheSchema.safeParse(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null'))
    if (!parsed.success || parsed.data.email !== email) {
      clearReferenceCache()
      return
    }
    for (const entry of parsed.data.entries) {
      client.setQueryDefaults(entry.queryKey, { staleTime: Infinity, gcTime: Infinity })
      client.setQueryData(entry.queryKey, entry.data, { updatedAt: entry.dataUpdatedAt })
      if (entry.isInvalidated) void client.invalidateQueries({ queryKey: entry.queryKey, exact: true, refetchType: 'none' })
    }
  } catch {
    clearReferenceCache()
  }
}
