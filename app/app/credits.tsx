import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../hooks/useAuthStore'
import { useCredits } from '../lib/useCredits'
import { purchaseCredits } from '../lib/checkout'
import { colors, type, btn, card } from '../lib/theme'

type Pack = {
  id: string
  name: string
  amount: number
  price: string
  perPiece: string
  badge?: string
  featured?: boolean
}

const PACKS: Pack[] = [
  { id: 'starter', name: 'Starter',  amount: 3,  price: '$2.99',  perPiece: '$1.00 per drawing' },
  { id: 'creator', name: 'Creator',  amount: 12, price: '$9.99',  perPiece: '$0.83 per drawing', badge: 'Most popular', featured: true },
  { id: 'family',  name: 'Family',   amount: 25, price: '$19.99', perPiece: '$0.80 per drawing' },
]

export default function CreditsScreen() {
  const session = useAuthStore((s) => s.session)
  const queryClient = useQueryClient()
  const { data: credits, isLoading } = useCredits()
  const [purchasing, setPurchasing] = useState<string | null>(null)

  async function handleBuy(pack: Pack) {
    if (!session) return
    setPurchasing(pack.id)
    try {
      const { data: { session: currentSession } } = await (await import('../lib/supabase')).supabase.auth.getSession()
      const newBalance = await purchaseCredits(currentSession!.access_token, pack.amount)
      queryClient.setQueryData<number>(['credits', session.user.id], newBalance)
      Alert.alert('Magic incoming ✨', `${pack.amount} credits added. Go transform something.`)
      router.back()
    } catch (e: any) {
      if (e.message !== 'Canceled') Alert.alert('Payment failed', e.message)
    } finally {
      setPurchasing(null)
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={20} color={colors.dark} />
        </TouchableOpacity>
        <Text style={styles.title}>Keep the magic going</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.balancePill}>
          <Ionicons name="sparkles" size={14} color={colors.goldDark} />
          <Text style={styles.balancePillText}>
            {isLoading ? '…' : `${credits ?? 0} credit${credits === 1 ? '' : 's'} left`}
          </Text>
        </View>

        <Text style={styles.subhead}>
          Each credit turns one drawing into a world.
        </Text>

        <View style={styles.packs}>
          {PACKS.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              isPurchasing={purchasing === pack.id}
              anyPurchasing={!!purchasing}
              onPress={() => handleBuy(pack)}
            />
          ))}
        </View>

        <Text style={styles.fineprint}>
          Credits never expire. Refunded automatically if a transform fails.
        </Text>
      </ScrollView>
    </View>
  )
}

function PackCard({ pack, isPurchasing, anyPurchasing, onPress }: {
  pack: Pack
  isPurchasing: boolean
  anyPurchasing: boolean
  onPress: () => void
}) {
  return (
    <View style={[styles.packCard, pack.featured && styles.packCardFeatured]}>
      {pack.badge && (
        <View style={styles.packBadge}>
          <Text style={styles.packBadgeText}>{pack.badge}</Text>
        </View>
      )}

      <View style={styles.packHeader}>
        <Text style={styles.packName}>{pack.name}</Text>
        <Text style={styles.packPrice}>{pack.price}</Text>
      </View>

      <View style={styles.packMeta}>
        <Text style={styles.packAmount}>{pack.amount} credits</Text>
        <Text style={styles.packDot}>·</Text>
        <Text style={styles.packPerPiece}>{pack.perPiece}</Text>
      </View>

      <TouchableOpacity
        style={[btn.primary, styles.buyBtn, anyPurchasing && !isPurchasing && styles.buyBtnFaded]}
        onPress={onPress}
        disabled={anyPurchasing}
        activeOpacity={0.85}
      >
        {isPurchasing ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={btn.primaryText}>Buy {pack.amount} credits</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 18, paddingBottom: 12, paddingHorizontal: 20,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.dark, letterSpacing: -0.4 },

  content: { paddingHorizontal: 20, paddingBottom: 48, paddingTop: 12 },

  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center',
    backgroundColor: colors.goldLight,
    borderWidth: 1, borderColor: colors.goldMid,
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8,
    marginBottom: 24,
  },
  balancePillText: { fontSize: 13, fontWeight: '700', color: colors.goldDark, letterSpacing: -0.1 },

  subhead: {
    textAlign: 'center',
    fontSize: 15, color: colors.mid, fontWeight: '500',
    marginBottom: 28, paddingHorizontal: 16, lineHeight: 22,
  },

  packs: { gap: 14 },
  packCard: {
    ...card,
    padding: 20,
    paddingTop: 22,
  },
  packCardFeatured: {
    backgroundColor: colors.goldLight,
    borderColor: colors.goldMid,
    borderWidth: 1.5,
    paddingTop: 28,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  packBadge: {
    position: 'absolute', top: -10, alignSelf: 'center',
    backgroundColor: colors.dark,
    borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5,
  },
  packBadgeText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },

  packHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  packName: { fontSize: 18, fontWeight: '800', color: colors.dark, letterSpacing: -0.4 },
  packPrice: { fontSize: 22, fontWeight: '900', color: colors.dark, letterSpacing: -0.6 },

  packMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  packAmount: { fontSize: 13, fontWeight: '700', color: colors.dark },
  packDot: { fontSize: 13, color: colors.muted },
  packPerPiece: { fontSize: 13, fontWeight: '700', color: colors.goldDark },

  buyBtn: { paddingVertical: 14 },
  buyBtnFaded: { opacity: 0.4 },

  fineprint: {
    textAlign: 'center', fontSize: 13, color: colors.muted,
    fontWeight: '500', marginTop: 28, paddingHorizontal: 16, lineHeight: 19,
  },
})
