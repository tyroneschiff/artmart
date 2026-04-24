import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../hooks/useAuthStore'
import { supabase } from './supabase'

export function useCredits() {
  const userId = useAuthStore((s) => s.session?.user.id)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId) return

    const channelName = `credits-${userId}`
    const existing = supabase.getChannels().find((c: any) => c.topic === `realtime:${channelName}`)
    if (existing) supabase.removeChannel(existing)

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ['credits', userId] })
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, queryClient])

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
  return (userId: string) => qc.invalidateQueries({ queryKey: ['credits', userId] })
}
