// First-run welcome modal shown to new users so they know:
//   1. They start with 3 credits
//   2. Each credit turns one drawing into a world
//   3. The path forward is to snap a photo
//
// Triggered from _layout.tsx after auth resolves AND the user has
// zero galleries AND they haven't dismissed it before. Returning
// users never see this. Tapping "Let's start" routes to /(tabs)/create.

import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { colors, type, btn, radius } from '../lib/theme'

export default function OnboardingSheet({
  visible,
  onDismiss,
}: {
  visible: boolean
  onDismiss: () => void
}) {
  function handleStart() {
    Haptics.selectionAsync().catch(() => {})
    onDismiss()
    router.push('/(tabs)/create')
  }

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <Pressable style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.iconWrap}>
            <View style={styles.iconBubble}>
              <Ionicons name="sparkles" size={36} color={colors.goldDark} />
            </View>
          </View>

          <Text style={styles.title}>Welcome to Draw Up</Text>
          <Text style={styles.lede}>
            Snap a photo of your kid's drawing and watch it come to life as a vivid world they can step into.
          </Text>

          <View style={styles.row}>
            <View style={styles.bullet}>
              <Text style={styles.bulletNum}>3</Text>
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Three worlds, on us</Text>
              <Text style={styles.rowSub}>You start with three credits. Each turns one drawing into a world.</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.bullet}>
              <Ionicons name="camera" size={18} color={colors.goldDark} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Snap, then publish</Text>
              <Text style={styles.rowSub}>Tap Create, photograph the drawing, name it, and it's saved to your kid's gallery.</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.bullet}>
              <Ionicons name="share-outline" size={18} color={colors.goldDark} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Share with family</Text>
              <Text style={styles.rowSub}>Every gallery has a link you can send to grandparents, aunts, and friends.</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.cta} onPress={handleStart} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Let's start</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skip} onPress={onDismiss} activeOpacity={0.6}>
            <Text style={styles.skipText}>I'll look around first</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 24 },
  iconWrap: { alignItems: 'center', marginBottom: 16 },
  iconBubble: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: colors.goldLight,
    borderWidth: 1.5, borderColor: colors.goldMid,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { ...type.h1, fontSize: 28, textAlign: 'center', marginBottom: 8 },
  lede: { ...type.body, fontSize: 15, textAlign: 'center', marginBottom: 24, paddingHorizontal: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 14 },
  bullet: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: colors.goldLight,
    borderWidth: 1.5, borderColor: colors.goldMid,
    alignItems: 'center', justifyContent: 'center',
  },
  bulletNum: { fontSize: 18, fontWeight: '900', color: colors.goldDark, letterSpacing: -0.5 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: colors.dark, letterSpacing: -0.2, marginBottom: 2 },
  rowSub: { fontSize: 13, color: colors.mid, lineHeight: 18 },
  cta: { ...btn.primary, marginTop: 12, paddingVertical: 16 },
  ctaText: { ...btn.primaryText, fontSize: 16 },
  skip: { paddingVertical: 14, alignItems: 'center' },
  skipText: { color: colors.muted, fontWeight: '600', fontSize: 13, letterSpacing: -0.1 },
})
