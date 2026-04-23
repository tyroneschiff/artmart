import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../hooks/useAuthStore'
import { colors, type, btn, card } from '../../lib/theme'
import CreditsChip from '../../components/CreditsChip'

type Piece = {
  id: string
  title: string
  transformed_image_url: string
  watermarked_image_url?: string
  vote_count: number
  store_id: string
  stores: { child_name: string; slug: string }
}

async function fetchTopPieces(): Promise<Piece[]> {
  const { data, error } = await supabase
    .from('pieces')
    .select('id, title, transformed_image_url, watermarked_image_url, vote_count, store_id, stores(child_name, slug)')
    .eq('published', true)
    .not('transformed_image_url', 'is', null)
    .order('vote_count', { ascending: false })
    .limit(50)
  if (error) throw error
  return data as unknown as Piece[]
}

async function fetchUserVotes(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('votes')
    .select('piece_id')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((v: { piece_id: string }) => v.piece_id)
}

export default function DiscoverScreen() {
  const session = useAuthStore((s) => s.session)
  const queryClient = useQueryClient()
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set())
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())

  const { data: pieces, isLoading, error, refetch } = useQuery({ queryKey: ['discover'], queryFn: fetchTopPieces })

  const { data: existingVotes } = useQuery({
    queryKey: ['user-votes', session?.user.id],
    queryFn: () => fetchUserVotes(session!.user.id),
    enabled: !!session,
  })

  useEffect(() => {
    if (existingVotes) setVotedIds(new Set(existingVotes))
  }, [existingVotes])

  const voteMutation = useMutation({
    mutationFn: async (pieceId: string) => {
      const { error } = await supabase.from('votes').insert({ user_id: session!.user.id, piece_id: pieceId })
      if (error) throw error
    },
    onMutate: (pieceId) => {
      setVotingIds((prev) => new Set([...prev, pieceId]))
      queryClient.setQueryData<Piece[]>(['discover'], (old) =>
        old?.map((p) => p.id === pieceId ? { ...p, vote_count: p.vote_count + 1 } : p) ?? []
      )
    },
    onSuccess: (_, pieceId) => {
      setVotedIds((prev) => new Set([...prev, pieceId]))
      setVotingIds((prev) => { const next = new Set(prev); next.delete(pieceId); return next })
      queryClient.invalidateQueries({ queryKey: ['discover'] })
    },
    onError: (_, pieceId) => {
      setVotingIds((prev) => { const next = new Set(prev); next.delete(pieceId); return next })
      queryClient.invalidateQueries({ queryKey: ['discover'] })
    },
  })

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.gold} /></View>

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load worlds</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Discover</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <CreditsChip />
          <View style={styles.badge}><Text style={styles.badgeText}>✦ Top worlds</Text></View>
        </View>
      </View>
      <FlatList
        data={pieces}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => {
          const isVoted = votedIds.has(item.id)
          const isVoting = votingIds.has(item.id)
          const canVote = !isVoted && !isVoting
          return (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/piece/${item.id}`)}>
              <Image source={{ uri: item.watermarked_image_url || item.transformed_image_url }} style={styles.image} />
              <View style={styles.cardBody}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.childName}>{item.stores?.child_name}</Text>
                <TouchableOpacity
                  style={[styles.voteBtn, !canVote && styles.voteBtnDone]}
                  onPress={() => {
                    if (!session) {
                      router.push({ pathname: '/(auth)/login', params: { returnTo: '/(tabs)/discover' } })
                    } else if (canVote) {
                      voteMutation.mutate(item.id)
                    }
                  }}
                  disabled={!canVote}
                >
                  <Text style={styles.voteText}>♥ {item.vote_count}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={styles.emptyTitle}>The portal is waiting</Text>
            <Text style={styles.emptyBody}>No worlds have been discovered yet. Be the first to step inside a drawing and share what you find.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream, paddingTop: 56 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 },
  header: { ...type.h1 },
  badge: { backgroundColor: colors.goldLight, borderWidth: 1, borderColor: colors.goldMid, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { ...type.label, color: colors.goldDark, fontWeight: '700' },
  row: { paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  card: { flex: 1, ...card, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 1 },
  cardBody: { padding: 12 },
  title: { ...type.h3, fontSize: 13, letterSpacing: -0.2 },
  childName: { ...type.label, marginTop: 2 },
  voteBtn: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  voteBtnDone: { opacity: 0.45 },
  voteText: { fontSize: 13, color: colors.gold, fontWeight: '700' },
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { ...type.h2, fontSize: 18, marginBottom: 8 },
  emptyBody: { ...type.body, fontSize: 14, textAlign: 'center' },
  errorText: { ...type.body, marginBottom: 16 },
  retryBtn: { ...btn.primary, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { ...btn.primaryText, fontSize: 15 },
})
