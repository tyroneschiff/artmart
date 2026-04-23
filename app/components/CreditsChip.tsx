import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useCredits } from '../lib/useCredits'
import { colors } from '../lib/theme'

export default function CreditsChip() {
  const { data: credits } = useCredits()
  const router = useRouter()

  if (typeof credits !== 'number') return null

  return (
    <View style={styles.creditsContainer}>
      <View style={styles.creditsChip}>
        <Text style={styles.creditsChipText}>✨ {credits} {credits === 1 ? 'credit' : 'credits'}</Text>
      </View>
      <TouchableOpacity style={styles.getMoreBtn} onPress={() => router.push('/credits')}>
        <Text style={styles.getMoreBtnText}>Get more</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  creditsContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  creditsChip: { backgroundColor: colors.dark, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  creditsChipText: { color: colors.cream, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  getMoreBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  getMoreBtnText: {
    color: colors.mid,
    fontSize: 12,
    fontWeight: '600',
  },
})
