import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, ScrollView, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../hooks/useAuthStore'
import { useCredits } from '../../lib/useCredits'
import { colors, type, btn, card } from '../../lib/theme'
import Constants from 'expo-constants'

async function fetchOwnerStats(userId: string) {
  const [storesRes, piecesRes] = await Promise.all([
    supabase.from('stores').select('id', { count: 'exact', head: true }).eq('owner_id', userId),
    supabase.from('pieces').select('id, store_id, stores!inner(owner_id)', { count: 'exact', head: true })
      .eq('stores.owner_id', userId)
      .eq('published', true),
  ])
  return {
    galleries: storesRes.count ?? 0,
    pieces: piecesRes.count ?? 0,
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

  const { data: profile } = useQuery({
    queryKey: ['profile', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('display_name').eq('id', session!.user.id).single()
      if (error) throw error
      return data
    },
    enabled: !!session,
  })

  const { data: stats } = useQuery({
    queryKey: ['owner-stats', session?.user.id],
    queryFn: () => fetchOwnerStats(session!.user.id),
    enabled: !!session,
  })

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name)
  }, [profile])

  const version = Constants.expoConfig?.version ?? '1.0.0'
  const email = session?.user.email ?? ''
  const greetingName = profile?.display_name?.trim() || email.split('@')[0]
  const initial = (greetingName?.[0] ?? '?').toUpperCase()

  async function handleSaveName() {
    if (!displayName.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: session!.user.id, display_name: displayName.trim() })
      if (error) throw error
      queryClient.invalidateQueries({ queryKey: ['profile', session?.user.id] })
      Alert.alert('Saved', 'Your name has been updated.')
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Identity header */}
      <View style={styles.identityHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.identityName} numberOfLines={1}>{greetingName}</Text>
        <Text style={styles.identityEmail} numberOfLines={1}>{email}</Text>
      </View>

      {/* Your work */}
      <View style={styles.section}>
        <Text style={type.label}>YOUR WORK</Text>
        <TouchableOpacity
          style={[card, styles.workCard]}
          onPress={() => router.push('/(tabs)/mystores')}
          activeOpacity={0.85}
        >
          <View style={styles.workStats}>
            <View style={styles.workStat}>
              <Text style={styles.workStatNumber}>{stats?.galleries ?? '—'}</Text>
              <Text style={styles.workStatLabel}>{stats?.galleries === 1 ? 'gallery' : 'galleries'}</Text>
            </View>
            <View style={styles.workDivider} />
            <View style={styles.workStat}>
              <Text style={styles.workStatNumber}>{stats?.pieces ?? '—'}</Text>
              <Text style={styles.workStatLabel}>{stats?.pieces === 1 ? 'world' : 'worlds'}</Text>
            </View>
          </View>
          <View style={styles.workCta}>
            <Text style={styles.workCtaText}>Open My Galleries</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </View>
        </TouchableOpacity>
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
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: 48 },

  identityHeader: { alignItems: 'center', paddingTop: 64, paddingBottom: 32, paddingHorizontal: 28 },
  avatar: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: colors.goldLight,
    borderWidth: 1.5, borderColor: colors.goldMid,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: { fontSize: 30, fontWeight: '900', color: colors.goldDark, letterSpacing: -1 },
  identityName: { fontSize: 24, fontWeight: '800', color: colors.dark, letterSpacing: -0.6, marginBottom: 4 },
  identityEmail: { fontSize: 13, color: colors.muted, fontWeight: '500' },

  section: { paddingHorizontal: 20, marginBottom: 24 },

  workCard: { padding: 0, overflow: 'hidden' },
  workStats: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 8 },
  workStat: { flex: 1, alignItems: 'center' },
  workStatNumber: { fontSize: 30, fontWeight: '900', color: colors.dark, letterSpacing: -1, marginBottom: 2 },
  workStatLabel: { fontSize: 12, color: colors.muted, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  workDivider: { width: 1, height: 36, backgroundColor: colors.border },
  workCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.cream },
  workCtaText: { fontSize: 13, fontWeight: '700', color: colors.dark, letterSpacing: -0.1 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { fontSize: 15, color: colors.dark, fontWeight: '500' },
  rowValue: { fontSize: 15, color: colors.mid, flex: 1, textAlign: 'right' },

  creditsValue: { fontSize: 18, fontWeight: '800', color: colors.gold },
  buyBtn: { margin: 12, marginTop: 4, backgroundColor: colors.goldLight, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.goldMid },
  buyBtnText: { color: colors.goldDark, fontWeight: '700', fontSize: 14 },

  input: { paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.dark, borderBottomWidth: 1, borderBottomColor: colors.border },
  saveBtn: { margin: 12, paddingVertical: 12 },
  saveBtnDisabled: { opacity: 0.4 },

  // Quieter sign-out — destructive intent is communicated by the Alert, not the button.
  signOutBtn: { backgroundColor: 'transparent', paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 100 },
  signOutText: { color: colors.muted, fontWeight: '700', fontSize: 14, letterSpacing: -0.1 },
})
