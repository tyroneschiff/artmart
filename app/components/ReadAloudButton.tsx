import { useEffect, useState } from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import * as Speech from 'expo-speech'
import { colors } from '../lib/theme'

export default function ReadAloudButton({ text, compact }: { text: string; compact?: boolean }) {
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    return () => { Speech.stop() }
  }, [])

  async function toggle() {
    if (speaking) {
      await Speech.stop()
      setSpeaking(false)
    } else {
      setSpeaking(true)
      Speech.speak(text, {
        language: 'en-US',
        rate: 0.82,
        pitch: 1.05,
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      })
    }
  }

  return (
    <TouchableOpacity style={[styles.btn, speaking && styles.btnActive, compact && { marginHorizontal: 0 }]} onPress={toggle} activeOpacity={0.75}>
      <Text style={styles.icon}>{speaking ? '⏹' : '▶'}</Text>
      <Text style={[styles.label, speaking && styles.labelActive]}>
        {speaking ? 'Stop' : 'Read story aloud'}
      </Text>
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
    borderRadius: 100,
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: colors.goldMid,
  },
  btnActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  icon: { fontSize: 12 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.goldDark,
    letterSpacing: 0.2,
  },
  labelActive: { color: colors.white },
})
