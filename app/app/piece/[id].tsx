import { useState, useEffect, useRef } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, TextInput } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../hooks/useAuthStore'
import { purchasePiece } from '../../lib/checkout'
import { downloadPiece } from '../../lib/download'
import GiftingModal, { GiftingData } from '../../components/GiftingModal'
import ShareSheet from '../../components/ShareSheet'
import RoomPreviewModal from '../../components/RoomPreviewModal'
import { buildPieceShareMessage, SharePayload } from '../../lib/share'
import { colors, type, btn, card } from '../../lib/theme'

type Piece = {
  id: string; title: string; transformed_image_url: string; watermarked_image_url?: string; original_image_url: string
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
  const { id, vote } = useLocalSearchParams<{ id: string; vote?: string }>()
  const session = useAuthStore((s) => s.session)
  const queryClient = useQueryClient()
  const autoVoteFired = useRef(false)
    const [purchasing, setPurchasing] = useState<'digital' | 'print' | null>(null)
    const [downloading, setDownloading] = useState(false)
    const [giftingModalVisible, setGiftingModalVisible] = useState(false)
    const [roomModalVisible, setRoomModalVisible] = useState(false)
    const [modalOrderType, setModalOrderType] = useState<'digital' | 'print'>('print')
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

    const showHighRes = isOwner || !!myDigitalOrder
    const displayImageUrl = piece ? (showHighRes ? piece.transformed_image_url : (piece.watermarked_image_url || piece.transformed_image_url)) : null
  
    const withTimeout = <T,>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> => {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), ms)
      )
      return Promise.race([promise, timeout])
    }

    const voteMutation = useMutation({
      mutationFn: async () => {
        const promise = supabase.from('votes').insert({ user_id: session!.user.id, piece_id: id })
        const { error } = await withTimeout(promise, 15000, 'Request timed out. Please check your connection.')
        if (error) throw error
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['piece', id] })
        queryClient.invalidateQueries({ queryKey: ['discover'] })
      },
      onError: (e: any) => Alert.alert('Vote failed', e.message === 'Request timed out. Please check your connection.' ? e.message : 'You already voted for this piece.'),
    })

    useEffect(() => {
      if (vote === '1' && session && !autoVoteFired.current && !voteMutation.isPending) {
        autoVoteFired.current = true
        voteMutation.mutate()
      }
    }, [vote, session])

    const commentMutation = useMutation({
      mutationFn: async (content: string) => {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        const promise = fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/moderate-comment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentSession!.access_token}`,
          },
          body: JSON.stringify({ piece_id: id, content }),
        })
        const res = await withTimeout(promise, 15000, 'Request timed out. Please check your connection.')
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
  
    async function executePurchase(orderType: 'digital' | 'print', giftingData?: GiftingData) {
      // Session check is now more nuanced, handled in handlePurchase
      setPurchasing(orderType)
      try {
        const userToken = session?.access_token || undefined // Pass token if session exists, else undefined
        await purchasePiece(
          id, 
          orderType, 
          userToken, 
          giftingData?.shippingAddress, 
          giftingData?.guestEmail, 
          giftingData?.recipientEmail, 
          giftingData?.giftMessage,
          giftingData?.quantity
        )
        if (orderType === 'digital') {
          Alert.alert('Purchase complete!', 'Your file is ready to download.', [
            { text: 'Download now', onPress: () => downloadPiece(id) },
            { text: 'Later' },
          ])
        } else {
          Alert.alert('Order placed!', 'Your print is being prepared and will ship soon!')
        }
        queryClient.invalidateQueries({ queryKey: ['orders'] })
        queryClient.invalidateQueries({ queryKey: ['paidOrderCount'] })
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
      setModalOrderType(orderType)
      setGiftingModalVisible(true)
    }
  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.gold} /></View>
  
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={type.body}>Failed to load world</Text>
        <TouchableOpacity style={[btn.primary, { marginTop: 16, paddingHorizontal: 24 }]} onPress={() => refetch()}>
          <Text style={btn.primaryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!piece) return <View style={styles.center}><Text style={type.body}>Not found.</Text></View>

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
          <TouchableOpacity style={[btn.primary, { paddingVertical: 8, paddingHorizontal: 16 }]} onPress={() =>
            setSharePayload(buildPieceShareMessage(piece.title, piece.stores?.child_name ?? 'Artist', piece.id))
          }>
            <Text style={[btn.primaryText, { fontSize: 13 }]}>Share</Text>
          </TouchableOpacity>
        </View>

        <Image source={{ uri: displayImageUrl || '' }} style={styles.mainImage} />
        
        <View style={styles.actionRow}>
          <View style={styles.magicLabel}>
            <Text style={[type.label, { color: colors.gold, fontStyle: 'italic', fontSize: 13 }]}>
              ✨ Step inside {piece.stores?.child_name}'s imagination
            </Text>
          </View>
          <TouchableOpacity style={styles.viewInRoomBtn} onPress={() => setRoomModalVisible(true)}>
            <Text style={styles.viewInRoomBtnText}>🖼 View in Room</Text>
          </TouchableOpacity>
        </View>

        <Text style={[type.h2, { fontSize: 26, padding: 16, paddingBottom: 8 }]}>{piece.title}</Text>
        {piece.ai_description ? <Text style={[type.body, { fontSize: 14, paddingHorizontal: 16, paddingBottom: 8, lineHeight: 20 }]}>{piece.ai_description}</Text> : null}

        <TouchableOpacity
          style={styles.voteBtn}
          onPress={() => {
            if (!session) {
              router.push({ pathname: '/(auth)/login', params: { returnTo: `/piece/${id}`, vote: '1' } })
            } else {
              voteMutation.mutate()
            }
          }}
          disabled={voteMutation.isPending}
        >
          <Text style={styles.voteBtnText}>♥ {piece.vote_count} {piece.vote_count === 1 ? 'vote' : 'votes'}</Text>
        </TouchableOpacity>

        <View style={styles.purchaseSection}>
          <Text style={[type.h3, { marginBottom: 12 }]}>
            {myDigitalOrder ? "Upgrade to Physical Print" : "Bring this world home"}
          </Text>

          {(isOwner || myDigitalOrder) && (
            <TouchableOpacity
              style={[card, styles.purchaseCard]}
              onPress={handleRedownload}
              disabled={downloading || purchasing !== null}
            >
              <View>
                <Text style={styles.purchaseType}>Keep the high-res vision</Text>
                <Text style={[type.label, { marginTop: 2, fontSize: 12 }]}>
                  {isOwner ? "Free for you as the creator" : "You own this · Download again"}
                </Text>
              </View>
              {downloading
                ? <ActivityIndicator color={colors.gold} />
                : <Text style={styles.redownloadLabel}>{isOwner ? 'Download' : 'Re-download'}</Text>}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[card, styles.purchaseCard]}
            onPress={() => handlePurchase('print')}
            disabled={purchasing !== null}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.purchaseType}>Physical Print</Text>
                {myDigitalOrder && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>10% OFF</Text>
                  </View>
                )}
              </View>
              <Text style={[type.label, { marginTop: 2, fontSize: 12 }]}>11×14" matte poster, shipped to you</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {purchasing === 'print' ? (
                <ActivityIndicator color={colors.gold} />
              ) : (
                <>
                  <Text style={styles.purchasePrice}>
                    ${((myDigitalOrder ? piece.price_print * 0.9 : piece.price_print) / 100).toFixed(2)}
                  </Text>
                  {myDigitalOrder && (
                    <Text style={[type.label, { fontSize: 10, textDecorationLine: 'line-through' }]}>
                      ${(piece.price_print / 100).toFixed(2)}
                    </Text>
                  )}
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.commentSection}>
          <Text style={[type.h3, { marginBottom: 16 }]}>Comments</Text>
          
          {session ? (
            <View style={styles.commentInputWrap}>
              <TextInput
                style={[card, styles.commentInput]}
                placeholder="Add a kind comment..."
                placeholderTextColor={colors.muted}
                value={commentText}
                onChangeText={setCommentText}
                maxLength={300}
                multiline
              />
              <TouchableOpacity 
                style={[btn.primary, styles.postBtn, (!commentText.trim() || commentMutation.isPending) && styles.postBtnDisabled]}
                onPress={() => commentMutation.mutate(commentText.trim())}
                disabled={!commentText.trim() || commentMutation.isPending}
              >
                {commentMutation.isPending ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={[btn.primaryText, { fontSize: 14 }]}>Post</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[card, { padding: 16, alignItems: 'center', marginBottom: 24 }]} 
              onPress={() => router.push({ pathname: '/(auth)/login', params: { returnTo: `/piece/${id}` } })}
            >
              <Text style={{ color: colors.gold, fontWeight: '700', fontSize: 15 }}>Sign in to add a comment</Text>
            </TouchableOpacity>
          )}

          <View style={styles.commentsList}>
            {comments?.map((c) => (
              <View key={c.id} style={[card, { padding: 12 }]}>
                <View style={styles.commentHeader}>
                  <Text style={styles.commentAuthor}>{c.profiles?.display_name || 'Anonymous'}</Text>
                  <Text style={[type.label, { fontSize: 12 }]}>{new Date(c.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={[type.body, { fontSize: 14, lineHeight: 20 }]}>{c.content}</Text>
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
                  <Text style={[type.label, { fontSize: 11, textTransform: 'uppercase' }]}>Report</Text>
                </TouchableOpacity>
              </View>
            ))}
            {comments?.length === 0 && <Text style={[type.body, { textAlign: 'center', fontSize: 14, paddingVertical: 20 }]}>No comments yet. Be the first to say something kind!</Text>}
          </View>
        </View>

        <Text style={[type.label, { paddingHorizontal: 16, marginBottom: 8, fontSize: 13 }]}>The drawing</Text>
        <Image source={{ uri: piece.original_image_url }} style={styles.originalImage} />
      </ScrollView>

      <GiftingModal
        visible={giftingModalVisible}
        isGuest={!session}
        orderType={modalOrderType}
        onConfirm={(data) => {
          setGiftingModalVisible(false)
          executePurchase(modalOrderType, data)
        }}
        onCancel={() => setGiftingModalVisible(false)}
      />
      <RoomPreviewModal
        visible={roomModalVisible}
        imageUrl={piece.transformed_image_url}
        onClose={() => setRoomModalVisible(false)}
      />
      <ShareSheet
        visible={!!sharePayload}
        payload={sharePayload}
        imageUri={piece.transformed_image_url}
        childName={piece.stores?.child_name}
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
  mainImage: { width: '100%', aspectRatio: 1 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 16 },
  magicLabel: { paddingHorizontal: 16, paddingTop: 12, flex: 1 },
  viewInRoomBtn: { 
    marginTop: 12,
    backgroundColor: colors.white, 
    borderRadius: 8, 
    paddingVertical: 6, 
    paddingHorizontal: 10, 
    borderWidth: 1, 
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  viewInRoomBtnText: { color: colors.mid, fontWeight: '700', fontSize: 12 },
voteBtn: { marginHorizontal: 16, marginBottom: 24, backgroundColor: colors.goldLight, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.goldMid },
  voteBtnText: { color: colors.goldDark, fontWeight: '700', fontSize: 16 },
  purchaseSection: { paddingHorizontal: 16, marginBottom: 32 },
  purchaseCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, marginBottom: 8 },
  purchaseType: { fontSize: 15, fontWeight: '700', color: colors.dark },
  purchasePrice: { fontSize: 18, fontWeight: '800', color: colors.gold },
  discountBadge: { backgroundColor: colors.gold, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  discountBadgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  redownloadLabel: { fontSize: 14, fontWeight: '700', color: colors.gold },
  originalImage: { width: '100%', aspectRatio: 1, opacity: 0.7 },
  commentSection: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 16 },
  commentInputWrap: { marginBottom: 24 },
  commentInput: { padding: 12, fontSize: 15, color: colors.dark, minHeight: 80, textAlignVertical: 'top' },
  postBtn: { paddingVertical: 10, paddingHorizontal: 20, alignSelf: 'flex-end', marginTop: 8 },
  postBtnDisabled: { opacity: 0.5 },
  commentsList: { gap: 16 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  commentAuthor: { fontWeight: '700', color: colors.dark, fontSize: 14 },
  reportLabel: { ...type.label, fontSize: 11, textTransform: 'uppercase' },
})
