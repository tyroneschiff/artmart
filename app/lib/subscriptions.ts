// Gallery subscriptions client API.
//
// Read-state hooks return false when signed out so the UI can show
// "Follow" without flicker. Mutation helpers throw if signed out —
// the caller is responsible for routing to login first.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuthStore } from '../hooks/useAuthStore'

export function useIsSubscribed(storeId: string | undefined) {
  const session = useAuthStore((s) => s.session)
  const userId = session?.user.id
  return useQuery({
    queryKey: ['subscription', storeId, userId],
    enabled: !!storeId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('store_id', storeId!)
        .eq('subscriber_id', userId!)
        .maybeSingle()
      if (error) throw error
      return !!data
    },
  })
}

export function useSubscriberCount(storeId: string | undefined) {
  return useQuery({
    queryKey: ['subscriberCount', storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeId!)
      if (error) throw error
      return count ?? 0
    },
  })
}

export function useToggleSubscription(storeId: string | undefined) {
  const session = useAuthStore((s) => s.session)
  const userId = session?.user.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (next: boolean) => {
      if (!userId) throw new Error('Not signed in')
      if (!storeId) throw new Error('No gallery')
      if (next) {
        const { error } = await supabase
          .from('subscriptions')
          .upsert(
            { subscriber_id: userId, store_id: storeId },
            { onConflict: 'subscriber_id,store_id', ignoreDuplicates: true },
          )
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('subscriptions')
          .delete()
          .eq('subscriber_id', userId)
          .eq('store_id', storeId)
        if (error) throw error
      }
      return next
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription', storeId, userId] })
      qc.invalidateQueries({ queryKey: ['subscriberCount', storeId] })
      qc.invalidateQueries({ queryKey: ['mySubscriptions'] })
    },
  })
}
