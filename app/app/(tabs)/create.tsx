import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, Image, StyleSheet, Alert,
  TextInput, ScrollView, ActivityIndicator, Modal, FlatList, Platform
} from 'react-native'
import { useRouter } from 'expo-router'
import ConfettiCannon from 'react-native-confetti-cannon'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, supabaseUrl, supabaseAnonKey } from '../../lib/supabase'
import { useAuthStore } from '../../hooks/useAuthStore'
import { transformArtwork, OutOfCreditsError } from '../../lib/transformArtwork'
import { useCredits } from '../../lib/useCredits'
import { colors, btn, type, card } from '../../lib/theme'
import { shareToWhatsApp, shareNative, buildPieceShareMessage, SharePayload } from '../../lib/share'
import { exportStoryCard } from '../../lib/export'
import CreditsChip from '../../components/CreditsChip'
import ReadAloudButton from '../../components/ReadAloudButton'

const isWeb = Platform.OS === 'web'

const PRICE_DIGITAL_CENTS = 500
const PRICE_PRINT_CENTS = 3000

const TRANSFORM_TIPS = [
  "Analyzing every brushstroke...",
  "Building a world from this imagination...",
  "Rendering magical lighting...",
  "Preparing your portal...",
]

type Store = { id: string; child_name: string; slug: string }

async function fetchMyStores(userId: string): Promise<Store[]> {
  const { data, error } = await supabase.from('stores').select('id, child_name, slug').eq('owner_id', userId)
  if (error) throw error
  return data
}

function withUploadTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Upload timed out. Check your connection and try again.')), 90_000)
    ),
  ])
}

