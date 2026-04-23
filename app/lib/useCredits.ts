import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../hooks/useAuthStore'
import { supabase } from './supabase'

export function useCredits() {
  const userId = useAuthStore((s) => s.session?.user.id)
  return useQuery({
    queryKey: ['credits', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId!)
        .maybeSingle()
      if (error) throw error
      return data?.credits ?? 0
    },
  })
}

export function useInvalidateCredits() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['credits'] })
}
