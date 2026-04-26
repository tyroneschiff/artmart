import { useState, useEffect, useRef } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, TextInput, Modal, Dimensions, StatusBar } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../hooks/useAuthStore'
import ShareSheet from '../../components/ShareSheet'
import PreservedDrawing from '../../components/PreservedDrawing'
import { PieceSkeleton } from '../../components/Skeleton'
import { track } from '../../lib/analytics'
import { buildPieceShareMessage, SharePayload } from '../../lib/share'
import { colors, type, btn, card } from '../../lib/theme'
import ReadAloudButton from '../../components/ReadAloudButton'

type Piece = {
  id: string; title: string; transformed_image_url: string; watermarked_image_url?: string; original_image_url: string
  vote_count: number; ai_description: string
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

export default function PieceScreen() {
  const { id, vote } = useLocalSearchParams<{ id: string; vote?: string }>()
  const session = useAuthStore((s) => s.session)
  const queryClient = useQueryClient()
  const autoVoteFired = useRef(false)
    const [sharePayload, setSharePayload] = useState<SharePayload | null>(null)
    const [commentText, setCommentText] = useState('')
    const [lightboxUri, setLightboxUri] = useState<string | null>(null)
  
    const { data: piece, isLoading, error, refetch } = useQuery({ queryKey: ['piece', id], queryFn: () => fetchPiece(id) })
  
    const isOwner = !!session && !!piece && session.user.id === piece.stores?.owner_id

    const { data: comments } = useQuery({ queryKey: ['comments', id], queryFn: () => fetchComments(id) })
  
    const { data: myVote } = useQuery({
      queryKey: ['vote', id, session?.user.id],
      queryFn: async () => {
        const { data } = await supabase.from('votes').select('id').eq('piece_id', id).eq('user_id', session!.user.id).maybeSingle()
        return data
      },
      enabled: !!session,
    })
    const hasVoted = !!myVote

    const displayImageUrl = piece ? (piece.transformed_image_url || piece.watermarked_image_url) : null
  
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
        queryClient.invalidateQueries({ queryKey: ['vote', id, session?.user.id] })
        track('vote_cast', { pieceId: id })
      },
      onError: (e: any) => Alert.alert('Vote failed', e.message === 'Request timed out. Please check your connection.' ? e.message : 'You already voted for this piece.'),
    })

    useEffect(() => {
      if (!id) return
      supabase.rpc('increment_piece_views', { p_piece_id: id })
    }, [id])

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
  
    const deleteMutation = useMutation({
      mutationFn: async () => {
        const { error } = await supabase.from('pieces').delete().eq('id', id)
        if (error) throw error
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['store', piece!.stores?.slug] })
        queryClient.invalidateQueries({ queryKey: ['discover'] })
        queryClient.invalidateQueries({ queryKey: ['mystores'] })
        router.replace(`/gallery/${piece!.stores?.slug}`)
      },
      onError: (e: any) => Alert.alert('Delete failed', e.message),
    })

    function handleDelete() {
      Alert.alert(
        'Delete this world?',
        'This can\'t be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
        ]
      )
    }

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
  
  if (isLoading) return <PieceSkeleton />
  
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={[type.h2, { fontSize: 22, marginBottom: 6, textAlign: 'center' }]}>That didn't load</Text>
        <Text style={[type.body, { fontSize: 14, textAlign: 'center', marginBottom: 20, paddingHorizontal: 32 }]}>
          Check your connection and give it another go.
        </Text>
        <TouchableOpacity style={[btn.primary, { paddingHorizontal: 28, paddingVertical: 14 }]} onPress={() => refetch()}>
          <Text style={btn.primaryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!piece) return (
    <View style={styles.center}>
      <Text style={[type.h2, { fontSize: 22, marginBottom: 6 }]}>Can't find this world</Text>
      <Text style={[type.body, { fontSize: 14, marginBottom: 20 }]}>It may have been removed.</Text>
      <TouchableOpacity style={[btn.primary, { paddingHorizontal: 28, paddingVertical: 14 }]} onPress={() => router.back()}>
        <Text style={btn.primaryText}>Go back</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.dark} />
          </TouchableOpacity>
          <TouchableOpacity style={[btn.primary, { paddingVertical: 10, paddingHorizontal: 18 }]} onPress={() =>
            setSharePayload(buildPieceShareMessage(piece.title, piece.stores?.child_name ?? 'Artist', piece.id))
          }>
            <Text style={[btn.primaryText, { fontSize: 13 }]}>Share</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.9} onPress={() => displayImageUrl && setLightboxUri(displayImageUrl)}>
          <Image source={{ uri: displayImageUrl || '' }} style={styles.mainImage} />
        </TouchableOpacity>

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{piece.title}</Text>

          <View style={styles.metaRow}>
            <TouchableOpacity style={styles.galleryChip} onPress={() => router.push(`/gallery/${piece.stores?.slug}`)} activeOpacity={0.75}>
              <View style={styles.galleryAvatar}>
                <Text style={styles.galleryAvatarText}>{piece.stores?.child_name?.[0]?.toUpperCase() ?? '?'}</Text>
              </View>
              <Text style={styles.galleryChipText}>{piece.stores?.child_name}'s Gallery</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.voteChip, hasVoted && styles.voteChipDone]}
              onPress={() => {
                if (!session) {
                  router.push({ pathname: '/(auth)/login', params: { returnTo: `/piece/${id}?vote=1` } })
                } else if (!hasVoted) {
                  voteMutation.mutate()
                }
              }}
              disabled={voteMutation.isPending || hasVoted}
              activeOpacity={0.75}
            >
              <Ionicons
                name={hasVoted ? 'heart' : 'heart-outline'}
                size={14}
                color={colors.goldDark}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.voteChipText, hasVoted && styles.voteChipTextDone]}>
                {piece.vote_count}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {piece.ai_description ? (
          <View style={styles.descriptionBlock}>
            <Text style={styles.descriptionText}>{piece.ai_description}</Text>
            <ReadAloudButton text={piece.ai_description} compact />
          </View>
        ) : null}

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

        <PreservedDrawing
          imageUri={piece.original_image_url}
          childName={piece.stores?.child_name}
          onPress={() => setLightboxUri(piece.original_image_url)}
        />

        {isOwner && (
          <TouchableOpacity
            style={styles.dangerZone}
            onPress={handleDelete}
            disabled={deleteMutation.isPending}
            activeOpacity={0.6}
          >
            <Text style={styles.dangerZoneText}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete this piece'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)} statusBarTranslucent>
        <StatusBar barStyle="light-content" />
        <TouchableOpacity style={styles.lightboxBackdrop} activeOpacity={1} onPress={() => setLightboxUri(null)}>
          <Image source={{ uri: lightboxUri || '' }} style={styles.lightboxImage} resizeMode="contain" />
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxUri(null)} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.white} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
  dangerZone: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, alignItems: 'center' },
  dangerZoneText: { fontSize: 13, fontWeight: '600', color: colors.muted, textDecorationLine: 'underline' },
  mainImage: { width: '100%', aspectRatio: 1 },
  titleBlock: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5, color: colors.dark, lineHeight: 32, marginBottom: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  galleryChip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 8, paddingRight: 14, borderRadius: 100, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, flex: 1 },
  galleryAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.goldLight, borderWidth: 1, borderColor: colors.goldMid, alignItems: 'center', justifyContent: 'center' },
  galleryAvatarText: { fontSize: 12, fontWeight: '900', color: colors.goldDark },
  galleryChipText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.dark, letterSpacing: -0.2 },
  galleryChipArrow: { fontSize: 18, color: colors.muted, marginLeft: 4 },
  voteChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 100, backgroundColor: colors.goldLight, borderWidth: 1, borderColor: colors.goldMid, minWidth: 60, justifyContent: 'center' },
  voteChipDone: { opacity: 0.55 },
  voteChipText: { fontSize: 13, fontWeight: '800', color: colors.goldDark, letterSpacing: -0.1 },
  voteChipTextDone: { color: colors.goldDark },
  descriptionBlock: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  descriptionText: { fontSize: 15, color: colors.mid, lineHeight: 23, marginBottom: 14, fontWeight: '500' },
  lightboxBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  lightboxImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height },
  lightboxClose: { position: 'absolute', top: 56, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  commentSection: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 0 },
  commentInputWrap: { marginBottom: 24 },
  commentInput: { padding: 12, fontSize: 15, color: colors.dark, minHeight: 80, textAlignVertical: 'top' },
  postBtn: { paddingVertical: 10, paddingHorizontal: 20, alignSelf: 'flex-end', marginTop: 8 },
  postBtnDisabled: { opacity: 0.5 },
  commentsList: { gap: 16 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  commentAuthor: { fontWeight: '700', color: colors.dark, fontSize: 14 },
  reportLabel: { ...type.label, fontSize: 11, textTransform: 'uppercase' },
  deleteBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: colors.muted },
})
