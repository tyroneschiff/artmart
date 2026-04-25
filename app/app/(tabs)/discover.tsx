import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Modal } from 'react-native'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../hooks/useAuthStore'
import { colors, type, btn, card } from '../../lib/theme'
import CreditsChip from '../../components/CreditsChip'

type SortMode = 'top' | 'new' | 'popular'

type Piece = {
  id: string
  title: string
  transformed_image_url: string
  watermarked_image_url?: string
  vote_count: number
  view_count: number
  store_id: string
  created_at: string
  stores: { child_name: string; slug: string }
}

async function fetchPieces(sort: SortMode): Promise<Piece[]> {
  const orderCol = sort === 'top' ? 'vote_count' : sort === 'popular' ? 'view_count' : 'created_at'
  const { data, error } = await supabase
    .from('pieces')
    .select('id, title, transformed_image_url, watermarked_image_url, vote_count, view_count, store_id, created_at, stores(child_name, slug)')
    .eq('published', true)
    .not('transformed_image_url', 'is', null)
    .order(orderCol, { ascending: false })
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

const SORT_OPTIONS: { value: SortMode; label: string; icon: string }[] = [
  { value: 'top', label: 'Most loved', icon: '♥' },
  { value: 'popular', label: 'Most visited', icon: '◉' },
  { value: 'new', label: 'Newest', icon: '✦' },
]

export default function DiscoverScreen() {
  const session = useAuthStore((s) => s.session)
  const queryClient = useQueryClient()
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set())
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<SortMode>('top')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const { data: pieces, isLoading, error, refetch } = useQuery({
    queryKey: ['discover', sort],
    queryFn: () => fetchPieces(sort),
  })

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
      queryClient.setQueryData<Piece[]>(['discover', sort], (old) =>
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

  const activeOption = SORT_OPTIONS.find(o => o.value === sort)!

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
      <View style={styles.headerBlock}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>Discover</Text>
          <CreditsChip />
        </View>
        <TouchableOpacity style={styles.sortBtn} onPress={() => setDropdownOpen(true)} activeOpacity={0.7}>
          <Text style={styles.sortBtnText}>{activeOption.icon} {activeOption.label}</Text>
          <Text style={styles.sortCaret}>▾</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={dropdownOpen} transparent animationType="fade" onRequestClose={() => setDropdownOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setDropdownOpen(false)}>
          <View style={styles.dropdown}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.dropdownItem, sort === opt.value && styles.dropdownItemActive]}
                onPress={() => { setSort(opt.value); setDropdownOpen(false) }}
              >
                <Text style={[styles.dropdownItemText, sort === opt.value && styles.dropdownItemTextActive]}>
                  {opt.icon} {opt.label}
                </Text>
                {sort === opt.value && <Text style={styles.dropdownCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

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
              <View style={styles.imageWrap}>
                <Image source={{ uri: item.watermarked_image_url || item.transformed_image_url }} style={styles.image} />
                <TouchableOpacity
                  style={[styles.voteBadge, !canVote && styles.voteBadgeDone]}
                  onPress={() => {
                    if (!session) {
                      router.push({ pathname: '/(auth)/login', params: { returnTo: `/piece/${item.id}?vote=1` } })
                    } else if (canVote) {
                      voteMutation.mutate(item.id)
                    }
                  }}
                  disabled={isVoted || isVoting}
                >
                  <Text style={styles.voteBadgeText}>♥ {item.vote_count}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.childName}>{item.stores?.child_name}</Text>
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
  headerBlock: { paddingHorizontal: 20, marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  header: { ...type.h1 },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: colors.goldMid,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  sortBtnText: { ...type.label, color: colors.goldDark, fontWeight: '700', fontSize: 13 },
  sortCaret: { fontSize: 10, color: colors.goldDark, marginTop: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-start', paddingTop: 140, paddingHorizontal: 20 },
  dropdown: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  dropdownItemActive: { backgroundColor: colors.goldLight },
  dropdownItemText: { ...type.body, color: colors.dark, fontWeight: '600' },
  dropdownItemTextActive: { color: colors.goldDark, fontWeight: '700' },
  dropdownCheck: { color: colors.gold, fontWeight: '700', fontSize: 16 },
  row: { paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  card: { flex: 1, ...card, overflow: 'hidden' },
  imageWrap: { position: 'relative' },
  image: { width: '100%', aspectRatio: 1 },
  voteBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 4 },
  voteBadgeDone: { opacity: 0.6 },
  voteBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  cardBody: { padding: 12 },
  title: { ...type.h3, fontSize: 13, letterSpacing: -0.2 },
  childName: { ...type.label, marginTop: 2 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { ...type.h2, fontSize: 18, marginBottom: 8 },
  emptyBody: { ...type.body, fontSize: 14, textAlign: 'center' },
  errorText: { ...type.body, marginBottom: 16 },
  retryBtn: { ...btn.primary, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { ...btn.primaryText, fontSize: 15 },
})
