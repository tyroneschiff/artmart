import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../lib/supabase'
import { track } from '../../lib/analytics'
import { colors, radius, opacity } from '../../lib/theme'

const DEV_CREDS_KEY = '__dev_login_creds__'

export default function LoginScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  useEffect(() => {
    if (!__DEV__) return
    AsyncStorage.getItem(DEV_CREDS_KEY).then((raw) => {
      if (!raw) return
      try {
        const { email: savedEmail, password: savedPassword } = JSON.parse(raw)
        if (savedEmail) setEmail(savedEmail)
        if (savedPassword) setPassword(savedPassword)
      } catch {}
    })
  }, [])

  async function handleSubmit() {
    if (!email || !password) return
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          // Always go through our /auth/confirmed page on the web. On
          // iPhone the page auto-deep-links into the app (forwarding
          // the hash so the deep-link handler in _layout.tsx can
          // setSession). On desktop the page shows a clear "Email
          // confirmed" message + TestFlight CTA. Avoids the old failure
          // where Supabase fell back to Site URL = drawup.ink (homepage).
          options: { emailRedirectTo: 'https://drawup.ink/auth/confirmed' },
        })
        if (error) throw error
        track('signup_completed')
        Alert.alert('Check your email', 'We sent you a confirmation link.')
      }

      if (__DEV__) {
        AsyncStorage.setItem(DEV_CREDS_KEY, JSON.stringify({ email, password })).catch(() => {})
      }

      if (returnTo) {
        router.replace(returnTo as any)
      } else if (mode === 'signup') {
        // New parents: drop them straight into the magic moment
        router.replace('/(tabs)/create')
      } else {
        router.replace('/(tabs)/discover')
      }
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrap}>
          <Text style={styles.logo}>
            draw <Text style={styles.logoAccent}>up</Text>
          </Text>
          <Text style={styles.tagline}>Step inside your child's drawing.</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            autoComplete="email"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType={mode === 'login' ? 'password' : 'newPassword'}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Loading…' : mode === 'login' ? 'Sign in' : 'Create account'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toggleBtn} onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            <Text style={styles.toggleText}>
              {mode === 'login' ? (
                <>Don't have an account? <Text style={styles.toggleAccent}>Sign up</Text></>
              ) : (
                <>Already have an account? <Text style={styles.toggleAccent}>Sign in</Text></>
              )}
            </Text>
          </TouchableOpacity>

          <Text style={styles.fineprint}>
            Free to try · Your first three drawings are on us
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 56, minHeight: '100%' },
  logoWrap: { alignItems: 'center', marginBottom: 56 },
  logo: { fontSize: 48, fontWeight: '900', color: colors.dark, letterSpacing: -2.5, marginBottom: 14 },
  logoAccent: { color: colors.gold },
  tagline: { fontSize: 17, color: colors.mid, fontWeight: '500', textAlign: 'center', letterSpacing: -0.3 },
  form: { gap: 12 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    fontSize: 16,
    color: colors.dark,
  },
  button: {
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: { opacity: opacity.disabled },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  toggleBtn: { paddingVertical: 14, alignItems: 'center' },
  toggleText: { color: colors.mid, textAlign: 'center', fontSize: 14, fontWeight: '500' },
  toggleAccent: { color: colors.gold, fontWeight: '700' },
  fineprint: { textAlign: 'center', color: colors.muted, fontSize: 13, fontWeight: '500', marginTop: 4 },
})
