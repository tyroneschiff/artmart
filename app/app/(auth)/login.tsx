import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

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
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        Alert.alert('Check your email', 'We sent you a confirmation link.')
      }

      if (__DEV__) {
        AsyncStorage.setItem(DEV_CREDS_KEY, JSON.stringify({ email, password })).catch(() => {})
      }

      if (returnTo) {
        router.replace(returnTo as any)
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
          <Text style={styles.logo}>draw up</Text>
          <Text style={styles.tagline}>Step inside your child's imagination.</Text>
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

          <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            <Text style={styles.toggle}>
              {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  inner: { flex: 1, justifyContent: 'center', padding: 28, minHeight: '100%' },
  logoWrap: { alignItems: 'center', marginBottom: 52 },
  logo: { fontSize: 42, fontWeight: '900', color: colors.dark, letterSpacing: -2, marginBottom: 8 },
  tagline: { fontSize: 16, color: colors.muted, fontWeight: '500' },
  form: { gap: 12 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: colors.dark,
  },
  button: {
    backgroundColor: colors.dark,
    borderRadius: 100,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  toggle: { color: colors.muted, textAlign: 'center', fontSize: 14, marginTop: 8 },
})
