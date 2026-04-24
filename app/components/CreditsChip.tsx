import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useCredits } from '../lib/useCredits'
import { colors } from '../lib/theme'

export default function CreditsChip() {
  const { data: credits } = useCredits()
  const router = useRouter()

  if (typeof credits !== 'number') return null

  const handleGetMore = () => {
    try {
      router.push('/credits')
    } catch (err) {
      console.error('Navigation error:', err)
      Alert.alert('Navigation Error', 'Could not open credits screen.')
    }
  }

  return (
    <View style={styles.creditsContainer}>
      <View style={styles.creditsChip}>
        <Text style={styles.creditsChipText}>✨ {credits} {credits === 1 ? 'credit' : 'credits'}</Text>
      </View>
      {credits <= 1 && (
        <TouchableOpacity style={styles.getMoreBtn} onPress={handleGetMore}>
          <Text style={styles.getMoreBtnText}>Get more</Text>
        </TouchableOpacity>
      )}
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
