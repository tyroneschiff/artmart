import { supabase } from './supabase'
import * as FileSystem from 'expo-file-system/legacy'
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
    // On web, open the signed URL directly
    window.open(download_url, '_blank')
    return
  }

  // On native, download to device and share
  const fileUri = (FileSystem as any).documentDirectory + `drawup_${pieceId}.jpg`
  const { uri } = await (FileSystem as any).downloadAsync(download_url, fileUri)
  await Share.share({ url: uri, title: 'Your Draw Up download' })
}
