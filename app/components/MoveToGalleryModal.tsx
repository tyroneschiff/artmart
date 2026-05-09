// Owner-only "Move this world to another gallery" picker. Lists the
// owner's other galleries (excluding the current one), each as a tap
// target. Selecting one calls a passed-in onMove(targetStoreId) and
// closes the modal — the caller does the mutation + cache invalidation
// since the piece page already owns the queryClient and routing.

import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../hooks/useAuthStore'
import { colors, type, btn, radius } from '../lib/theme'

type GalleryRow = { id: string; child_name: string; slug: string; piece_count: number }

async function fetchMyGalleries(userId: string, excludeStoreId: string): Promise<GalleryRow[]> {
  const { data: stores, error } = await supabase
    .from('stores')
    .select('id, child_name, slug')
    .eq('owner_id', userId)
    .neq('id', excludeStoreId)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!stores || stores.length === 0) return []
  // Cheap parallel counts so the picker shows context per gallery.
  const counts = await Promise.all(
    stores.map(async (s) => {
      const { count } = await supabase
        .from('pieces')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', s.id)
        .eq('published', true)
      return { id: s.id, count: count ?? 0 }
    })
  )
  const byId = new Map(counts.map((c) => [c.id, c.count]))
  return stores.map((s) => ({ ...s, piece_count: byId.get(s.id) ?? 0 }))
}

export default function MoveToGalleryModal({
  visible,
  currentStoreId,
  onClose,
  onMove,
  isMoving,
}: {
  visible: boolean
  currentStoreId: string | undefined
  onClose: () => void
  onMove: (targetStoreId: string, targetChildName: string) => void
  isMoving: boolean
}) {
  const session = useAuthStore((s) => s.session)
  const userId = session?.user.id

  const { data: galleries, isLoading } = useQuery({
    queryKey: ['move-galleries', userId, currentStoreId],
    enabled: visible && !!userId && !!currentStoreId,
    queryFn: () => fetchMyGalleries(userId!, currentStoreId!),
  })

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={isMoving ? undefined : onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Move to another gallery</Text>
          <Text style={styles.subtitle}>Pick where this world belongs.</Text>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.muted} />
            </View>
          ) : galleries && galleries.length > 0 ? (
            <FlatList
              data={galleries}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={styles.sep} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => onMove(item.id, item.child_name)}
                  disabled={isMoving}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.child_name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{item.child_name}</Text>
                    <Text style={styles.rowMeta}>
                      {item.piece_count} world{item.piece_count === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </TouchableOpacity>
              )}
            />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>You only have one gallery. Create another to move pieces between them.</Text>
            </View>
          )}

          <TouchableOpacity style={styles.cancel} onPress={onClose} disabled={isMoving} activeOpacity={0.7}>
            <Text style={styles.cancelText}>{isMoving ? 'Moving…' : 'Cancel'}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: 8,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 },
  title: { ...type.h2, fontSize: 22, paddingHorizontal: 20, marginBottom: 4 },
  subtitle: { ...type.body, fontSize: 14, paddingHorizontal: 20, marginBottom: 16 },
  loading: { paddingVertical: 28, alignItems: 'center' },
  empty: { paddingHorizontal: 24, paddingVertical: 24 },
  emptyText: { ...type.body, fontSize: 14, textAlign: 'center', color: colors.mid },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.goldLight, borderWidth: 1.5, borderColor: colors.goldMid, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '900', color: colors.goldDark },
  rowText: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.dark, letterSpacing: -0.2, marginBottom: 2 },
  rowMeta: { fontSize: 12, color: colors.muted, fontWeight: '500' },
  sep: { height: 1, backgroundColor: colors.border, marginHorizontal: 20 },
  cancel: { ...btn.secondary, marginHorizontal: 20, marginTop: 16, paddingVertical: 14 },
  cancelText: { ...btn.secondaryText, fontSize: 15, textAlign: 'center' },
})
