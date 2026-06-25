// Generative video clip surface on the piece page (Phase 1 of
// growth/video-clips-plan.md). Owner can turn the rendered world into a
// short animated clip; anyone can watch a ready clip.
//
// Gated by CLIPS_ENABLED (app/lib/flags.ts) AND the server-side
// CLIPS_ENABLED on generate-clip — both must be on. Each generation
// costs real money, so this stays hidden until we flip it on.

import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Share, Modal, StatusBar } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Audio, Video, ResizeMode } from 'expo-av'
import * as FileSystem from 'expo-file-system/legacy'
import * as MediaLibrary from 'expo-media-library'
import * as Haptics from 'expo-haptics'
import { supabase } from '../lib/supabase'
import { track } from '../lib/analytics'
import { CLIPS_ENABLED } from '../lib/flags'
import { colors, type, btn, radius } from '../lib/theme'

type ClipStatus = 'none' | 'queued' | 'processing' | 'ready' | 'failed'

// A little variety while the clip renders so it doesn't read as one frozen line.
// Animating an existing image costs 1 credit (the image already cost 1;
// image 1 + animate 1 = the 2-credit video total). Single source so the
// confirm copy and any future change stay in sync.
const VIDEO_ANIMATE_CREDITS = 1

const GENERATING_LINES = [
  'Bringing this world to life… about a minute.',
  'Teaching it how to move and sound… about a minute.',
  'Adding motion and a little magic… about a minute.',
  'Almost there — animating the scene… about a minute.',
]

