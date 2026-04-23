import { supabase } from './supabase'
import * as FileSystem from 'expo-file-system'
import { Share, Alert, Platform } from 'react-native'

export async function downloadPiece(pieceId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const res = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/download-piece`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ piece_id: pieceId }),
    }
  )

  const { download_url, error } = await res.json()
  if (error) throw new Error(error)

  if (Platform.OS === 'web') {
    window.open(download_url, '_blank')
    return
  }

  try {
    const fileUri = FileSystem.documentDirectory + `drawup_${pieceId}.jpg`
    const downloadRes = await FileSystem.downloadAsync(download_url, fileUri)
    await Share.share({ url: downloadRes.uri, title: 'Your Draw Up download' })
  } catch (e: any) {
    console.error('Download error:', e)
    Alert.alert('Download Error', e.message || 'Failed to download image')
  }
}
