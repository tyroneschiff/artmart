import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, ScrollView, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../hooks/useAuthStore'
import { useCredits } from '../../lib/useCredits'
import { saveOriginalsToPhotos, SaveProgress } from '../../lib/preservation'
import { track } from '../../lib/analytics'
import { colors, type, btn, card, radius, opacity } from '../../lib/theme'
import Constants from 'expo-constants'
import VoicePicker from '../../components/VoicePicker'

type AllPiece = { id: string; original_image_url: string | null; stores: { child_name: string } | null }

async function fetchOwnerCollection(userId: string): Promise<{ galleries: number; pieces: AllPiece[] }> {
  const [storesRes, piecesRes] = await Promise.all([
    supabase.from('stores').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
    supabase
      .from('pieces')
      .select('id, original_image_url, stores!inner(owner_id, child_name)')
      .eq('stores.owner_id', userId)
      .eq('published', true),
  ])
  return {
    galleries: storesRes.count ?? 0,
    pieces: (piecesRes.data ?? []) as unknown as AllPiece[],
  }
}

export default function ProfileScreen() {
  const session = useAuthStore((s) => s.session)
  const setSession = useAuthStore((s) => s.setSession)
  const queryClient = useQueryClient()
  const { data: credits } = useCredits()
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [exportProgress, setExportProgress] = useState<SaveProgress | null>(null)

  const { data: profile } = useQuery({
    queryKey: ['profile', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, tts_voice_id')
        .eq('id', session!.user.id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!session,
  })

  const { data: collection } = useQuery({
    queryKey: ['owner-collection', session?.user.id],
    queryFn: () => fetchOwnerCollection(session!.user.id),
    enabled: !!session,
  })
  const galleries = collection?.galleries ?? 0
  const pieces = collection?.pieces ?? []
  const eligibleForSave = pieces.filter((p) => !!p.original_image_url)

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name)
  }, [profile])

  const version = Constants.expoConfig?.version ?? '1.0.0'
  const email = session?.user.email ?? ''
  // Prefer the display name. Until they've set one, show a friendly
  // "Welcome" instead of the awkward email-prefix fallback that read
  // like a username (e.g. "tyroneandleah").
  const greetingName = profile?.display_name?.trim() || 'Welcome'

  async function handleSaveName() {
    const trimmed = displayName.trim()
    if (!trimmed || trimmed === profile?.display_name) return
    // Hard guard: never touch supabase if the session somehow lapsed
    // between mount and the tap. Send the user back to sign in.
    if (!session?.user?.id) {
      Alert.alert('Please sign in again', 'Your session expired. Sign in to update your name.')
      router.replace('/(auth)/login')
      return
    }
    const userId = session.user.id
    setSaving(true)
    // Optimistically update the cache so the header re-renders instantly.
    const previous = queryClient.getQueryData<{ display_name: string | null }>(['profile', userId])
    queryClient.setQueryData(['profile', userId], { ...(previous ?? {}), display_name: trimmed })
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: userId, display_name: trimmed })
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['profile', userId] })
    } catch (e: any) {
      // Roll back the optimistic update on failure.
      queryClient.setQueryData(['profile', userId], previous)
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAllAcrossGalleries() {
    if (exportProgress || eligibleForSave.length === 0) return

    const noun = eligibleForSave.length === 1 ? 'original' : 'originals'
    const galleryWord = galleries === 1 ? 'gallery' : 'galleries'
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        `Save ${eligibleForSave.length} ${noun} to Photos?`,
        `Every drawing across your ${galleries} ${galleryWord} — saved to a "Draw Up" album. The transformed worlds stay in the app.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Save', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      )
    })
    if (!confirmed) return

    setExportProgress({ done: 0, total: eligibleForSave.length })
    const result = await saveOriginalsToPhotos(
      eligibleForSave.map((p) => ({ id: p.id, original_image_url: p.original_image_url, childName: p.stores?.child_name })),
      (p) => setExportProgress(p),
    )
    setExportProgress(null)

    if (result.noPermission) {
      Alert.alert('Photos access needed', 'Please allow Photos access to save the originals.')
      return
    }

    track('original_saved', { metadata: { scope: 'all', count: result.saved, total: result.total } })
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})

    Alert.alert(
      result.saved === result.total ? 'Saved to Photos ✨' : 'Mostly saved',
      result.saved === result.total
        ? `${result.saved} drawing${result.saved === 1 ? '' : 's'} now safe in your Photos. Look for the "Draw Up" album.`
        : `Saved ${result.saved} of ${result.total}. Try again to retry the rest.`,
    )
  }

  async function handleLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true)
          await supabase.auth.signOut()
          setSession(null)
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  const [deleting, setDeleting] = useState(false)
  async function handleDeleteAccount() {
    // Two-tap pattern. First confirm explains what's deleted, second
    // is the point-of-no-return so accidental taps can't take down
    // a parent's whole gallery.
    Alert.alert(
      'Delete your account?',
      "This permanently deletes every gallery you created, every world inside them, every comment and vote. It can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Last chance',
              'Tap Delete to permanently remove your account and everything in it.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true)
                    try {
                      const { data: { session: currentSession } } = await supabase.auth.getSession()
                      if (!currentSession) throw new Error('Session expired. Sign in and try again.')
                      const res = await fetch(
                        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
                        {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${currentSession.access_token}`,
                          },
                        },
                      )
                      if (!res.ok) {
                        const body = await res.json().catch(() => ({}))
                        throw new Error(body?.error || `Delete failed (${res.status})`)
                      }
                      await supabase.auth.signOut()
                      setSession(null)
                      router.replace('/(auth)/login')
                    } catch (e: any) {
                      Alert.alert('Could not delete account', e?.message || 'Try again.')
                    } finally {
                      setDeleting(false)
                    }
                  },
                },
              ],
            )
          },
        },
      ],
    )
  }

  // Auth gate: profile is meaningless without a session. If somehow the
  // session lapsed mid-navigation, send the user back to sign-in instead
  // of letting the page render in a half-broken state.
  if (!session) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <Text style={[type.h2, { fontSize: 22, marginBottom: 6, textAlign: 'center' }]}>Sign in to see your profile</Text>
        <Text style={[type.body, { fontSize: 14, textAlign: 'center', marginBottom: 20 }]}>
          Your session ended. Sign in again to pick up where you left off.
        </Text>
        <TouchableOpacity style={[btn.primary, { paddingHorizontal: 28, paddingVertical: 14 }]} onPress={() => router.replace('/(auth)/login')}>
          <Text style={btn.primaryText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Identity header */}
      <View style={styles.identityHeader}>
        <Text style={styles.identityName} numberOfLines={1}>{greetingName}</Text>
        <Text style={styles.identityEmail} numberOfLines={1}>{email}</Text>
      </View>

      {/* Your collection */}
      <View style={styles.section}>
        <Text style={type.label}>YOUR COLLECTION</Text>
        <View style={[card, styles.workCard]}>
          <TouchableOpacity
            style={styles.workStats}
            onPress={() => router.push('/(tabs)/mystores')}
            activeOpacity={0.85}
          >
            <View style={styles.workStat}>
              <Text style={styles.workStatNumber}>{collection ? galleries : '—'}</Text>
              <Text style={styles.workStatLabel}>{galleries === 1 ? 'gallery' : 'galleries'}</Text>
            </View>
            <View style={styles.workDivider} />
            <View style={styles.workStat}>
              <Text style={styles.workStatNumber}>{collection ? pieces.length : '—'}</Text>
              <Text style={styles.workStatLabel}>{pieces.length === 1 ? 'world' : 'worlds'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.workCta}
            onPress={() => router.push('/(tabs)/mystores')}
            activeOpacity={0.7}
          >
            <Text style={styles.workCtaText}>Open Galleries</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </TouchableOpacity>

          {eligibleForSave.length > 0 && (
            <TouchableOpacity
              style={styles.workSaveAll}
              onPress={handleSaveAllAcrossGalleries}
              disabled={!!exportProgress}
              activeOpacity={0.7}
            >
              {exportProgress ? (
                <>
                  <ActivityIndicator size="small" color={colors.dark} />
                  <Text style={styles.workSaveAllText}>Saving {exportProgress.done}/{exportProgress.total}…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="download-outline" size={16} color={colors.dark} />
                  <Text style={styles.workSaveAllText}>Save all originals to Photos</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Credits */}
      <View style={styles.section}>
        <Text style={type.label}>CREDITS</Text>
        <View style={[card, { overflow: 'hidden' }]}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Remaining</Text>
            <Text style={styles.creditsValue}>{credits ?? 0}</Text>
          </View>
          <TouchableOpacity style={styles.buyBtn} onPress={() => router.push('/credits')}>
            <Text style={styles.buyBtnText}>Buy credits</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Display name */}
      <View style={styles.section}>
        <Text style={type.label}>YOUR NAME</Text>
        <View style={[card, { overflow: 'hidden' }]}>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor={colors.muted}
            value={displayName}
            onChangeText={setDisplayName}
          />
          <TouchableOpacity
            style={[btn.primary, styles.saveBtn, !displayName.trim() && styles.saveBtnDisabled]}
            onPress={handleSaveName}
            disabled={!displayName.trim() || saving}
          >
            {saving
              ? <ActivityIndicator color={colors.white} size="small" />
              : <Text style={btn.primaryText}>Save name</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* Read aloud voice */}
      <View style={styles.section}>
        <Text style={type.label}>READ ALOUD VOICE</Text>
        <View style={[card, { overflow: 'hidden' }]}>
          <VoicePicker currentVoiceId={profile?.tts_voice_id} />
        </View>
      </View>

      {/* App info */}
      <View style={styles.section}>
        <Text style={type.label}>APP</Text>
        <View style={[card, { overflow: 'hidden' }]}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>{version}</Text>
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Support</Text>
            <Text style={styles.rowValue}>hello@drawup.ink</Text>
          </View>
        </View>
      </View>

      {/* Sign out — quiet ghost button. The Alert handles confirmation. */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} disabled={loggingOut} activeOpacity={0.7}>
          {loggingOut
            ? <ActivityIndicator color={colors.muted} size="small" />
            : <Text style={styles.signOutText}>Sign out</Text>}
        </TouchableOpacity>
      </View>

      {/* Delete account — quiet text link. Two-tap confirm in handler. */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.deleteAccountBtn}
          onPress={handleDeleteAccount}
          disabled={deleting}
          activeOpacity={0.6}
        >
          {deleting
            ? <ActivityIndicator color={colors.muted} size="small" />
            : <Text style={styles.deleteAccountText}>Delete account</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: 48 },

  identityHeader: { paddingTop: 72, paddingBottom: 36, paddingHorizontal: 24 },
  identityName: { fontSize: 28, fontWeight: '900', color: colors.dark, letterSpacing: -0.8, marginBottom: 4 },
  identityEmail: { fontSize: 14, color: colors.muted, fontWeight: '500' },

  section: { paddingHorizontal: 20, marginBottom: 24 },

  workCard: { padding: 0, overflow: 'hidden' },
  workStats: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 8 },
  workStat: { flex: 1, alignItems: 'center' },
  workStatNumber: { fontSize: 30, fontWeight: '900', color: colors.dark, letterSpacing: -1, marginBottom: 2 },
  workStatLabel: { fontSize: 12, color: colors.muted, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  workDivider: { width: 1, height: 36, backgroundColor: colors.border },
  workCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.cream },
  workCtaText: { fontSize: 13, fontWeight: '700', color: colors.dark, letterSpacing: -0.1 },
  workSaveAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.cream },
  workSaveAllText: { fontSize: 13, fontWeight: '700', color: colors.dark, letterSpacing: -0.1 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { fontSize: 15, color: colors.dark, fontWeight: '500' },
  rowValue: { fontSize: 15, color: colors.mid, flex: 1, textAlign: 'right' },

  creditsValue: { fontSize: 18, fontWeight: '800', color: colors.gold },
  buyBtn: { margin: 12, marginTop: 4, backgroundColor: colors.goldLight, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.goldMid },
  buyBtnText: { color: colors.goldDark, fontWeight: '700', fontSize: 14 },

  input: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.dark, borderBottomWidth: 1, borderBottomColor: colors.border },
  saveBtn: { margin: 12, paddingVertical: 12 },
  saveBtnDisabled: { opacity: opacity.disabled },

  // Quieter sign-out — destructive intent is communicated by the Alert, not the button.
  signOutBtn: { backgroundColor: 'transparent', paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill },
  signOutText: { color: colors.muted, fontWeight: '700', fontSize: 14, letterSpacing: -0.1 },
  // Delete account — text-only link, even quieter than Sign out. The
  // visual loudness is in the two-tap Alert chain, not the button.
  deleteAccountBtn: { paddingVertical: 12, alignItems: 'center' },
  deleteAccountText: { color: colors.muted, fontWeight: '600', fontSize: 13, textDecorationLine: 'underline', letterSpacing: -0.1 },
})
