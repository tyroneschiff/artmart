import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Clipboard, Alert, Platform } from 'react-native'
import { colors } from '../lib/theme'
import { SharePayload, shareNative, shareToWhatsApp } from '../lib/share'
import { exportStoryCard } from '../lib/export'

type Props = {
  visible: boolean
  payload: SharePayload | null
  imageUri?: string // Added to support story export
  childName?: string // Added to support story export
  onClose: () => void
}

export default function ShareSheet({ visible, payload, imageUri, childName, onClose }: Props) {
  if (!payload) return null

  async function handleWhatsApp() {
    onClose()
    await shareToWhatsApp(`${payload!.message}\n${payload!.url}`)
  }

  async function handleInstagram() {
    onClose()
    if (imageUri) {
      await exportStoryCard(imageUri, payload!.title, childName || 'Artist')
    } else {
      Alert.alert('Not available', 'Story export is only available for full pieces.')
    }
  }

  async function handleNative() {
    onClose()
    await shareNative(payload!)
  }

  async function handleCopy() {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(payload!.url)
    } else {
      Clipboard.setString(payload!.url)
    }
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
          <TouchableOpacity style={styles.action} onPress={handleWhatsApp}>
            <View style={[styles.actionIcon, { backgroundColor: '#E8F8EE' }]}>
              <Text style={styles.actionEmoji}>💬</Text>
            </View>
            <Text style={styles.actionLabel}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.action} onPress={handleInstagram}>
            <View style={[styles.actionIcon, { backgroundColor: colors.goldLight }]}>
              <Text style={styles.actionEmoji}>📸</Text>
            </View>
            <Text style={styles.actionLabel}>Story</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.action} onPress={handleNative}>
            <View style={[styles.actionIcon, { backgroundColor: '#EEF0F8' }]}>
              <Text style={styles.actionEmoji}>↑</Text>
            </View>
            <Text style={styles.actionLabel}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.action} onPress={handleCopy}>
            <View style={[styles.actionIcon, { backgroundColor: '#F8F8F8' }]}>
              <Text style={styles.actionEmoji}>🔗</Text>
            </View>
            <Text style={styles.actionLabel}>Copy</Text>
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionEmoji: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.dark,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.mid,
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
