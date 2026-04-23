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
  const [purchasing, setPurchasing] = useState<string | null>(null)

  async function handleBuy(amount: number, packTitle: string) {
    if (!session) return
    setPurchasing(packTitle)
    try {
      const { data: { session: currentSession } } = await (await import('../lib/supabase')).supabase.auth.getSession()
      await purchaseCredits(currentSession!.access_token, amount)
      Alert.alert('Success!', `${amount} credits have been added to your account.`)
      router.back()
    } catch (e: any) {
      if (e.message !== 'Canceled') {
        Alert.alert('Payment failed', e.message)
      }
    } finally {
      setPurchasing(null)
    }
  }

  const PACKS = [
    {
      id: 'taste',
      title: 'Taste Pack',
      amount: 3,
      price: '$2.99',
      detail: 'Perfect for your first creation',
      badge: null,
      featured: false,
    },
    {
      id: 'imagination',
      title: 'Imagination Pack',
      amount: 12,
      price: '$9.99',
      detail: '~$0.83 per transformation',
      badge: 'POPULAR',
      featured: true,
    }
  ]

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

        <View style={styles.packsGrid}>
          {PACKS.map((pack) => (
            <View 
              key={pack.id} 
              style={[
                styles.offerCard, 
                pack.featured ? styles.offerCardFeatured : styles.offerCardStandard
              ]}
            >
              {pack.badge && (
                <View style={styles.offerBadge}>
                  <Text style={styles.offerBadgeText}>{pack.badge}</Text>
                </View>
              )}
              <Text style={[styles.offerTitle, pack.featured && styles.textWhite]}>{pack.title}</Text>
              <Text style={[styles.offerAmount, pack.featured && styles.textWhite]}>{pack.amount} Credits</Text>
              <Text style={[styles.offerPrice, pack.featured && styles.textWhite]}>{pack.price}</Text>
              <Text style={[styles.offerDetail, pack.featured && styles.textWhiteMuted]}>{pack.detail}</Text>

              <TouchableOpacity 
                style={[
                  styles.buyBtn, 
                  pack.featured ? styles.buyBtnFeatured : styles.buyBtnStandard,
                  purchasing === pack.title && styles.buyBtnDisabled
                ]} 
                onPress={() => handleBuy(pack.amount, pack.title)}
                disabled={!!purchasing}
              >
                {purchasing === pack.title ? (
                  <ActivityIndicator color={pack.featured ? colors.white : colors.dark} />
                ) : (
                  <Text style={[styles.buyBtnText, pack.featured ? styles.textWhite : styles.textDark]}>
                    Buy {pack.amount}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
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
  packsGrid: { width: '100%', gap: 16 },
  offerCard: { width: '100%', borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 8, borderWidth: 1 },
  offerCardFeatured: { backgroundColor: colors.gold, borderColor: colors.gold, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  offerCardStandard: { backgroundColor: colors.white, borderColor: colors.border },
  offerBadge: { backgroundColor: colors.dark, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 4, position: 'absolute', top: -10, alignSelf: 'center' },
  offerBadgeText: { color: colors.white, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  offerTitle: { fontSize: 15, fontWeight: '700', color: colors.dark, opacity: 0.9, marginBottom: 4 },
  offerAmount: { fontSize: 32, fontWeight: '900', color: colors.dark, marginBottom: 4 },
  offerPrice: { fontSize: 24, fontWeight: '800', color: colors.dark, marginBottom: 8 },
  offerDetail: { fontSize: 13, color: colors.mid, opacity: 0.8, marginBottom: 20, textAlign: 'center' },
  buyBtn: { width: '100%', borderRadius: 100, paddingVertical: 14, alignItems: 'center' },
  buyBtnFeatured: { backgroundColor: colors.dark },
  buyBtnStandard: { backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border },
  buyBtnDisabled: { opacity: 0.7 },
  buyBtnText: { fontSize: 16, fontWeight: '800' },
  textWhite: { color: colors.white },
  textWhiteMuted: { color: colors.white, opacity: 0.8 },
  textDark: { color: colors.dark },
  info: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16, marginTop: 24 },
})
