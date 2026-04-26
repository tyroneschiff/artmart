import { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Clipboard, Alert, Platform, Share } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { colors } from '../lib/theme'
import { SharePayload, shareToWhatsApp } from '../lib/share'
import { track } from '../lib/analytics'

type Props = {
  visible: boolean
  payload: SharePayload | null
  imageUri?: string
  childName?: string
  onClose: () => void
}

export default function ShareSheet({ visible, payload, onClose }: Props) {
  // Parse URL to attribute the share event back to a piece or gallery.
  const trackProps = (() => {
    if (!payload) return {}
    const m = payload.url.match(/\/piece\/([^/?#]+)/)
    return m ? { pieceId: m[1] } : {}
  })()

  useEffect(() => {
    if (visible && payload) track('share_started', trackProps)
  }, [visible, payload?.url])

  if (!payload) return null

  async function handleNativeShare() {
    try {
      await Share.share({
        title: payload!.title,
        message: payload!.message,
        url: payload!.url,
      })
      track('share_completed', { ...trackProps, metadata: { channel: 'native' } })
      Haptics.selectionAsync().catch(() => {})
    } catch (e: any) {
      Alert.alert('Share failed', e?.message || 'Could not open share sheet')
    }
    onClose()
  }

  async function handleWhatsApp() {
    onClose()
    track('share_completed', { ...trackProps, metadata: { channel: 'whatsapp' } })
    Haptics.selectionAsync().catch(() => {})
    await shareToWhatsApp(`${payload!.message}\n${payload!.url}`)
  }

  async function handleCopy() {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(payload!.url)
    } else {
      Clipboard.setString(payload!.url)
    }
    track('share_completed', { ...trackProps, metadata: { channel: 'copy' } })
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    onClose()
    Alert.alert('Copied!', 'Link copied to clipboard.')
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{payload.title}</Text>
        <Text style={styles.url} numberOfLines={1}>{payload.url}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={handleNativeShare} activeOpacity={0.7}>
            <View style={styles.actionIcon}>
              <Ionicons name="share-outline" size={28} color={colors.dark} />
            </View>
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.action} onPress={handleWhatsApp} activeOpacity={0.7}>
            <View style={styles.actionIcon}>
              <Ionicons name="logo-whatsapp" size={28} color="#25D366" />
            </View>
            <Text style={styles.actionLabel}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.action} onPress={handleCopy} activeOpacity={0.7}>
            <View style={styles.actionIcon}>
              <Ionicons name="link-outline" size={28} color={colors.dark} />
            </View>
            <Text style={styles.actionLabel}>Copy link</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.dark,
    letterSpacing: -0.3,
    marginBottom: 4,
    textAlign: 'center',
  },
  url: {
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 28,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 24,
  },
  action: {
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mid,
    letterSpacing: -0.1,
  },
  cancelBtn: {
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.mid,
  },
})
