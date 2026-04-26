import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, ScrollView, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../hooks/useAuthStore'
import { useCredits } from '../../lib/useCredits'
import { colors, type, btn, card } from '../../lib/theme'
import Constants from 'expo-constants'

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

  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name)
  }, [profile])

  const version = Constants.expoConfig?.version ?? '1.0.0'

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
      <Text style={[type.h1, { paddingHorizontal: 20, paddingTop: 56, marginBottom: 32 }]}>Profile</Text>

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

      {/* Account info */}
      <View style={styles.section}>
        <Text style={type.label}>ACCOUNT</Text>
        <View style={[card, { overflow: 'hidden' }]}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{session?.user.email}</Text>
          </View>
        </View>
      </View>

      {/* Display name */}
      <View style={styles.section}>
        <Text style={type.label}>YOUR NAME</Text>
        <View style={[card, { overflow: 'hidden' }]}>
          <TextInput
            style={[styles.input, type.body, { fontSize: 15 }]}
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

      {/* Sign out */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} disabled={loggingOut}>
          {loggingOut
            ? <ActivityIndicator color={colors.danger} size="small" />
            : <Text style={styles.signOutText}>Sign out</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: 48 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { fontSize: 15, color: colors.dark, fontWeight: '500' },
  rowValue: { fontSize: 15, color: colors.mid, flex: 1, textAlign: 'right' },
  creditsValue: { fontSize: 18, fontWeight: '800', color: colors.gold },
  buyBtn: { margin: 12, marginTop: 4, backgroundColor: colors.goldLight, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.goldMid },
  buyBtnText: { color: colors.goldDark, fontWeight: '700', fontSize: 14 },
  input: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  saveBtn: { margin: 12, paddingVertical: 12 },
  saveBtnDisabled: { opacity: 0.4 },
  signOutBtn: { backgroundColor: colors.dangerBg, borderRadius: 16, borderWidth: 1, borderColor: colors.dangerBorder, paddingVertical: 16, alignItems: 'center' },
  signOutText: { color: colors.danger, fontWeight: '700', fontSize: 16 },
})
