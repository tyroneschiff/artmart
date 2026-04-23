import { useState } from 'react'
import {
  View, Text, TouchableOpacity, Image, StyleSheet, Alert,
  TextInput, ScrollView, ActivityIndicator, Modal, FlatList, Platform
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../hooks/useAuthStore'
import { transformArtwork, OutOfCreditsError } from '../../lib/transformArtwork'
import { useCredits } from '../../lib/useCredits'
import { colors } from '../../lib/theme'
import ShareSheet from '../../components/ShareSheet'
import { buildPieceShareMessage, SharePayload } from '../../lib/share'

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
  const { data: credits } = useCredits()

  const [imageUri, setImageUri] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [transformedUri, setTransformedUri] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [storePickerVisible, setStorePickerVisible] = useState(false)
  const [step, setStep] = useState<'pick' | 'transform' | 'publish'>('pick')
  const [transforming, setTransforming] = useState(false)
  const [transformError, setTransformError] = useState<string | null>(null)
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
      queryClient.invalidateQueries({ queryKey: ['credits'] })
      // Fetch and write locally — fal.ai URLs expire quickly, downloadAsync unreliable on iOS CDN redirects
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
        Alert.alert(
          'Out of credits',
          'You\'re out of credits. Buy a pack to keep bringing your child\'s imagination to life.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Buy Credits', onPress: () => router.push('/credits') },
          ]
        )
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

      const { data: pieceRow, error } = await supabase.from('pieces').insert({
        store_id: selectedStore.id,
        title: title.trim(),
        original_image_url: originalUrl,
        transformed_image_url: transformedStoredUrl,
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
      setTimeout(() => setSharePayload(buildPieceShareMessage(pieceTitle, childName, pieceId)), 400)
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  })

  const hasStores = stores && stores.length > 0

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Create</Text>
        {typeof credits === 'number' && (
          <View style={styles.creditsChip}>
            <Text style={styles.creditsChipText}>✨ {credits} {credits === 1 ? 'credit' : 'credits'}</Text>
          </View>
        )}
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
          <TouchableOpacity onPress={() => { setStep('pick'); setTransformError(null) }}><Text style={styles.cancel}>← Start over</Text></TouchableOpacity>
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

      <ShareSheet
        visible={!!sharePayload}
        payload={sharePayload}
        onClose={resetCreate}
      />

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
  creditsChip: { backgroundColor: colors.dark, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  creditsChipText: { color: colors.cream, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
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
})
