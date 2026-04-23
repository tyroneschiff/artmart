import { useState } from 'react'
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { colors, type, btn, card } from '../../lib/theme'
import ShareSheet from '../../components/ShareSheet'
import { buildStoreShareMessage, SharePayload } from '../../lib/share'

type Piece = { id: string; title: string; transformed_image_url: string; vote_count: number; price_digital: number; price_print: number }
type Store = { id: string; child_name: string; slug: string; description: string }

async function fetchStore(slug: string) {
  const { data: store, error } = await supabase.from('stores').select('*').eq('slug', slug).single()
  if (error) throw error
  const { data: pieces, error: e2 } = await supabase
    .from('pieces')
    .select('id, title, transformed_image_url, vote_count, price_digital, price_print')
    .eq('store_id', store.id)
    .eq('published', true)
    .order('vote_count', { ascending: false })
  if (e2) throw e2
  return { store: store as Store, pieces: pieces as Piece[] }
}

export default function StoreScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['store', slug], queryFn: () => fetchStore(slug) })
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null)

  function handleShare() {
    if (!data) return
    setSharePayload(buildStoreShareMessage(data.store.child_name, slug))
  }

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.gold} /></View>
  
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load store</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!data) return <View style={styles.center}><Text style={{ color: colors.mid }}>Store not found.</Text></View>

  const { store, pieces } = data

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>Share store</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.storeHeader}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{store.child_name[0].toUpperCase()}</Text></View>
        <Text style={styles.storeName}>{store.child_name}'s Store</Text>
        <Text style={styles.pieceCount}>{pieces.length} world{pieces.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={pieces}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/piece/${item.id}`)}>
            <Image source={{ uri: item.transformed_image_url }} style={styles.image} />
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
        contentContainerStyle={{ paddingBottom: 24 }}
      />

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
  storeHeader: { alignItems: 'center', paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 16, paddingHorizontal: 20 },
  avatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1.5, borderColor: colors.goldMid },
  avatarText: { fontSize: 28, fontWeight: '900', color: colors.goldDark },
  storeName: { ...type.h2 },
  pieceCount: { ...type.label, marginTop: 4 },
  row: { paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  card: { flex: 1, ...card, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 1 },
  cardBody: { padding: 12 },
  title: { ...type.h3, fontSize: 13 },
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { ...type.h2, fontSize: 18, marginBottom: 8 },
  emptyBody: { ...type.body, fontSize: 14, textAlign: 'center' },
  errorText: { ...type.body, marginBottom: 16 },
  retryBtn: { ...btn.primary, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { ...btn.primaryText, fontSize: 15 },
})
