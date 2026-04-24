import { useState, useMemo } from 'react'
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Modal } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { colors, type, btn, card } from '../../lib/theme'
import ShareSheet from '../../components/ShareSheet'
import { buildStoreShareMessage, SharePayload } from '../../lib/share'

type Piece = { id: string; title: string; transformed_image_url: string; watermarked_image_url?: string; vote_count: number; price_digital: number; price_print: number; created_at: string }
type Store = { id: string; child_name: string; slug: string; description: string }
type SortMode = 'top' | 'new'

async function fetchStore(slug: string) {
  const { data: store, error } = await supabase.from('stores').select('*').eq('slug', slug).single()
  if (error) throw error
  const { data: pieces, error: e2 } = await supabase
    .from('pieces')
    .select('id, title, transformed_image_url, watermarked_image_url, vote_count, price_digital, price_print, created_at')
    .eq('store_id', store.id)
    .eq('published', true)
  if (e2) throw e2
  return { store: store as Store, pieces: pieces as Piece[] }
}

export default function StoreScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['store', slug], queryFn: () => fetchStore(slug) })
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null)
  const [sort, setSort] = useState<SortMode>('top')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const sortedPieces = useMemo(() => {
    if (!data?.pieces) return []
    return [...data.pieces].sort((a, b) =>
      sort === 'top' ? b.vote_count - a.vote_count : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }, [data?.pieces, sort])

  function handleShare() {
    if (!data) return
    setSharePayload(buildStoreShareMessage(data.store.child_name, slug))
  }

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.gold} /></View>

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load gallery</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!data) return <View style={styles.center}><Text style={{ color: colors.mid }}>Gallery not found.</Text></View>

  const { store } = data

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>Share</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sortedPieces}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <View>
            <View style={styles.galleryHeader}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{store.child_name[0].toUpperCase()}</Text></View>
              <Text style={styles.galleryName}>{store.child_name}'s Gallery</Text>
              <Text style={styles.pieceCount}>{data.pieces.length} world{data.pieces.length !== 1 ? 's' : ''}</Text>
            </View>
            {data.pieces.length > 1 && (
              <View style={styles.sortRow}>
                <TouchableOpacity style={styles.sortDropdown} onPress={() => setDropdownOpen(true)}>
                  <Text style={styles.sortDropdownText}>{sort === 'top' ? '♥ Top worlds' : '✦ New worlds'}</Text>
                  <Text style={styles.sortCaret}>▾</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/piece/${item.id}`)}>
            <View style={styles.imageWrap}>
              <Image source={{ uri: item.watermarked_image_url || item.transformed_image_url }} style={styles.image} />
              {item.vote_count > 0 && (
                <View style={styles.voteBadge}>
                  <Text style={styles.voteBadgeText}>♥ {item.vote_count}</Text>
                </View>
              )}
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={styles.emptyTitle}>A world yet to be built</Text>
            <Text style={styles.emptyBody}>{store.child_name} is still dreaming up their first world. Check back soon to step inside.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/discover')}>
          <Text style={styles.navIcon}>✦</Text>
          <Text style={styles.navLabel}>Discover</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/create')}>
          <Text style={styles.navIcon}>✨</Text>
          <Text style={styles.navLabel}>Create</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push('/(tabs)/mystores')}>
          <Text style={styles.navIcon}>🎨</Text>
          <Text style={styles.navLabel}>My Galleries</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={dropdownOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setDropdownOpen(false)} activeOpacity={1}>
          <View style={styles.dropdownMenu}>
            {(['top', 'new'] as SortMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.dropdownItem, sort === mode && styles.dropdownItemActive]}
                onPress={() => { setSort(mode); setDropdownOpen(false) }}
              >
                <Text style={[styles.dropdownItemText, sort === mode && styles.dropdownItemTextActive]}>
                  {mode === 'top' ? '♥ Top worlds' : '✦ New worlds'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <ShareSheet
        visible={!!sharePayload}
        payload={sharePayload}
        onClose={() => setSharePayload(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream, paddingTop: 56 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, color: colors.dark, lineHeight: 26 },
  shareBtn: { ...btn.primary, paddingHorizontal: 16, paddingVertical: 9 },
  shareBtnText: { ...btn.primaryText, fontSize: 13 },
  galleryHeader: { alignItems: 'center', paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 12, paddingHorizontal: 20 },
  avatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1.5, borderColor: colors.goldMid },
  avatarText: { fontSize: 28, fontWeight: '900', color: colors.goldDark },
  galleryName: { ...type.h2 },
  pieceCount: { ...type.label, marginTop: 4 },
  sortRow: { paddingHorizontal: 16, marginBottom: 12 },
  sortDropdown: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, backgroundColor: colors.white, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  sortDropdownText: { fontSize: 13, fontWeight: '700', color: colors.dark },
  sortCaret: { fontSize: 11, color: colors.muted },
  row: { paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  card: { flex: 1, ...card, overflow: 'hidden' },
  imageWrap: { position: 'relative' },
  image: { width: '100%', aspectRatio: 1 },
  voteBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 4 },
  voteBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  cardBody: { padding: 12 },
  title: { ...type.h3, fontSize: 13 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { ...type.h2, fontSize: 18, marginBottom: 8 },
  emptyBody: { ...type.body, fontSize: 14, textAlign: 'center' },
  errorText: { ...type.body, marginBottom: 16 },
  retryBtn: { ...btn.primary, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { ...btn.primaryText, fontSize: 15 },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: 28, paddingTop: 10 },
  navItem: { flex: 1, alignItems: 'center', gap: 3 },
  navIcon: { fontSize: 18 },
  navLabel: { fontSize: 11, fontWeight: '600', color: colors.mid },
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-start', paddingTop: 220, paddingHorizontal: 16 },
  dropdownMenu: { backgroundColor: colors.white, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  dropdownItem: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropdownItemActive: { backgroundColor: colors.goldLight },
  dropdownItemText: { fontSize: 15, fontWeight: '600', color: colors.dark },
  dropdownItemTextActive: { color: colors.goldDark },
})
