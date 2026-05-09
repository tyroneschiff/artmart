// Read-aloud voice picker. Lists curated voices, plays a sample on tap,
// persists the selected voice_id to profiles.tts_voice_id, and shows a
// gold check next to the active voice.
//
// Sample audio is generated on demand by calling the tts edge function
// once per voice and cached in FileSystem.cacheDirectory keyed by
// voice_id, so each user only pays the ElevenLabs cost once per voice
// per device. Subsequent taps replay from local file.

import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { Audio } from 'expo-av'
import * as FileSystem from 'expo-file-system/legacy'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { VOICES, SAMPLE_TEXT, DEFAULT_VOICE_ID } from '../lib/voices'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../hooks/useAuthStore'
import { colors, radius } from '../lib/theme'

export default function VoicePicker({ currentVoiceId }: { currentVoiceId: string | null | undefined }) {
  const session = useAuthStore((s) => s.session)
  const userId = session?.user.id
  const queryClient = useQueryClient()
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)

  const activeId = currentVoiceId || DEFAULT_VOICE_ID

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
    return () => { soundRef.current?.unloadAsync() }
  }, [])

  const saveVoice = useMutation({
    mutationFn: async (voiceId: string) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, tts_voice_id: voiceId })
      if (error) throw error
    },
    onSuccess: (_, voiceId) => {
      queryClient.setQueryData<{ display_name?: string | null; tts_voice_id?: string | null } | undefined>(
        ['profile', userId],
        (prev) => ({ ...(prev ?? {}), tts_voice_id: voiceId }),
      )
      queryClient.invalidateQueries({ queryKey: ['profile-voice', userId] })
      Haptics.selectionAsync().catch(() => {})
    },
  })

  async function previewVoice(voiceId: string) {
    if (loadingId || previewing === voiceId) {
      // tap-to-stop on active preview
      await soundRef.current?.stopAsync().catch(() => {})
      await soundRef.current?.unloadAsync().catch(() => {})
      soundRef.current = null
      setPreviewing(null)
      return
    }

    setLoadingId(voiceId)
    try {
      const cachePath = `${FileSystem.cacheDirectory}voice_sample_${voiceId}.mp3`
      const cached = await FileSystem.getInfoAsync(cachePath)
      if (!cached.exists) {
        const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
        const res = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/tts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify({ text: SAMPLE_TEXT, voice_id: voiceId }),
          }
        )
        if (!res.ok) throw new Error(`Sample failed (${res.status})`)
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        await FileSystem.writeAsStringAsync(cachePath, json.audio, { encoding: FileSystem.EncodingType.Base64 })
      }

      // unload any prior sample
      if (soundRef.current) {
        await soundRef.current.stopAsync().catch(() => {})
        await soundRef.current.unloadAsync().catch(() => {})
        soundRef.current = null
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: cachePath },
        { shouldPlay: true },
        (status) => {
          if ('didJustFinish' in status && status.didJustFinish) {
            soundRef.current?.unloadAsync().catch(() => {})
            soundRef.current = null
            setPreviewing(null)
          }
        }
      )
      soundRef.current = sound
      setPreviewing(voiceId)
    } catch (e) {
      // silent — picker shouldn't disrupt the screen
      setPreviewing(null)
    } finally {
      setLoadingId(null)
    }
  }

  function selectVoice(voiceId: string) {
    if (voiceId === activeId) return
    saveVoice.mutate(voiceId)
  }

  return (
    <View>
      {VOICES.map((v, i) => {
        const isActive = activeId === v.id
        const isPlaying = previewing === v.id
        const isLoading = loadingId === v.id
        return (
          <TouchableOpacity
            key={v.id}
            style={[styles.row, i > 0 && styles.rowBorder, isActive && styles.rowActive]}
            onPress={() => selectVoice(v.id)}
            activeOpacity={0.7}
          >
            <View style={styles.info}>
              <Text style={styles.name}>{v.name}</Text>
              <Text style={styles.desc}>{v.description}</Text>
            </View>

            <TouchableOpacity
              style={[styles.previewBtn, isPlaying && styles.previewBtnActive]}
              onPress={() => previewVoice(v.id)}
              activeOpacity={0.7}
              disabled={loadingId !== null && loadingId !== v.id}
              hitSlop={8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.goldDark} />
              ) : (
                <Ionicons
                  name={isPlaying ? 'stop' : 'play'}
                  size={14}
                  color={isPlaying ? colors.white : colors.goldDark}
                />
              )}
            </TouchableOpacity>

            <View style={[styles.checkBubble, isActive && styles.checkBubbleActive]}>
              {isActive ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowActive: { backgroundColor: colors.goldLight },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: colors.dark, letterSpacing: -0.2, marginBottom: 2 },
  desc: { fontSize: 12, color: colors.mid, lineHeight: 16 },
  previewBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.goldLight,
    borderWidth: 1, borderColor: colors.goldMid,
  },
  previewBtnActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  checkBubble: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5, borderColor: colors.border,
  },
  checkBubbleActive: { backgroundColor: colors.gold, borderColor: colors.gold },
})
