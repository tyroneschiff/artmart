import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, Modal, Image } from 'react-native'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../hooks/useAuthStore'
import { colors, type, btn, card } from '../../lib/theme'
import ShareSheet from '../../components/ShareSheet'
import { buildStoreShareMessage, SharePayload } from '../../lib/share'

import { useCredits } from '../../lib/useCredits'

type StorePiece = { transformed_image_url: string | null; watermarked_image_url: string | null; created_at: string; published: boolean }
type Store = { id: string; child_name: string; slug: string; created_at: string; pieces: StorePiece[] }

async function fetchMyStores(userId: string): Promise<Store[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('id, child_name, slug, created_at, pieces(transformed_image_url, watermarked_image_url, created_at, published)')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as Store[]
}

function galleryCover(pieces: StorePiece[]): { coverUrl: string | null; count: number } {
  const published = (pieces ?? []).filter((p) => p.published && (p.transformed_image_url || p.watermarked_image_url))
  if (published.length === 0) return { coverUrl: null, count: 0 }
  const sorted = [...published].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return { coverUrl: sorted[0].transformed_image_url || sorted[0].watermarked_image_url, count: published.length }
}

export default function MyStoresScreen() {
  const session = useAuthStore((s) => s.session)
  const queryClient = useQueryClient()
  const [modalVisible, setModalVisible] = useState(false)
  const [childName, setChildName] = useState('')
  const [slug, setSlug] = useState('')
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null)

  const { data: stores, isLoading, error, refetch } = useQuery({
    queryKey: ['mystores', session?.user.id],
    queryFn: () => fetchMyStores(session!.user.id),
    enabled: !!session,
  })

  const { data: credits } = useCredits()
  const showUpsell = credits === 0 && (stores?.length === 0)

  const createStore = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('stores').insert({
        owner_id: session!.user.id,
        child_name: childName.trim(),
        slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mystores'] })
      setModalVisible(false)
      const createdSlug = slug.trim().toLowerCase().replace(/\s+/g, '-')
      const createdName = childName.trim()
      setChildName('')
      setSlug('')
      setTimeout(() => setSharePayload(buildStoreShareMessage(createdName, createdSlug)), 400)
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  })

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.gold} /></View>

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load galleries</Text>
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
          <Text style={styles.header}>My Galleries</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showUpsell && (
        <View style={styles.upsellCard}>
          <View style={styles.upsellInfo}>
            <Text style={styles.upsellTitle}>Ready to step inside?</Text>
            <Text style={styles.upsellMessage}>You'll need credits to transform drawings into magical worlds.</Text>
          </View>
          <TouchableOpacity style={styles.upsellBtn} onPress={() => router.push('/credits')}>
            <Text style={styles.upsellBtnText}>Get Credits</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={stores}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const { coverUrl, count } = galleryCover(item.pieces)
          return (
            <TouchableOpacity style={styles.storeCard} onPress={() => router.push(`/gallery/${item.slug}`)}>
              <View style={styles.coverWrap}>
                {coverUrl ? (
                  <Image source={{ uri: coverUrl }} style={styles.storeCover} />
                ) : (
                  <View style={styles.storeCoverEmpty} />
                )}
                <View style={styles.initialBadge}>
                  <Text style={styles.initialBadgeText}>{item.child_name[0].toUpperCase()}</Text>
                </View>
              </View>
              <View style={styles.storeInfo}>
                <Text style={styles.storeName}>{item.child_name}'s Gallery</Text>
                <Text style={styles.storeMeta}>
                  {count === 0 ? 'First world coming soon' : count === 1 ? '1 world' : `${count} worlds`}
                </Text>
              </View>
              <Text style={styles.storeArrow}>›</Text>
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyPortal}>
              <Text style={styles.emptyIcon}>✨</Text>
            </View>
            <Text style={styles.emptyTitle}>Step inside their imagination</Text>
            <Text style={styles.emptyBody}>Create a dedicated space for each child to share the worlds they've imagined through their art.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.emptyBtnText}>Create first gallery</Text>
            </TouchableOpacity>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      <ShareSheet
        visible={!!sharePayload}
        payload={sharePayload}
        onClose={() => setSharePayload(null)}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Create a gallery</Text>
          <Text style={styles.modalSub}>Each child gets a dedicated space to share the worlds they've imagined.</Text>
          <Text style={styles.inputLabel}>Child's name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Emma"
            placeholderTextColor={colors.muted}
            value={childName}
            onChangeText={(v) => { setChildName(v); setSlug(v.trim().toLowerCase().replace(/\s+/g, '-')) }}
          />
          <Text style={styles.inputLabel}>Gallery URL slug</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. emma"
            placeholderTextColor={colors.muted}
            value={slug}
            onChangeText={setSlug}
            autoCapitalize="none"
          />
          {slug ? <Text style={styles.slugPreview}>drawup.ink/gallery/{slug}</Text> : null}
          <TouchableOpacity
            style={[styles.button, (!childName || !slug) && styles.buttonDisabled]}
            onPress={() => createStore.mutate()}
            disabled={!childName || !slug || createStore.isPending}
          >
            <Text style={styles.buttonText}>{createStore.isPending ? 'Creating…' : 'Create gallery'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setModalVisible(false)}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream, paddingTop: 56 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  headerBlock: { paddingHorizontal: 20, marginBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  header: { ...type.h1 },
  addBtn: { ...btn.primary, paddingVertical: 9, paddingHorizontal: 16 },
  addBtnText: { ...btn.primaryText, fontSize: 14 },
  storeCard: { ...card, flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 12, padding: 16 },
  coverWrap: { width: 56, height: 56, marginRight: 16, position: 'relative' },
  storeCover: { width: 56, height: 56, borderRadius: 14, backgroundColor: colors.border },
  storeCoverEmpty: { width: 56, height: 56, borderRadius: 14, backgroundColor: colors.goldLight, borderWidth: 1, borderColor: colors.goldMid },
  initialBadge: { position: 'absolute', bottom: -4, right: -4, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.dark, borderWidth: 2, borderColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  initialBadgeText: { color: colors.white, fontWeight: '900', fontSize: 11, letterSpacing: -0.3 },
  storeInfo: { flex: 1 },
  storeName: { fontSize: 17, fontWeight: '700', color: colors.dark, letterSpacing: -0.2 },
  storeMeta: { ...type.label, marginTop: 3, fontSize: 12 },
  storeSlug: { ...type.label, marginTop: 2, fontSize: 12 },
  storeArrow: { fontSize: 20, color: colors.muted },
  upsellCard: {
    backgroundColor: colors.dangerBg,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upsellInfo: { flex: 1 },
  upsellTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.dangerText,
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  upsellMessage: {
    fontSize: 13,
    color: colors.dangerText,
    opacity: 0.8,
    lineHeight: 18,
  },
  upsellBtn: {
    backgroundColor: colors.dark,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 100,
  },
  upsellBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyWrap: { alignItems: 'center', paddingTop: 100, paddingHorizontal: 40 },
  emptyPortal: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginBottom: 24, borderWidth: 1, borderColor: colors.border, shadowColor: colors.dark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { ...type.h2, textAlign: 'center', marginBottom: 12 },
  emptyBody: { ...type.body, textAlign: 'center', marginBottom: 32 },
  emptyBtn: { ...btn.primary, paddingHorizontal: 32 },
  emptyBtnText: { ...btn.primaryText },
  errorText: { ...type.body, marginBottom: 16 },
  retryBtn: { ...btn.primary, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { ...btn.primaryText, fontSize: 15 },
  modal: { flex: 1, padding: 28, paddingTop: 52, backgroundColor: colors.cream },
  modalTitle: { ...type.h1, marginBottom: 8 },
  modalSub: { ...type.body, marginBottom: 32 },
  inputLabel: { ...type.label, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  input: { ...card, padding: 16, fontSize: 16, color: colors.dark, marginBottom: 16, borderWidth: 1.5 },
  slugPreview: { fontSize: 13, color: colors.gold, fontWeight: '600', marginBottom: 16, marginTop: -8, marginLeft: 4 },
  button: { ...btn.primary, marginBottom: 12 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { ...btn.primaryText },
  cancel: { ...type.body, color: colors.muted, textAlign: 'center', textDecorationLine: 'underline' },
})