export default function ClipSection({
  pieceId,
  clipStatus,
  clipUrl,
  isOwner,
  childName,
  onRefetch,
}: {
  pieceId: string
  clipStatus: ClipStatus
  clipUrl: string | null
  isOwner: boolean
  childName?: string
  onRefetch: () => void
}) {
  const [requesting, setRequesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const insets = useSafeAreaInsets()
  // Pick one generating line per mount so it's stable but varied across pieces.
  const generatingLine = useRef(GENERATING_LINES[Math.floor(Math.random() * GENERATING_LINES.length)]).current

  const inProgress = clipStatus === 'queued' || clipStatus === 'processing'

  // While a render is in flight, poll the piece so the player appears
  // automatically when the webhook flips status to ready/failed.
  useEffect(() => {
    if (inProgress) {
      pollRef.current = setInterval(onRefetch, 6000)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [inProgress, onRefetch])

  useEffect(() => {
    // Clips have no spoken audio, but set a sane audio mode anyway so the
    // player doesn't get silenced by the iOS ringer switch unexpectedly.
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {})
  }, [])

  // Hidden entirely unless the feature is on. Non-owners only ever see a
  // ready clip (never the generate affordance).
  if (!CLIPS_ENABLED) return null
  if (!isOwner && clipStatus !== 'ready') return null

  // Confirm the credit spend before generating — users shouldn't lose
  // credits by accident on a tap.
  function confirmGenerate() {
    if (requesting) return
    const n = VIDEO_ANIMATE_CREDITS
    Alert.alert(
      'Bring it to life?',
      `This uses ${n} more credit${n === 1 ? '' : 's'} to animate it into a video with sound.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Make video', onPress: handleGenerate },
      ],
    )
  }

  async function handleGenerate() {
    if (requesting) return
    setRequesting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Please sign in again.')
      const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-clip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ piece_id: pieceId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.message || body?.error || `Failed (${res.status})`)
      track('clip_requested', { pieceId })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      onRefetch()
    } catch (e: any) {
      Alert.alert('Could not start the video', e?.message || 'Try again.')
    } finally {
      setRequesting(false)
    }
  }

  async function handleSave() {
    if (!clipUrl || saving) return
    setSaving(true)
    try {
      const perm = await MediaLibrary.requestPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Photos access needed', 'Allow Photos access to save the video.')
        return
      }
      const path = `${FileSystem.cacheDirectory}drawup_${pieceId}.mp4`
      const { uri } = await FileSystem.downloadAsync(clipUrl, path)
      await MediaLibrary.saveToLibraryAsync(uri)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      Alert.alert('Saved to Photos ✨', `${childName ? childName + "'s" : 'Your'} video is saved to your camera roll.`)
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleShare() {
    if (!clipUrl) return
    try {
      await Share.share({ url: clipUrl, message: `${childName ? childName + ' made this' : 'Made'} with Draw Up ✨` })
      track('clip_shared', { pieceId })
    } catch { /* user cancelled */ }
  }

  // READY — show the player + actions (owner and viewers).
  if (clipStatus === 'ready' && clipUrl) {
    return (
      <View style={styles.wrap}>
        {/* Tap to expand full-screen with sound + controls, mirroring the
            image lightbox. The inline preview stays muted + looping. */}
        <TouchableOpacity activeOpacity={0.9} onPress={() => setFullscreen(true)}>
          <Video
            source={{ uri: clipUrl }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay
            isMuted
            useNativeControls={false}
          />
          <View style={styles.expandBadge}>
            <Ionicons name="expand" size={15} color={colors.white} />
          </View>
        </TouchableOpacity>
        {isOwner && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={[btn.primary, styles.actionBtn]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
              {saving
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={btn.primaryText}>Save to Photos</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[btn.secondary, styles.actionBtn]} onPress={handleShare} activeOpacity={0.85}>
              <Text style={btn.secondaryText}>Share</Text>
            </TouchableOpacity>
          </View>
        )}

        <Modal visible={fullscreen} transparent animationType="fade" onRequestClose={() => setFullscreen(false)} statusBarTranslucent>
          <StatusBar barStyle="light-content" />
          <View style={styles.fsBackdrop}>
            <Video
              source={{ uri: clipUrl }}
              style={styles.fsVideo}
              resizeMode={ResizeMode.CONTAIN}
              isLooping
              shouldPlay
              useNativeControls
            />
            <TouchableOpacity
              style={[styles.fsClose, { top: insets.top + 12 }]}
              onPress={() => setFullscreen(false)}
              hitSlop={12}
            >
              <Ionicons name="close" size={22} color={colors.white} />
            </TouchableOpacity>
          </View>
        </Modal>
      </View>
    )
  }

  // Owner-only states below this point.
  if (!isOwner) return null

  if (inProgress) {
    return (
      <View style={[styles.wrap, styles.statusCard]}>
        <ActivityIndicator color={colors.goldDark} />
        <Text style={styles.statusText}>{generatingLine}</Text>
      </View>
    )
  }

  // none / failed → offer to (re)generate.
  return (
    <TouchableOpacity style={[styles.wrap, styles.makeBtn]} onPress={confirmGenerate} disabled={requesting} activeOpacity={0.8}>
      {requesting ? (
        <ActivityIndicator color={colors.goldDark} />
      ) : (
        <>
          <Ionicons name="videocam" size={18} color={colors.goldDark} />
          <Text style={styles.makeBtnText}>{clipStatus === 'failed' ? 'Try the video again' : 'Bring this to life — make a video'}</Text>
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 16 },
  // Clips are square (1:1) in v1 — match the box so there's no letterboxing.
  video: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.creamDark, overflow: 'hidden' },
  expandBadge: { position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
  fsBackdrop: { flex: 1, backgroundColor: colors.scrimStrong, justifyContent: 'center', alignItems: 'center' },
  fsVideo: { width: '100%', height: '100%' },
  fsClose: { position: 'absolute', right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.scrimWhite, alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 13 },
  statusCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18, backgroundColor: colors.goldLight, borderRadius: radius.md, borderWidth: 1, borderColor: colors.goldMid },
  statusText: { ...type.body, fontSize: 14, color: colors.goldDark, fontWeight: '600' },
  makeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, backgroundColor: colors.goldLight, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.goldMid },
  makeBtnText: { fontSize: 14, fontWeight: '700', color: colors.goldDark, letterSpacing: -0.1 },
})