export default function CreateScreen() {
  const session = useAuthStore((s) => s.session)
  const queryClient = useQueryClient()
  const router = useRouter()
  const { data: credits } = useCredits()

  const [imageUri, setImageUri] = useState<string | null>(null)
  const [transformedUri, setTransformedUri] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [storePickerVisible, setStorePickerVisible] = useState(false)
  const [step, setStep] = useState<'pick' | 'transform' | 'publish' | 'success'>('pick')
  const [transforming, setTransforming] = useState(false)
  const [tipIndex, setTipIndex] = useState(0)
  const [transformError, setTransformError] = useState<string | null>(null)

  useEffect(() => {
    let interval: any
    if (transforming) {
      setTipIndex(0)
      interval = setInterval(() => {
        setTipIndex((prev) => (prev + 1) % TRANSFORM_TIPS.length)
      }, 5000)
    }
    return () => clearInterval(interval)
  }, [transforming])
  const [showCreditsUpsell, setShowCreditsUpsell] = useState(false)
  const [aiDescription, setAiDescription] = useState('')
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null)

  // Inline store creation state
  const [newStoreName, setNewStoreName] = useState('')
  const [creatingStore, setCreatingStore] = useState(false)

  const { data: stores, refetch: refetchStores } = useQuery({
    queryKey: ['mystores', session?.user.id],
    queryFn: () => fetchMyStores(session!.user.id),
    enabled: !!session,
  })

  function resetCreate() {
    setStep('pick')
    setImageUri(null)
    setTransformedUri(null)
    setTitle('')
    setSelectedStore(null)
    setAiDescription('')
    setTransformError(null)
    setShowCreditsUpsell(false)
    setSharePayload(null)
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: false,
    })
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri)
      setTransformedUri(null)
      setStep('transform')
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required.'); return }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: false })
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri)
      setTransformedUri(null)
      setStep('transform')
    }
  }

  async function handleTransform() {
    if (!imageUri) return
    setTransforming(true)
    setTransformError(null)
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      )
      const { transformedUrl, description, credits: newCredits } = await transformArtwork(imageUri, compressed.base64 ?? undefined)
      if (session?.user.id) queryClient.setQueryData<number>(['credits', session.user.id], newCredits)
      
      const localPath = FileSystem.documentDirectory + `transformed_${Date.now()}.jpg`
      const { uri: downloadedUri } = await withUploadTimeout(
        FileSystem.downloadAsync(transformedUrl, localPath)
      )
      
      setTransformedUri(downloadedUri)
      setAiDescription(description)
      setStep('publish')
    } catch (e: any) {
      if (e instanceof OutOfCreditsError) {
        queryClient.invalidateQueries({ queryKey: ['credits'] })
        setShowCreditsUpsell(true)
      } else {
        setTransformError(e.message ?? 'Something went wrong. Please try again.')
      }
    } finally {
      setTransforming(false)
    }
  }

  async function handleCreateStoreInline() {
    if (!newStoreName.trim() || !session) return
    setCreatingStore(true)
    try {
      const slug = newStoreName.trim().toLowerCase().replace(/\s+/g, '-')
      const { error } = await supabase.from('stores').insert({
        owner_id: session.user.id,
        child_name: newStoreName.trim(),
        slug,
      })
      if (error) throw error
      const { data } = await refetchStores()
      const created = data?.find((s) => s.slug === slug)
      if (created) setSelectedStore(created)
      setNewStoreName('')
      queryClient.invalidateQueries({ queryKey: ['mystores'] })
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setCreatingStore(false)
    }
  }

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStore || !imageUri || !transformedUri || !title || !session) throw new Error('Missing required fields')

      const ext = imageUri.split('.').pop()?.split('?')[0] ?? 'jpg'
      const fileName = `${session.user.id}/${Date.now()}_original.${ext}`

      // Upload original
      const originalUploadUrl = `${supabaseUrl}/storage/v1/object/artwork/${fileName}`
      const originalResult = await withUploadTimeout(
        FileSystem.uploadAsync(originalUploadUrl, imageUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseAnonKey,
            'Content-Type': `image/${ext === 'png' ? 'png' : 'jpeg'}`,
          },
        })
      )
      if (originalResult.status >= 400) throw new Error(`Original upload failed: ${originalResult.body}`)
      const { data: { publicUrl: originalUrl } } = supabase.storage.from('artwork').getPublicUrl(fileName)

      // Upload transformed
      const transformedFileName = `${session.user.id}/${Date.now()}_transformed.jpg`
      const transformedUploadUrl = `${supabaseUrl}/storage/v1/object/artwork/${transformedFileName}`
      const transformedResult = await withUploadTimeout(
        FileSystem.uploadAsync(transformedUploadUrl, transformedUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseAnonKey,
            'Content-Type': 'image/jpeg',
          },
        })
      )
      if (transformedResult.status >= 400) throw new Error(`Transformed upload failed: ${transformedResult.body}`)
      const { data: { publicUrl: transformedStoredUrl } } = supabase.storage.from('artwork').getPublicUrl(transformedFileName)

      // Generate and upload watermarked (low-res preview) version
      const watermarked = await ImageManipulator.manipulateAsync(
        transformedUri,
        [{ resize: { width: 800 } }],
        { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG }
      )
      const watermarkedFileName = `${session.user.id}/${Date.now()}_preview.jpg`
      const watermarkedUploadUrl = `${supabaseUrl}/storage/v1/object/artwork/${watermarkedFileName}`
      const watermarkedResult = await withUploadTimeout(
        FileSystem.uploadAsync(watermarkedUploadUrl, watermarked.uri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseAnonKey,
            'Content-Type': 'image/jpeg',
          },
        })
      )
      if (watermarkedResult.status >= 400) throw new Error(`Preview upload failed: ${watermarkedResult.body}`)
      const { data: { publicUrl: watermarkedUrl } } = supabase.storage.from('artwork').getPublicUrl(watermarkedFileName)

      const { data: pieceRow, error } = await supabase.from('pieces').insert({
        store_id: selectedStore.id,
        title: title.trim(),
        original_image_url: originalUrl,
        transformed_image_url: transformedStoredUrl,
        watermarked_image_url: watermarkedUrl,
        ai_description: aiDescription || null,
        price_digital: PRICE_DIGITAL_CENTS,
        price_print: PRICE_PRINT_CENTS,
        published: true,
      }).select('id').single()
      if (error) throw error
      return { slug: selectedStore.slug, pieceId: pieceRow!.id, pieceTitle: title.trim(), childName: selectedStore.child_name }
    },
    onSuccess: ({ slug, pieceId, pieceTitle, childName }) => {
      queryClient.invalidateQueries({ queryKey: ['discover'] })
      queryClient.invalidateQueries({ queryKey: ['store', slug] })
      queryClient.invalidateQueries({ queryKey: ['mystores'] })
      setSharePayload(buildPieceShareMessage(pieceTitle, childName, pieceId))
      setStep('success')
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  })

  const hasStores = stores && stores.length > 0

  if (step === 'success' && sharePayload) {
    return (
      <View style={[styles.container, styles.successContainer]}>
        <ConfettiCannon count={200} origin={{x: -10, y: 0}} fadeOut={true} />
        <ScrollView contentContainerStyle={styles.successContent}>
          <View style={[card, styles.successCard]}>
            <Image source={{ uri: transformedUri! }} style={styles.successImage} />
            <Text style={[type.h1, { marginBottom: 8, textAlign: 'center' }]}>Published!</Text>
            <Text style={[type.body, { textAlign: 'center', marginBottom: 16, color: colors.mid }]}>
              "{title}" is now live in {selectedStore?.child_name}'s store.
            </Text>
            {aiDescription ? (
              <View style={{ width: '100%', marginBottom: 24, backgroundColor: colors.goldLight, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.goldMid }}>
                <Text style={{ fontSize: 14, color: colors.dark, lineHeight: 22, marginBottom: 12 }}>{aiDescription}</Text>
                <ReadAloudButton text={aiDescription} compact />
              </View>
            ) : null}
            
            <TouchableOpacity 
              style={[btn.primary, { backgroundColor: colors.gold, width: '100%', paddingVertical: 18, marginBottom: 12 }]} 
              onPress={() => {
                const grandmaMessage = `Look what ${selectedStore?.child_name || 'Artist'} just created! ✨ I stepped inside their drawing and found this: ${sharePayload.url}`
                shareToWhatsApp(grandmaMessage)
              }}
            >
              <Text style={[btn.primaryText, { fontSize: 16, fontWeight: '800' }]}>Send to Grandma</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[btn.secondary, { width: '100%', paddingVertical: 18, marginBottom: 12 }]} 
              onPress={() => exportStoryCard(transformedUri!, title, selectedStore?.child_name || 'Artist')}
            >
              <Text style={[btn.secondaryText, { fontSize: 16, fontWeight: '800' }]}>Export for Instagram Story</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ paddingVertical: 12, width: '100%', alignItems: 'center' }} 
              onPress={() => shareNative(sharePayload)}
            >
              <Text style={[type.label, { color: colors.muted, fontWeight: '600' }]}>Other Sharing Options</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.startOverBtn} onPress={resetCreate}>
            <Text style={[type.body, { color: colors.goldDark, fontWeight: '700' }]}>Step inside another drawing →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={type.h1}>Create</Text>
        <CreditsChip />
      </View>

      {step === 'pick' && (
        <View style={styles.pickArea}>
          <Text style={[type.body, { marginBottom: 16, textAlign: 'center', color: colors.mid }]}>Photograph your child's artwork</Text>
          <TouchableOpacity style={[btn.primary, { padding: 24, borderRadius: 20, gap: 8 }]} onPress={takePhoto}>
            <Text style={{ fontSize: 32 }}>📷</Text>
            <Text style={btn.primaryText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[btn.secondary, { padding: 24, borderRadius: 20, gap: 8 }]} onPress={pickImage}>
            <Text style={{ fontSize: 32 }}>🖼️</Text>
            <Text style={btn.secondaryText}>Choose from Library</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'transform' && imageUri && (
        <View>
          <Image source={{ uri: imageUri }} style={styles.preview} />
          {showCreditsUpsell ? (
            <View style={styles.upsellCard}>
              <Text style={styles.upsellTitle}>Out of credits</Text>
              <Text style={styles.upsellMessage}>You're out of credits. Buy a pack to keep bringing your child's imagination to life.</Text>
              <TouchableOpacity style={[btn.primary, { paddingVertical: 12, paddingHorizontal: 24 }]} onPress={() => router.push('/credits')}>
                <Text style={btn.primaryText}>Buy Credits</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[type.body, { marginBottom: 16, textAlign: 'center', color: colors.mid }]}>Ready to step inside this drawing?</Text>
              {isWeb
                ? <View style={styles.webNotice}><Text style={styles.webNoticeText}>📱 AI transformation works on the mobile app.</Text></View>
                : transforming
                  ? <View style={styles.center}>
                      <ActivityIndicator size="large" color={colors.gold} />
                      <Text style={[type.body, { fontWeight: '700' }]}>{TRANSFORM_TIPS[tipIndex]}</Text>
                      <Text style={[type.label, { color: colors.mid }]}>This takes about 30 seconds</Text>
                    </View>
                  : transformError
                    ? <View style={styles.errorBox}>
                        <Text style={styles.errorTitle}>Transform failed</Text>
                        <Text style={styles.errorMessage}>{transformError}</Text>
                        <TouchableOpacity style={btn.primary} onPress={handleTransform}>
                          <Text style={btn.primaryText}>Try again</Text>
                        </TouchableOpacity>
                      </View>
                    : <TouchableOpacity style={btn.primary} onPress={handleTransform}>
                        <Text style={btn.primaryText}>✨ Step Inside</Text>
                      </TouchableOpacity>
              }
            </>
          )}
          <TouchableOpacity onPress={() => { setStep('pick'); setTransformError(null); setShowCreditsUpsell(false) }}><Text style={styles.cancel}>← Start over</Text></TouchableOpacity>
        </View>
      )}

      {step === 'publish' && transformedUri && (
        <View>
          <View style={styles.compareRow}>
            <View style={styles.compareItem}>
              <Text style={[type.label, { marginBottom: 4, textAlign: 'center' }]}>The Drawing</Text>
              <Image source={{ uri: imageUri! }} style={styles.compareImage} />
            </View>
            <View style={styles.compareItem}>
              <Text style={[type.label, { marginBottom: 4, textAlign: 'center' }]}>The World</Text>
              <Image source={{ uri: transformedUri }} style={styles.compareImage} />
            </View>
          </View>

          <TextInput
            style={[styles.input, type.body]}
            placeholder="Give this piece a title"
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
          />

          {/* Store selector or inline creator */}
          {hasStores ? (
            <TouchableOpacity style={styles.storePicker} onPress={() => setStorePickerVisible(true)}>
              <Text style={[type.body, { color: colors.muted }, selectedStore && { color: colors.dark }]}>
                {selectedStore ? `${selectedStore.child_name}'s Store ✓` : 'Select a store →'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.inlineStoreCreate}>
              <Text style={styles.inlineStoreLabel}>No stores yet — create one to publish</Text>
              <View style={styles.inlineStoreRow}>
                <TextInput
                  style={[styles.inlineStoreInput, type.body, { fontSize: 15 }]}
                  placeholder="Child's name (e.g. Emma)"
                  placeholderTextColor={colors.muted}
                  value={newStoreName}
                  onChangeText={setNewStoreName}
                />
                <TouchableOpacity
                  style={[btn.primary, { borderRadius: 10, paddingHorizontal: 16 }, (!newStoreName.trim() || creatingStore) && styles.buttonDisabled]}
                  onPress={handleCreateStoreInline}
                  disabled={!newStoreName.trim() || creatingStore}
                >
                  {creatingStore
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Text style={btn.primaryText}>Create</Text>}
                </TouchableOpacity>
              </View>
              {selectedStore && (
                <Text style={styles.inlineStoreSuccess}>✓ {selectedStore.child_name}'s Store created</Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[btn.primary, (!title || !selectedStore) && styles.buttonDisabled]}
            onPress={() => publishMutation.mutate()}
            disabled={!title || !selectedStore || publishMutation.isPending}
          >
            <Text style={btn.primaryText}>{publishMutation.isPending ? 'Publishing...' : 'Publish to Store'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setStep('transform')}><Text style={styles.cancel}>← Retransform</Text></TouchableOpacity>
        </View>
      )}

      <Modal visible={storePickerVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Select Store</Text>
          <FlatList
            data={stores}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.storeOption} onPress={() => { setSelectedStore(item); setStorePickerVisible(false) }}>
                <Text style={styles.storeOptionText}>{item.child_name}'s Store</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity onPress={() => setStorePickerVisible(false)}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 24, paddingTop: 56 },
  header: { fontSize: 32, fontWeight: '900', color: colors.dark, letterSpacing: -1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  pickArea: { gap: 16 },
  prompt: { fontSize: 15, color: colors.mid, marginBottom: 16, textAlign: 'center' },
  bigBtn: { backgroundColor: colors.dark, borderRadius: 20, padding: 24, alignItems: 'center', gap: 8 },
  bigBtnSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  bigBtnIcon: { fontSize: 32 },
  bigBtnText: { fontSize: 16, fontWeight: '700', color: colors.white },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 16, marginBottom: 16 },
  button: { backgroundColor: colors.dark, borderRadius: 100, padding: 16, alignItems: 'center', marginBottom: 12 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  cancel: { color: colors.muted, textAlign: 'center', fontSize: 14, marginTop: 8, marginBottom: 8 },
  center: { alignItems: 'center', gap: 12, marginVertical: 16 },
  transformingText: { color: colors.dark, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  transformingSubtext: { color: colors.mid, fontSize: 13, textAlign: 'center' },
  upsellCard: {
    backgroundColor: colors.dangerBg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    alignItems: 'center',
    gap: 12,
  },
  upsellTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.dangerText,
    letterSpacing: -0.5,
  },
  upsellMessage: {
    fontSize: 15,
    color: colors.dangerText,
    textAlign: 'center',
    lineHeight: 20,
  },
  upsellBtn: {
    backgroundColor: colors.dark,
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  upsellBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.dangerBorder, gap: 8 },
  errorTitle: { fontSize: 14, fontWeight: '700', color: colors.dangerText },
  errorMessage: { fontSize: 13, color: colors.dangerText, lineHeight: 18, marginBottom: 4 },
  webNotice: { backgroundColor: colors.goldLight, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.goldMid },
  webNoticeText: { color: colors.goldDark, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  compareRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  compareItem: { flex: 1 },
  compareLabel: { fontSize: 12, color: colors.muted, marginBottom: 4, textAlign: 'center', fontWeight: '600' },
  compareImage: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 12, fontSize: 16, color: colors.dark, backgroundColor: colors.white },
  storePicker: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 16, backgroundColor: colors.white },
  storePickerText: { fontSize: 16, color: colors.muted },
  inlineStoreCreate: { backgroundColor: colors.goldLight, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.goldMid },
  inlineStoreLabel: { fontSize: 13, fontWeight: '700', color: colors.goldDark, marginBottom: 10 },
  inlineStoreRow: { flexDirection: 'row', gap: 8 },
  inlineStoreInput: { flex: 1, backgroundColor: colors.white, borderRadius: 10, padding: 12, fontSize: 15, color: colors.dark, borderWidth: 1, borderColor: colors.border },
  inlineStoreBtn: { backgroundColor: colors.dark, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  inlineStoreBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  inlineStoreSuccess: { color: colors.goldDark, fontSize: 13, fontWeight: '600', marginTop: 8 },
  modal: { flex: 1, padding: 32, paddingTop: 60, backgroundColor: colors.cream },
  modalTitle: { fontSize: 26, fontWeight: '900', marginBottom: 24, color: colors.dark },
  storeOption: { padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  storeOptionText: { fontSize: 16, fontWeight: '600', color: colors.dark },
  successContainer: { justifyContent: 'center' },
  successContent: { padding: 24, paddingTop: 60, alignItems: 'center' },
  successCard: { 
    backgroundColor: colors.white, 
    borderRadius: 24, 
    padding: 24, 
    width: '100%', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  successImage: { width: '100%', aspectRatio: 1, borderRadius: 16, marginBottom: 24 },
  successTitle: { fontSize: 28, fontWeight: '900', color: colors.dark, marginBottom: 8, letterSpacing: -1 },
  successSubtitle: { fontSize: 16, color: colors.mid, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  whatsappBtn: { 
    backgroundColor: colors.gold, 
    borderRadius: 100, 
    paddingVertical: 18, 
    paddingHorizontal: 32, 
    width: '100%', 
    alignItems: 'center',
    marginBottom: 12,
  },
  whatsappBtnText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  instagramBtn: {
    backgroundColor: colors.white,
    borderRadius: 100,
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  instagramBtnText: { color: colors.dark, fontSize: 16, fontWeight: '800' },
  nativeShareBtn: { 
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  nativeShareBtnText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  startOverBtn: { marginTop: 40 },
  startOverBtnText: { color: colors.goldDark, fontSize: 16, fontWeight: '700' },
})
