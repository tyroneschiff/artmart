import { useEffect, useRef, useState } from 'react'
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system/legacy'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../lib/theme'

export default function ReadAloudButton({ text, compact }: { text: string; compact?: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle')
  const soundRef = useRef<Audio.Sound | null>(null)

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
    return () => { soundRef.current?.unloadAsync() }
  }, [])

  async function handlePress() {
    if (state === 'playing') {
      await soundRef.current?.stopAsync()
      await soundRef.current?.unloadAsync()
      soundRef.current = null
      setState('idle')
      return
    }

    if (state === 'loading') return

    setState('loading')
    try {
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ text }),
        }
      )
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`TTS failed (${res.status}): ${body}`)
      }
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      const path = FileSystem.cacheDirectory + `tts_${Date.now()}.mp3`
      await FileSystem.writeAsStringAsync(path, json.audio, { encoding: FileSystem.EncodingType.Base64 })

      const { sound } = await Audio.Sound.createAsync(
        { uri: path },
        { shouldPlay: true },
        (status) => {
          if ('didJustFinish' in status && status.didJustFinish) {
            soundRef.current?.unloadAsync()
            soundRef.current = null
            setState('idle')
          }
        }
      )
      soundRef.current = sound
      setState('playing')
    } catch (e: any) {
      setState('idle')
      Alert.alert('Could not play story', e.message)
    }
  }

  const isLoading = state === 'loading'
  const isPlaying = state === 'playing'

  const iconColor = isPlaying ? colors.white : colors.goldDark

  return (
    <TouchableOpacity
      style={[styles.btn, isPlaying && styles.btnActive, compact && styles.btnCompact]}
      onPress={handlePress}
      activeOpacity={0.75}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.goldDark} />
      ) : (
        <Ionicons name={isPlaying ? 'stop' : 'play'} size={14} color={iconColor} />
      )}
      <Text style={[styles.label, isPlaying && styles.labelActive]}>
        {isPlaying ? 'Stop' : isLoading ? 'Preparing…' : 'Read story aloud'}
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
  btnActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  btnCompact: { marginHorizontal: 0 },
  label: { fontSize: 13, fontWeight: '700', color: colors.goldDark, letterSpacing: 0.2 },
  labelActive: { color: colors.white },
})
