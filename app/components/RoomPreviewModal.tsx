import React from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image, ImageBackground, Dimensions } from 'react-native'
import { colors, type, btn } from '../lib/theme'

interface RoomPreviewModalProps {
  visible: boolean
  imageUrl: string
  onClose: () => void
}

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// High-quality, warm living room background from Unsplash
const ROOM_BG = 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?q=80&w=2000&auto=format&fit=crop'

export default function RoomPreviewModal({ visible, imageUrl, onClose }: RoomPreviewModalProps) {
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="overFullScreen" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ImageBackground source={{ uri: ROOM_BG }} style={styles.roomBg} resizeMode="cover">
            <View style={styles.artworkWrapper}>
              <Image source={{ uri: imageUrl }} style={styles.artwork} resizeMode="contain" />
              <View style={styles.shadow} />
            </View>
            
            {/* Header / Close button overlay */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeEmoji}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom info card */}
            <View style={styles.infoCard}>
              <Text style={styles.title}>Visualizing in your space</Text>
              <Text style={styles.subtitle}>Standard 18" x 24" framed print</Text>
              <TouchableOpacity style={btn.primary} onPress={onClose}>
                <Text style={btn.primaryText}>Close Preview</Text>
              </TouchableOpacity>
            </View>
          </ImageBackground>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: SCREEN_WIDTH,
    height: '100%',
    backgroundColor: colors.cream,
    overflow: 'hidden',
  },
  roomBg: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  artworkWrapper: {
    width: SCREEN_WIDTH * 0.4,
    aspectRatio: 3/4,
    // Positioned on the wall above the bench in this specific Unsplash photo
    marginTop: -80, 
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  artwork: {
    width: '100%',
    height: '100%',
    borderWidth: 8,
    borderColor: colors.white, // Frame
  },
  shadow: {
    position: 'absolute',
    bottom: -10,
    left: 10,
    right: 10,
    height: 20,
    backgroundColor: 'black',
    opacity: 0.1,
    borderRadius: 50,
    transform: [{ scaleX: 0.8 }],
    zIndex: -1,
  },
  header: {
    position: 'absolute',
    top: 60,
    right: 20,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeEmoji: {
    fontSize: 20,
    color: colors.dark,
    fontWeight: '600',
  },
  infoCard: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...type.h3,
    marginBottom: 4,
  },
  subtitle: {
    ...type.body,
    fontSize: 14,
    color: colors.muted,
    marginBottom: 20,
  },
})
