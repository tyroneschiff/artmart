import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../hooks/useAuthStore'
import { supabase } from './supabase'

export function useCredits() {
  const userId = useAuthStore((s) => s.session?.user.id)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId) return

    let channel: any
    try {
      channel = supabase
        .channel(`credits-${userId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
          () => {
            queryClient.invalidateQueries({ queryKey: ['credits', userId] })
          }
        )

      channel.subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime subscription error')
        }
      })
    } catch (err) {
      console.error('Failed to setup realtime subscription:', err)
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel).catch((err) => console.error('Failed to remove channel:', err))
      }
    }
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
