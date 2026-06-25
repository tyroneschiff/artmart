import { useEffect, useRef } from 'react'
import { Animated, View, StyleSheet, ViewStyle } from 'react-native'
import { colors, radius, layout } from '../lib/theme'

type Props = {
  width?: number | `${number}%`
  height?: number
  // When set, the block sizes by aspect ratio instead of a fixed height —
  // used to match real card images that use aspectRatio:1, so the
  // skeleton→content swap produces zero layout shift.
  aspectRatio?: number
  borderRadius?: number
  style?: ViewStyle
}

// A single shimmering placeholder block. Compose multiple to build screen-shaped
// skeletons (see DiscoverSkeleton, GallerySkeleton, PieceSkeleton).
export default function Skeleton({ width = '100%', height, aspectRatio, borderRadius = radius.sm, style }: Props) {
  const opacity = useRef(new Animated.Value(0.5)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  const dims = aspectRatio ? { width, aspectRatio } : { width, height: height ?? 16 }

  return (
    <Animated.View
      style={[{ ...dims, borderRadius, backgroundColor: colors.creamDark, opacity }, style]}
    />
  )
}

// One 2-up grid card whose image is a square (aspectRatio:1) to match the
// real Discover/Gallery cards exactly.
function GridCard({ lines = 2 }: { lines?: number }) {
  return (
    <View style={s.card}>
      <Skeleton aspectRatio={1} borderRadius={0} />
      <View style={s.cardBody}>
        <Skeleton width="80%" height={12} />
        {lines > 1 && <Skeleton width="50%" height={11} style={{ marginTop: 6 }} />}
      </View>
    </View>
  )
}

// A row of two grid cards, matching the real FlatList numColumns=2 +
// columnWrapperStyle (flex:1 cards, gap 10, 16 horizontal padding).
function GridRow({ lines }: { lines?: number }) {
  return (
    <View style={s.cardRow}>
      <GridCard lines={lines} />
      <GridCard lines={lines} />
    </View>
  )
}

// ── Screen-shaped skeletons ────────────────────────────────────────────────

export function DiscoverSkeleton() {
  return (
    <View style={s.discover}>
      <View style={s.discoverHeader}>
        <Skeleton width={140} height={36} borderRadius={10} />
        <Skeleton width={88} height={32} borderRadius={radius.pill} />
      </View>
      <Skeleton width={130} height={32} borderRadius={radius.pill} style={{ marginHorizontal: 20, marginBottom: 16 }} />
      <GridRow />
      <GridRow />
      <GridRow />
    </View>
  )
}

export function GallerySkeleton() {
  return (
    <View style={s.gallery}>
      <View style={s.galleryHeader}>
        <Skeleton width={36} height={36} borderRadius={10} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Skeleton width={88} height={36} borderRadius={radius.pill} />
          <Skeleton width={68} height={36} borderRadius={radius.pill} />
        </View>
      </View>
      <View style={s.galleryAvatarBlock}>
        <Skeleton width={64} height={64} borderRadius={20} />
        <Skeleton width={180} height={24} borderRadius={6} style={{ marginTop: 12 }} />
        <Skeleton width={70} height={12} borderRadius={6} style={{ marginTop: 6 }} />
      </View>
      <GridRow lines={1} />
      <GridRow lines={1} />
    </View>
  )
}

export function PieceSkeleton() {
  return (
    <View style={s.piece}>
      <View style={s.pieceHeader}>
        <Skeleton width={36} height={36} borderRadius={10} />
        <Skeleton width={88} height={36} borderRadius={radius.pill} />
      </View>
      <Skeleton width="100%" aspectRatio={1} borderRadius={0} />
      <View style={s.pieceBody}>
        <Skeleton width="80%" height={28} borderRadius={6} />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
          <Skeleton width={'60%' as any} height={42} borderRadius={radius.pill} />
          <Skeleton width={64} height={42} borderRadius={radius.pill} />
        </View>
        <View style={{ marginTop: 24 }}>
          <Skeleton width="100%" height={12} />
          <Skeleton width="92%" height={12} style={{ marginTop: 8 }} />
          <Skeleton width="68%" height={12} style={{ marginTop: 8 }} />
        </View>
      </View>
    </View>
  )
}

// Matches the real My Galleries list: full-width horizontal cards with a
// 56² cover thumbnail, two text lines, and a trailing chevron.
export function MyStoresSkeleton() {
  return (
    <View style={s.mystores}>
      <View style={s.mystoresHeader}>
        <Skeleton width={150} height={32} borderRadius={8} />
        <Skeleton width={72} height={36} borderRadius={radius.pill} />
      </View>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={s.storeRow}>
          <Skeleton width={56} height={56} borderRadius={radius.md} />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Skeleton width="55%" height={17} borderRadius={6} />
            <Skeleton width="32%" height={12} borderRadius={6} style={{ marginTop: 8 }} />
          </View>
        </View>
      ))}
    </View>
  )
}

export function CommentsSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={s.commentRow}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Skeleton width={120} height={14} borderRadius={4} />
            <Skeleton width={48} height={12} borderRadius={4} />
          </View>
          <Skeleton width="100%" height={12} borderRadius={4} />
          <Skeleton width="78%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  discover: { flex: 1, backgroundColor: colors.cream, paddingTop: layout.screenTop },
  discoverHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  gallery: { flex: 1, backgroundColor: colors.cream, paddingTop: layout.screenTop },
  galleryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  galleryAvatarBlock: { alignItems: 'center', paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 18, paddingHorizontal: 20 },
  // Mirrors the real grid: a row of two flex:1 cards, gap 10, 16 h-padding.
  cardRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 10 },
  card: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardBody: { padding: 12 },
  piece: { flex: 1, backgroundColor: colors.cream },
  pieceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: layout.screenTop, paddingBottom: 12 },
  pieceBody: { paddingHorizontal: 20, paddingTop: 20 },
  mystores: { flex: 1, backgroundColor: colors.cream, paddingTop: layout.screenTop },
  mystoresHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 24 },
  storeRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 12, padding: 16, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  commentRow: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12 },
})
