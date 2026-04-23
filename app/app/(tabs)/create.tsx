import { useState } from 'react'
import {
  View, Text, TouchableOpacity, Image, StyleSheet, Alert,
  TextInput, ScrollView, ActivityIndicator, Modal, FlatList, Platform
} from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../hooks/useAuthStore'
import { transformArtwork, OutOfCreditsError } from '../../lib/transformArtwork'
import { useCredits } from '../../lib/useCredits'
import { colors, btn, type } from '../../lib/theme'
import { shareToWhatsApp, shareNative, buildPieceShareMessage, SharePayload } from '../../lib/share'
import CreditsChip from '../../components/CreditsChip'

const isWeb = Platform.OS === 'web'

const PRICE_DIGITAL_CENTS = 500
const PRICE_PRINT_CENTS = 3000

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
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [transformedUri, setTransformedUri] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [storePickerVisible, setStorePickerVisible] = useState(false)
  const [step, setStep] = useState<'pick' | 'transform' | 'publish' | 'success'>('pick')
  const [transforming, setTransforming] = useState(false)
  const [transformError, setTransformError] = useState<string | null>(null)
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
    setImageBase64(null)
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
      base64: true,
    })
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri)
      setImageBase64(result.assets[0].base64 ?? null)
      setTransformedUri(null)
      setStep('transform')
    }
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required.'); return }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true })
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri)
      setImageBase64(result.assets[0].base64 ?? null)
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
      const { transformedUrl, description } = await transformArtwork(imageUri, compressed.base64 ?? undefined)
      // Credits will be updated via Realtime listener
      const localPath = FileSystem.documentDirectory + `transformed_${Date.now()}.jpg`
      const dlController = new AbortController()
      const dlTimeout = setTimeout(() => dlController.abort(), 30_000)
      let arrayBuffer: ArrayBuffer
      try {
        const imgRes = await fetch(transformedUrl, { signal: dlController.signal })
        if (!imgRes.ok) throw new Error(`Could not download your artwork (HTTP ${imgRes.status}). Please try again.`)
        arrayBuffer = await imgRes.arrayBuffer()
        clearTimeout(dlTimeout)
      } catch (fetchErr: any) {
        clearTimeout(dlTimeout)
        throw fetchErr.name === 'AbortError'
          ? new Error('Downloading your artwork timed out. Please try again.')
          : fetchErr
      }
      const bytes = new Uint8Array(arrayBuffer)
      let binary = ''
      const chunkSize = 8192
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.slice(i, i + chunkSize))
      }
      await FileSystem.writeAsStringAsync(localPath, btoa(binary), { encoding: FileSystem.EncodingType.Base64 })
      setTransformedUri(localPath)
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
      if (!selectedStore || !imageUri || !transformedUri || !title) throw new Error('Missing required fields')

      const ext = imageUri.split('.').pop()?.split('?')[0] ?? 'jpg'
      const fileName = `${session!.user.id}/${Date.now()}_original.${ext}`
      const originalBase64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' })
      const originalBytes = Uint8Array.from(atob(originalBase64), (c) => c.charCodeAt(0))
      const { error: uploadError } = await withUploadTimeout(
        supabase.storage.from('artwork').upload(fileName, originalBytes, { contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}` })
      )
      if (uploadError) throw uploadError
      const { data: { publicUrl: originalUrl } } = supabase.storage.from('artwork').getPublicUrl(fileName)

      const transformedFileName = `${session!.user.id}/${Date.now()}_transformed.jpg`
      const transformedBase64 = await FileSystem.readAsStringAsync(transformedUri, { encoding: 'base64' })
      const transformedBytes = Uint8Array.from(atob(transformedBase64), (c) => c.charCodeAt(0))
      const { error: transformedUploadError } = await withUploadTimeout(
        supabase.storage.from('artwork').upload(transformedFileName, transformedBytes, { contentType: 'image/jpeg' })
      )
      if (transformedUploadError) throw transformedUploadError
      const { data: { publicUrl: transformedStoredUrl } } = supabase.storage.from('artwork').getPublicUrl(transformedFileName)

      // Generate watermarked (low-res preview) version
      const watermarked = await ImageManipulator.manipulateAsync(
        transformedUri,
        [{ resize: { width: 800 } }],
        { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      )
      const watermarkedFileName = `${session!.user.id}/${Date.now()}_preview.jpg`
      const watermarkedBytes = Uint8Array.from(atob(watermarked.base64!), (c) => c.charCodeAt(0))
      const { error: watermarkedUploadError } = await withUploadTimeout(
        supabase.storage.from('artwork').upload(watermarkedFileName, watermarkedBytes, { contentType: 'image/jpeg' })
      )
      if (watermarkedUploadError) throw watermarkedUploadError
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
        <ScrollView contentContainerStyle={styles.successContent}>
          <View style={styles.successCard}>
            <Image source={{ uri: transformedUri! }} style={styles.successImage} />
            <Text style={styles.successTitle}>Published!</Text>
            <Text style={styles.successSubtitle}>"{title}" is now live in {selectedStore?.child_name}'s store.</Text>
            
            <TouchableOpacity 
              style={styles.whatsappBtn} 
              onPress={() => shareToWhatsApp(`${sharePayload.message}\n${sharePayload.url}`)}
            >
              <Text style={styles.whatsappBtnText}>Share to Family WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.nativeShareBtn} 
              onPress={() => shareNative(sharePayload)}
            >
              <Text style={styles.nativeShareBtnText}>Other Sharing Options</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.startOverBtn} onPress={resetCreate}>
            <Text style={styles.startOverBtnText}>Step inside another drawing →</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Create</Text>
        <CreditsChip />
      </View>

      {step === 'pick' && (
        <View style={styles.pickArea}>
          <Text style={styles.prompt}>Photograph your child's artwork</Text>
          <TouchableOpacity style={styles.bigBtn} onPress={takePhoto}>
            <Text style={styles.bigBtnIcon}>📷</Text>
            <Text style={styles.bigBtnText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.bigBtn, styles.bigBtnSecondary]} onPress={pickImage}>
            <Text style={styles.bigBtnIcon}>🖼️</Text>
            <Text style={[styles.bigBtnText, { color: colors.dark }]}>Choose from Library</Text>
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
              <TouchableOpacity style={styles.upsellBtn} onPress={() => router.push('/credits')}>
                <Text style={styles.upsellBtnText}>Buy Credits</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.prompt}>Ready to step inside this drawing?</Text>
              {isWeb
                ? <View style={styles.webNotice}><Text style={styles.webNoticeText}>📱 AI transformation works on the mobile app.</Text></View>
                : transforming
                  ? <View style={styles.center}>
                      <ActivityIndicator size="large" color={colors.gold} />
                      <Text style={styles.transformingText}>Stepping inside the drawing… (~30 sec)</Text>
                    </View>
                  : transformError
                    ? <View style={styles.errorBox}>
                        <Text style={styles.errorTitle}>Transform failed</Text>
                        <Text style={styles.errorMessage}>{transformError}</Text>
                        <TouchableOpacity style={styles.button} onPress={handleTransform}>
                          <Text style={styles.buttonText}>Try again</Text>
                        </TouchableOpacity>
                      </View>
                    : <TouchableOpacity style={styles.button} onPress={handleTransform}>
                        <Text style={styles.buttonText}>✨ Step Inside</Text>
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
              <Text style={styles.compareLabel}>The Drawing</Text>
              <Image source={{ uri: imageUri! }} style={styles.compareImage} />
            </View>
            <View style={styles.compareItem}>
              <Text style={styles.compareLabel}>The World</Text>
              <Image source={{ uri: transformedUri }} style={styles.compareImage} />
            </View>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Give this piece a title"
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
          />

          {/* Store selector or inline creator */}
          {hasStores ? (
            <TouchableOpacity style={styles.storePicker} onPress={() => setStorePickerVisible(true)}>
              <Text style={[styles.storePickerText, selectedStore && { color: colors.dark }]}>
                {selectedStore ? `${selectedStore.child_name}'s Store ✓` : 'Select a store →'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.inlineStoreCreate}>
              <Text style={styles.inlineStoreLabel}>No stores yet — create one to publish</Text>
              <View style={styles.inlineStoreRow}>
                <TextInput
                  style={styles.inlineStoreInput}
                  placeholder="Child's name (e.g. Emma)"
                  placeholderTextColor={colors.muted}
                  value={newStoreName}
                  onChangeText={setNewStoreName}
                />
                <TouchableOpacity
                  style={[styles.inlineStoreBtn, (!newStoreName.trim() || creatingStore) && styles.buttonDisabled]}
                  onPress={handleCreateStoreInline}
                  disabled={!newStoreName.trim() || creatingStore}
                >
                  {creatingStore
                    ? <ActivityIndicator size="small" color={colors.white} />
                    : <Text style={styles.inlineStoreBtnText}>Create</Text>}
                </TouchableOpacity>
              </View>
              {selectedStore && (
                <Text style={styles.inlineStoreSuccess}>✓ {selectedStore.child_name}'s Store created</Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, (!title || !selectedStore) && styles.buttonDisabled]}
            onPress={() => publishMutation.mutate()}
            disabled={!title || !selectedStore || publishMutation.isPending}
          >
            <Text style={styles.buttonText}>{publishMutation.isPending ? 'Publishing...' : 'Publish to Store'}</Text>
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
  transformingText: { color: colors.mid, fontSize: 14 },
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
  nativeShareBtn: { 
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  nativeShareBtnText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  startOverBtn: { marginTop: 40 },
  startOverBtnText: { color: colors.goldDark, fontSize: 16, fontWeight: '700' },
})
