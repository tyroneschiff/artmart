import { useEffect, useRef } from 'react'
import { Animated, View, StyleSheet, ViewStyle } from 'react-native'
import { colors, radius } from '../lib/theme'

type Props = {
  width?: number | `${number}%`
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

// A single shimmering placeholder block. Compose multiple to build screen-shaped
// skeletons (see DiscoverSkeleton, GallerySkeleton, PieceSkeleton).
export default function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: Props) {
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

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: colors.creamDark, opacity }, style]}
    />
  )
}

// ── Screen-shaped skeletons ────────────────────────────────────────────────

export function DiscoverSkeleton() {
  return (
    <View style={s.discover}>
      <View style={s.discoverHeader}>
        <Skeleton width={140} height={36} borderRadius={10} />
        <Skeleton width={88} height={32} borderRadius={100} />
      </View>
      <Skeleton width={130} height={32} borderRadius={100} style={{ marginHorizontal: 20, marginBottom: 16 }} />
      <View style={s.grid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={s.card}>
            <Skeleton height={170} borderRadius={0} />
            <View style={s.cardBody}>
              <Skeleton width="80%" height={12} />
              <Skeleton width="50%" height={11} style={{ marginTop: 6 }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

export function GallerySkeleton() {
  return (
    <View style={s.gallery}>
      <View style={s.galleryHeader}>
        <Skeleton width={36} height={36} borderRadius={10} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Skeleton width={88} height={36} borderRadius={100} />
          <Skeleton width={68} height={36} borderRadius={100} />
        </View>
      </View>
      <View style={s.galleryAvatarBlock}>
        <Skeleton width={64} height={64} borderRadius={20} />
        <Skeleton width={180} height={24} borderRadius={6} style={{ marginTop: 12 }} />
        <Skeleton width={70} height={12} borderRadius={6} style={{ marginTop: 6 }} />
      </View>
      <View style={s.grid}>
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} style={s.card}>
            <Skeleton height={170} borderRadius={0} />
            <View style={s.cardBody}>
              <Skeleton width="70%" height={12} />
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

export function PieceSkeleton() {
  return (
    <View style={s.piece}>
      <View style={s.pieceHeader}>
        <Skeleton width={36} height={36} borderRadius={10} />
        <Skeleton width={88} height={36} borderRadius={100} />
      </View>
      <Skeleton width="100%" height={360} borderRadius={0} />
      <View style={s.pieceBody}>
        <Skeleton width="80%" height={28} borderRadius={6} />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
          <Skeleton width={'60%' as any} height={42} borderRadius={100} />
          <Skeleton width={64} height={42} borderRadius={100} />
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

const s = StyleSheet.create({
  discover: { flex: 1, backgroundColor: colors.cream, paddingTop: 56 },
  discoverHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  gallery: { flex: 1, backgroundColor: colors.cream, paddingTop: 56 },
  galleryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  galleryAvatarBlock: { alignItems: 'center', paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 18, paddingHorizontal: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
  card: { width: '48%', backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardBody: { padding: 12 },
  piece: { flex: 1, backgroundColor: colors.cream },
  pieceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
  pieceBody: { paddingHorizontal: 20, paddingTop: 20 },
})
