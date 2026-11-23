import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError, type User } from './api'

/** Поточний користувач (null — гість). Джерело істини — серверна сесія. */
export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return (await api.get<User | undefined>('/api/auth/me')) ?? null // 204 — гість
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: 60_000,
  })
}

export function useAuthActions() {
  const qc = useQueryClient()
  return {
    async login(email: string, password: string) {
      const user = await api.post<User>('/api/auth/login', { email, password })
      // Після входу сесія змінюється, тому скидаємо кеш, що залежить від користувача
      qc.removeQueries({ queryKey: ['bookings'] })
      qc.setQueryData(['me'], user)
      return user
    },
    async logout() {
      await api.post<void>('/api/auth/logout')
      qc.clear()
      qc.setQueryData(['me'], null)
    },
  }
}
