// Locked Read Aloud teaser shown on the piece page to anyone who isn't
// the piece's owner. Visually mirrors the active button but with a
// lock icon + muted styling so it reads as "feature meant for someone
// else," not "broken button." The CTA branches based on whether the
// viewer already has their own gallery:
//   - has gallery: nudges them to use Read Aloud where it's meant to
//     be — on their own pieces, the parent-and-child moment
//   - no gallery: nudges them to create their first gallery, the line
//     they cross to become a creator
//
// Read Aloud is intentionally NOT opened up for non-owners, even if
// they're creators of other galleries. The feature is the parent
// reading their own child's world to them; broadcasting AI audio for
// every stranger's piece a user browses defeats the magic and would
// scale ElevenLabs cost linearly with browse depth.

import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius } from '../lib/theme'

export default function LockedReadAloudButton({ compact, viewerHasGallery }: { compact?: boolean; viewerHasGallery?: boolean }) {
  function handlePress() {
    Haptics.selectionAsync().catch(() => {})

    if (viewerHasGallery) {
      Alert.alert(
        'Read Aloud is the parent-and-child moment',
        "It belongs to the artist whose drawing this is. Use it on your own kid's pieces — that's where the magic lands.",
        [
          { text: 'Maybe later', style: 'cancel' },
          { text: 'Open my galleries', onPress: () => router.push('/(tabs)/mystores') },
        ]
      )
      return
    }

    Alert.alert(
      'Read Aloud is yours when you have a gallery',
      "Each child gets their own gallery on Draw Up. Create yours and the magic — Read Aloud included — unlocks for every world inside.",
      [
        { text: 'Maybe later', style: 'cancel' },
        { text: 'Create my gallery', onPress: () => router.push('/(tabs)/create') },
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
