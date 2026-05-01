// Locked Read Aloud teaser shown on the piece page to logged-in viewers
// who don't yet have their own gallery. Visually mirrors the active
// button but with a lock icon + muted styling so it reads as
// "feature you can unlock," not "broken button." Tap routes the viewer
// toward gallery creation — the line they cross to become a creator.

import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius } from '../lib/theme'

export default function LockedReadAloudButton({ compact }: { compact?: boolean }) {
  function handlePress() {
    Haptics.selectionAsync().catch(() => {})
    Alert.alert(
      'Read Aloud is yours when you have a gallery',
      "Each child gets their own gallery on Draw Up. Create yours and the magic — Read Aloud included — unlocks for every world inside.",
      [
        { text: 'Maybe later', style: 'cancel' },
        {
          text: 'Create my gallery',
          onPress: () => router.push('/(tabs)/create'),
        },
      ]
    )
  }

  return (
    <TouchableOpacity
      style={[styles.btn, compact && styles.btnCompact]}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      <Ionicons name="lock-closed" size={13} color={colors.muted} />
      <Text style={styles.label}>Read story aloud</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnCompact: { marginHorizontal: 0 },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted, letterSpacing: 0.2 },
})
