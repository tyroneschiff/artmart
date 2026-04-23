import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '../lib/../hooks/useAuthStore'
import { useCredits, useInvalidateCredits } from '../lib/useCredits'
import { purchaseCredits } from '../lib/checkout'
import { colors } from '../lib/theme'

export default function CreditsScreen() {
  const session = useAuthStore((s) => s.session)
  const { data: credits, isLoading } = useCredits()
  const invalidateCredits = useInvalidateCredits()
  const [purchasing, setPurchasing] = useState(false)

  async function handleBuy() {
    if (!session) return
    setPurchasing(true)
    try {
      const { data: { session: currentSession } } = await (await import('../lib/supabase')).supabase.auth.getSession()
      await purchaseCredits(currentSession!.access_token)
      invalidateCredits()
      Alert.alert('Success!', '12 credits have been added to your account.')
      router.back()
    } catch (e: any) {
      if (e.message !== 'Canceled') {
        Alert.alert('Payment failed', e.message)
      }
    } finally {
      setPurchasing(false)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Step Inside</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Your Balance</Text>
          <Text style={styles.balanceValue}>{isLoading ? '...' : credits}</Text>
          <Text style={styles.balanceSub}>credits remaining</Text>
        </View>

        <View style={styles.offerCard}>
          <View style={styles.offerBadge}><Text style={styles.offerBadgeText}>POPULAR</Text></View>
          <Text style={styles.offerTitle}>Imagination Pack</Text>
          <Text style={styles.offerAmount}>12 Credits</Text>
          <Text style={styles.offerPrice}>$9.99</Text>
          <Text style={styles.offerDetail}>~$0.83 per transformation</Text>

          <TouchableOpacity 
            style={[styles.buyBtn, purchasing && styles.buyBtnDisabled]} 
            onPress={handleBuy}
            disabled={purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buyBtnText}>Buy 12 Credits</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.info}>
          Each credit lets you step inside one drawing. The AI transforms the drawing into a living world using your child's original colors and characters as the blueprint.
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  closeBtn: { position: 'absolute', left: 20, top: 20, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  closeText: { fontSize: 16, fontWeight: '700', color: colors.dark },
  title: { fontSize: 18, fontWeight: '900', color: colors.dark, letterSpacing: -0.5 },
  content: { padding: 24, alignItems: 'center' },
  balanceCard: { backgroundColor: colors.white, width: '100%', borderRadius: 24, padding: 32, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: colors.border },
  balanceLabel: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  balanceValue: { fontSize: 64, fontWeight: '900', color: colors.dark, letterSpacing: -2 },
  balanceSub: { fontSize: 15, color: colors.mid, marginTop: 4 },
  offerCard: { backgroundColor: colors.gold, width: '100%', borderRadius: 24, padding: 32, alignItems: 'center', marginBottom: 32, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  offerBadge: { backgroundColor: colors.dark, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 16 },
  offerBadgeText: { color: colors.white, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  offerTitle: { fontSize: 15, fontWeight: '700', color: colors.white, opacity: 0.9, marginBottom: 4 },
  offerAmount: { fontSize: 32, fontWeight: '900', color: colors.white, marginBottom: 4 },
  offerPrice: { fontSize: 24, fontWeight: '800', color: colors.white, marginBottom: 12 },
  offerDetail: { fontSize: 13, color: colors.white, opacity: 0.8, marginBottom: 24 },
  buyBtn: { backgroundColor: colors.dark, width: '100%', borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  buyBtnDisabled: { opacity: 0.7 },
  buyBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  info: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
})
