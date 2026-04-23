import { useState } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, TextInput } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../hooks/useAuthStore'
import { purchasePiece } from '../../lib/checkout'
import { downloadPiece } from '../../lib/download'
import ShippingAddressModal, { ShippingAddress } from '../../components/ShippingAddressModal'
import ShareSheet from '../../components/ShareSheet'
import { buildPieceShareMessage, SharePayload } from '../../lib/share'
import { colors } from '../../lib/theme'
import GuestPrintInfoModal from '../../components/GuestPrintInfoModal'

type Piece = {
  id: string; title: string; transformed_image_url: string; original_image_url: string
  vote_count: number; price_digital: number; price_print: number; ai_description: string
  stores: { child_name: string; slug: string; owner_id: string }
}

type Comment = {
  id: string
  content: string
  created_at: string
  user_id: string
  profiles: { display_name: string }
}

async function fetchPiece(id: string): Promise<Piece> {
  const { data, error } = await supabase
    .from('pieces')
    .select('*, stores(child_name, slug, owner_id)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Piece
}

async function fetchComments(pieceId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*, profiles(display_name)')
    .eq('piece_id', pieceId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as Comment[]
}

async function fetchMyDigitalOrder(pieceId: string, userId: string) {
  const { data } = await supabase
    .from('orders')
    .select('id')
    .eq('piece_id', pieceId)
    .eq('buyer_id', userId)
    .eq('order_type', 'digital')
    .eq('status', 'paid')
    .maybeSingle()
  return data
}

export default function PieceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const session = useAuthStore((s) => s.session)
  const queryClient = useQueryClient()
    const [purchasing, setPurchasing] = useState<'digital' | 'print' | null>(null)
    const [downloading, setDownloading] = useState(false)
    const [shippingModalVisible, setShippingModalVisible] = useState(false)
    const [guestPrintInfoModalVisible, setGuestPrintInfoModalVisible] = useState(false) // New state for guest print modal
    const [guestEmail, setGuestEmail] = useState('') // New state for guest email
    const [giftMessage, setGiftMessage] = useState('') // New state for gift message
    const [sharePayload, setSharePayload] = useState<SharePayload | null>(null)
    const [commentText, setCommentText] = useState('')
  
    const { data: piece, isLoading, error, refetch } = useQuery({ queryKey: ['piece', id], queryFn: () => fetchPiece(id) })
  
    const isOwner = !!session && !!piece && session.user.id === piece.stores?.owner_id

    const { data: comments } = useQuery({ queryKey: ['comments', id], queryFn: () => fetchComments(id) })
  
    const { data: myDigitalOrder } = useQuery({
      queryKey: ['orders', id, session?.user.id, 'digital'],
      queryFn: () => fetchMyDigitalOrder(id, session!.user.id),
      enabled: !!session,
    })
  
    const voteMutation = useMutation({
      mutationFn: async () => {
        const { error } = await supabase.from('votes').insert({ user_id: session!.user.id, piece_id: id })
        if (error) throw error
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['piece', id] })
        queryClient.invalidateQueries({ queryKey: ['discover'] })
      },
      onError: () => Alert.alert('Already voted', 'You already voted for this piece.'),
    })
  
    const commentMutation = useMutation({
      mutationFn: async (content: string) => {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/moderate-comment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentSession!.access_token}`,
          },
          body: JSON.stringify({ piece_id: id, content }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to post comment')
        }
        return res.json()
      },
      onSuccess: () => {
        setCommentText('')
        queryClient.invalidateQueries({ queryKey: ['comments', id] })
      },
      onError: (e: any) => Alert.alert('Error', e.message),
    })
  
    const reportMutation = useMutation({
      mutationFn: async (commentId: string) => {
        const { error } = await supabase.from('reports').insert({
          comment_id: commentId,
          reporter_id: session!.user.id,
          reason: 'Flagged by user',
        })
        if (error) throw error
      },
      onSuccess: () => Alert.alert('Reported', 'Thank you for keeping our community safe. We will review this comment.'),
      onError: (e: any) => Alert.alert('Error', e.message),
    })
  
    async function executePurchase(orderType: 'digital' | 'print', shippingAddress?: ShippingAddress, guestEmail?: string, giftMessage?: string) {
      // Session check is now more nuanced, handled in handlePurchase
      setPurchasing(orderType)
      try {
        const userToken = session?.access_token || undefined // Pass token if session exists, else undefined
        await purchasePiece(id, orderType, userToken, shippingAddress, guestEmail, giftMessage)
        if (orderType === 'digital') {
          Alert.alert('Purchase complete!', 'Your file is ready to download.', [
            { text: 'Download now', onPress: () => downloadPiece(id) },
            { text: 'Later' },
          ])
        } else {
          Alert.alert('Order placed!', 'Your print is being prepared and will ship soon!')
        }
        queryClient.invalidateQueries({ queryKey: ['orders'] })
      } catch (e: any) {
        if (e.message !== 'Canceled') Alert.alert('Payment failed', e.message)
      } finally {
        setPurchasing(null)
      }
    }
  
    async function handleRedownload() {
      setDownloading(true)
      try {
        await downloadPiece(id)
      } catch {
        Alert.alert('Download failed', 'Please try again.')
      } finally {
        setDownloading(false)
      }
    }
  
    function handlePurchase(orderType: 'digital' | 'print') {
      if (orderType === 'digital') {
        if (!session) {
          router.push({ pathname: '/(auth)/login', params: { returnTo: `/piece/${id}` } })
          return
        }
        executePurchase('digital')
      } else { // orderType === 'print'
        if (!session) {
          setGuestPrintInfoModalVisible(true) // Open guest print info modal for unauthenticated users
        } else {
          setShippingModalVisible(true) // Open shipping address modal for authenticated users
        }
      }
    }
  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.gold} /></View>
  
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load world</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!piece) return <View style={styles.center}><Text style={styles.errorText}>Not found.</Text></View>

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push(`/store/${piece.stores?.slug}`)}>
            <Text style={styles.storeLink}>{piece.stores?.child_name}'s Store</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn} onPress={() =>
            setSharePayload(buildPieceShareMessage(piece.title, piece.stores?.child_name ?? 'Artist', piece.id))
          }>
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        <Image source={{ uri: piece.transformed_image_url }} style={styles.mainImage} />
        <View style={styles.magicLabel}>
          <Text style={styles.magicLabelText}>✨ Step inside {piece.stores?.child_name}'s imagination</Text>
        </View>

        <Text style={styles.title}>{piece.title}</Text>
        {piece.ai_description ? <Text style={styles.description}>{piece.ai_description}</Text> : null}

        <TouchableOpacity
          style={styles.voteBtn}
          onPress={() => {
            if (!session) {
              router.push({ pathname: '/(auth)/login', params: { returnTo: `/piece/${id}` } })
            } else {
              voteMutation.mutate()
            }
          }}
          disabled={voteMutation.isPending}
        >
          <Text style={styles.voteBtnText}>♥ {piece.vote_count} {piece.vote_count === 1 ? 'vote' : 'votes'}</Text>
        </TouchableOpacity>

        <View style={styles.purchaseSection}>
          <Text style={styles.purchaseTitle}>Bring this world home</Text>

          {(isOwner || myDigitalOrder) && (
            <TouchableOpacity
              style={styles.purchaseCard}
              onPress={handleRedownload}
              disabled={downloading || purchasing !== null}
            >
              <View>
                <Text style={styles.purchaseType}>Keep the high-res vision</Text>
                <Text style={styles.purchaseDetail}>
                  {isOwner ? "Free for you as the creator" : "You own this · Download again"}
                </Text>
              </View>
              {downloading
                ? <ActivityIndicator color={colors.gold} />
                : <Text style={styles.redownloadLabel}>{isOwner ? 'Download' : 'Re-download'}</Text>}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.purchaseCard}
            onPress={() => handlePurchase('print')}
            disabled={purchasing !== null}
          >
            <View>
              <Text style={styles.purchaseType}>Physical Print</Text>
              <Text style={styles.purchaseDetail}>11×14" matte poster, shipped to you</Text>
            </View>
            {purchasing === 'print'
              ? <ActivityIndicator color={colors.gold} />
              : <Text style={styles.purchasePrice}>${(piece.price_print / 100).toFixed(2)}</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.commentSection}>
          <Text style={styles.sectionTitle}>Comments</Text>
          
          {session ? (
            <View style={styles.commentInputWrap}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a kind comment..."
                placeholderTextColor={colors.muted}
                value={commentText}
                onChangeText={setCommentText}
                maxLength={300}
                multiline
              />
              <TouchableOpacity 
                style={[styles.postBtn, (!commentText.trim() || commentMutation.isPending) && styles.postBtnDisabled]}
                onPress={() => commentMutation.mutate(commentText.trim())}
                disabled={!commentText.trim() || commentMutation.isPending}
              >
                {commentMutation.isPending ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.postBtnText}>Post</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.loginToComment} onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: `/piece/${id}` } })}>
              <Text style={styles.loginToCommentText}>Sign in to add a comment</Text>
            </TouchableOpacity>
          )}

          <View style={styles.commentsList}>
            {comments?.map((c) => (
              <View key={c.id} style={styles.commentCard}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentAuthor}>{c.profiles?.display_name || 'Anonymous'}</Text>
                  <Text style={styles.commentDate}>{new Date(c.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.commentContent}>{c.content}</Text>
                <TouchableOpacity onPress={() => {
                  if (!session) {
                    router.push({ pathname: '/(auth)/login', params: { returnTo: `/piece/${id}` } })
                  } else {
                    Alert.alert('Report comment', 'Are you sure you want to report this comment?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Report', style: 'destructive', onPress: () => reportMutation.mutate(c.id) }
                    ])
                  }
                }}>
                  <Text style={styles.reportLabel}>Report</Text>
                </TouchableOpacity>
              </View>
            ))}
            {comments?.length === 0 && <Text style={styles.noComments}>No comments yet. Be the first to say something kind!</Text>}
          </View>
        </View>

        <Text style={styles.originalLabel}>The drawing</Text>
        <Image source={{ uri: piece.original_image_url }} style={styles.originalImage} />
      </ScrollView>

      <ShippingAddressModal
        visible={shippingModalVisible}
        onConfirm={(addr) => {
          setShippingModalVisible(false)
          executePurchase('print', addr, guestEmail, giftMessage) // Pass guestEmail and giftMessage
          setGuestEmail('') // Clear guest email
          setGiftMessage('') // Clear gift message
        }}
        onCancel={() => setShippingModalVisible(false)}
      />
      <GuestPrintInfoModal
        visible={guestPrintInfoModalVisible}
        onConfirm={(email, message) => {
          setGuestEmail(email)
          setGiftMessage(message)
          setGuestPrintInfoModalVisible(false)
          setShippingModalVisible(true) // Now open shipping address modal
        }}
        onCancel={() => setGuestPrintInfoModalVisible(false)}
      />
      <ShareSheet
        visible={!!sharePayload}
        payload={sharePayload}
        onClose={() => setSharePayload(null)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.cream },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  back: { fontSize: 22, color: colors.dark, lineHeight: 26 },
  storeLink: { color: colors.gold, fontWeight: '700', fontSize: 14 },
  shareBtn: { backgroundColor: colors.dark, borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7 },
  shareBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  mainImage: { width: '100%', aspectRatio: 1 },
  magicLabel: { paddingHorizontal: 16, paddingTop: 12 },
  magicLabelText: { fontSize: 13, fontWeight: '700', color: colors.gold, fontStyle: 'italic' },
  title: { fontSize: 26, fontWeight: '800', color: colors.dark, padding: 16, paddingBottom: 8, letterSpacing: -0.5 },
  description: { fontSize: 14, color: colors.mid, paddingHorizontal: 16, paddingBottom: 8, lineHeight: 20 },
  voteBtn: { marginHorizontal: 16, marginBottom: 24, backgroundColor: colors.goldLight, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.goldMid },
  voteBtnText: { color: colors.goldDark, fontWeight: '700', fontSize: 16 },
  purchaseSection: { paddingHorizontal: 16, marginBottom: 32 },
  purchaseTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, color: colors.dark },
  purchaseCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.white, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  purchaseType: { fontSize: 15, fontWeight: '700', color: colors.dark },
  purchaseDetail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  purchasePrice: { fontSize: 18, fontWeight: '800', color: colors.gold },
  redownloadLabel: { fontSize: 14, fontWeight: '700', color: colors.gold },
  originalLabel: { fontSize: 13, color: colors.muted, paddingHorizontal: 16, marginBottom: 8 },
  originalImage: { width: '100%', aspectRatio: 1, opacity: 0.7 },
  commentSection: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.dark, marginBottom: 16 },
  commentInputWrap: { marginBottom: 24 },
  commentInput: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 15, color: colors.dark, minHeight: 80, textAlignVertical: 'top' },
  postBtn: { backgroundColor: colors.dark, borderRadius: 100, paddingVertical: 10, paddingHorizontal: 20, alignSelf: 'flex-end', marginTop: 8 },
  postBtnDisabled: { opacity: 0.5 },
  postBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  loginToComment: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 24 },
  loginToCommentText: { color: colors.gold, fontWeight: '700', fontSize: 15 },
  commentsList: { gap: 16 },
  commentCard: { backgroundColor: colors.white, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  commentAuthor: { fontWeight: '700', color: colors.dark, fontSize: 14 },
  commentDate: { color: colors.muted, fontSize: 12 },
  commentContent: { color: colors.mid, fontSize: 14, lineHeight: 20 },
  reportBtn: { alignSelf: 'flex-end', marginTop: 8 },
  reportLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  noComments: { textAlign: 'center', color: colors.muted, fontSize: 14, paddingVertical: 20 },
  errorText: { color: colors.mid, marginBottom: 16, fontSize: 15 },
  retryBtn: { backgroundColor: colors.dark, borderRadius: 100, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
})
