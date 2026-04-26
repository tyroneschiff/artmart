import { useState, useMemo } from 'react'
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { GallerySkeleton } from '../../components/Skeleton'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../hooks/useAuthStore'
import { colors, type, btn, card, radius } from '../../lib/theme'
import ShareSheet from '../../components/ShareSheet'
import { buildStoreShareMessage, SharePayload } from '../../lib/share'
import { saveOriginalsToPhotos, SaveProgress } from '../../lib/preservation'
import { track } from '../../lib/analytics'

type Piece = { id: string; title: string; transformed_image_url: string; watermarked_image_url?: string; original_image_url: string; vote_count: number; created_at: string }
type Store = { id: string; child_name: string; slug: string; description: string; owner_id: string }
type SortMode = 'top' | 'new'

async function fetchStore(slug: string) {
  const { data: store, error } = await supabase.from('stores').select('*').eq('slug', slug).single()
  if (error) throw error
  const { data: pieces, error: e2 } = await supabase
    .from('pieces')
    .select('id, title, transformed_image_url, watermarked_image_url, original_image_url, vote_count, created_at')
    .eq('store_id', store.id)
    .eq('published', true)
  if (e2) throw e2
  return { store: store as Store, pieces: pieces as Piece[] }
}

export default function StoreScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const session = useAuthStore((s) => s.session)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['store', slug], queryFn: () => fetchStore(slug) })
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null)
  const [sort, setSort] = useState<SortMode>('top')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [exportProgress, setExportProgress] = useState<SaveProgress | null>(null)

  const isOwner = !!session && data?.store && session.user.id === data.store.owner_id

  async function handleSaveAllOriginals() {
    if (!data || !isOwner || exportProgress) return
    const eligible = data.pieces.filter((p) => p.original_image_url)
    if (eligible.length === 0) {
      Alert.alert('Nothing to save', 'No original drawings in this gallery yet.')
      return
    }

    const noun = eligible.length === 1 ? 'original' : 'originals'
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        `Save ${eligible.length} ${noun} to Photos?`,
        'Just the drawings — the transformed worlds stay in the gallery.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Save', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      )
    })
    if (!confirmed) return

    setExportProgress({ done: 0, total: eligible.length })
    const result = await saveOriginalsToPhotos(
      eligible.map((p) => ({ id: p.id, original_image_url: p.original_image_url, childName: data.store.child_name })),
      (p) => setExportProgress(p),
    )
    setExportProgress(null)

    if (result.noPermission) {
      Alert.alert('Photos access needed', 'Please allow Photos access to save the originals.')
      return
    }

    track('original_saved', { storeId: data.store.id, metadata: { count: result.saved, total: result.total } })

    Alert.alert(
      result.saved === result.total ? 'Saved to Photos ✨' : 'Mostly saved',
      result.saved === result.total
        ? `${result.saved} original drawing${result.saved === 1 ? '' : 's'} now safe in your Photos. Look for the "Draw Up" album.`
        : `Saved ${result.saved} of ${result.total}. Try again to retry the rest.`,
    )
  }

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

  if (isLoading) return <GallerySkeleton />

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>That didn't load</Text>
        <Text style={styles.errorText}>Check your connection and try again.</Text>
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
          <Ionicons name="chevron-back" size={22} color={colors.dark} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          {isOwner && data.pieces.length > 0 && (
            <TouchableOpacity style={styles.saveAllBtn} onPress={handleSaveAllOriginals} disabled={!!exportProgress} activeOpacity={0.7}>
              {exportProgress ? (
                <Text style={styles.saveAllBtnText}>Saving {exportProgress.done}/{exportProgress.total}…</Text>
              ) : (
                <>
                  <Ionicons name="download-outline" size={15} color={colors.dark} />
                  <Text style={styles.saveAllBtnText}>Save all</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
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
                <TouchableOpacity style={styles.sortDropdown} onPress={() => setDropdownOpen(true)} activeOpacity={0.7}>
                  <Ionicons name={sort === 'top' ? 'heart' : 'sparkles'} size={13} color={colors.dark} />
                  <Text style={styles.sortDropdownText}>{sort === 'top' ? 'Most loved' : 'Newest'}</Text>
                  <Ionicons name="chevron-down" size={13} color={colors.muted} />
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
                  <Ionicons name="heart" size={12} color={colors.white} />
                  <Text style={styles.voteBadgeText}>{item.vote_count}</Text>
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
            {isOwner ? (
              <>
                <Text style={styles.emptyTitle}>{store.child_name}'s first world is waiting</Text>
                <Text style={styles.emptyBody}>Snap a photo of one of their drawings to start.</Text>
                <TouchableOpacity style={styles.emptyCta} onPress={() => router.push('/(tabs)/create')}>
                  <Text style={styles.emptyCtaText}>Create the first one</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>Just getting started</Text>
                <Text style={styles.emptyBody}>{store.child_name} is dreaming up their first world. Check back soon.</Text>
              </>
            )}
          </View>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      />

      <Modal visible={dropdownOpen} transparent animationType="fade">
        <TouchableOpacity style={styles.dropdownOverlay} onPress={() => setDropdownOpen(false)} activeOpacity={1}>
          <View style={styles.dropdownMenu}>
            {(['top', 'new'] as SortMode[]).map((mode) => {
              const active = sort === mode
              return (
              <TouchableOpacity
                key={mode}
                style={[styles.dropdownItem, active && styles.dropdownItemActive]}
                onPress={() => { setSort(mode); setDropdownOpen(false) }}
              >
                <Ionicons name={mode === 'top' ? 'heart' : 'sparkles'} size={15} color={active ? colors.goldDark : colors.dark} />
                <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>
                  {mode === 'top' ? 'Most loved' : 'Newest'}
                </Text>
              </TouchableOpacity>
              )
            })}
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
  backBtn: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shareBtn: { ...btn.primary, paddingHorizontal: 16, paddingVertical: 9 },
  shareBtnText: { ...btn.primaryText, fontSize: 13 },
  saveAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1.5, borderColor: colors.border },
  saveAllBtnText: { color: colors.dark, fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  galleryHeader: { alignItems: 'center', paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 12, paddingHorizontal: 20 },
  avatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1.5, borderColor: colors.goldMid },
  avatarText: { fontSize: 28, fontWeight: '900', color: colors.goldDark },
  galleryName: { ...type.h2 },
  pieceCount: { ...type.label, marginTop: 4 },
  sortRow: { paddingHorizontal: 16, marginBottom: 12 },
  sortDropdown: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  sortDropdownText: { fontSize: 13, fontWeight: '700', color: colors.dark, letterSpacing: -0.1 },
  row: { paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  card: { flex: 1, ...card, overflow: 'hidden' },
  imageWrap: { position: 'relative' },
  image: { width: '100%', aspectRatio: 1 },
  voteBadge: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  voteBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  cardBody: { padding: 12 },
  title: { ...type.h3, fontSize: 13 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { ...type.h2, fontSize: 20, marginBottom: 8, textAlign: 'center' },
  emptyBody: { ...type.body, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  emptyCta: { ...btn.primary, paddingHorizontal: 28, paddingVertical: 14 },
  emptyCtaText: { ...btn.primaryText, fontSize: 15 },
  errorTitle: { ...type.h2, fontSize: 22, marginBottom: 6, textAlign: 'center' },
  errorText: { ...type.body, marginBottom: 20, textAlign: 'center', fontSize: 14 },
  retryBtn: { ...btn.primary, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { ...btn.primaryText, fontSize: 15 },
  dropdownOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-start', paddingTop: 220, paddingHorizontal: 16 },
  dropdownMenu: { backgroundColor: colors.white, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropdownItemActive: { backgroundColor: colors.goldLight },
  dropdownItemText: { fontSize: 15, fontWeight: '600', color: colors.dark },
  dropdownItemTextActive: { color: colors.goldDark },
})
