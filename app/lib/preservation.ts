import * as FileSystem from 'expo-file-system/legacy'
import * as MediaLibrary from 'expo-media-library'
import { Platform, Alert } from 'react-native'

export type SavablePiece = {
  id: string
  original_image_url: string | null
  childName?: string
}

export type SaveProgress = { done: number; total: number }

export type SaveResult = {
  saved: number
  total: number
  cancelled?: boolean
  noPermission?: boolean
}

const ALBUM_NAME = 'Draw Up'

/**
 * Download a list of pieces' originals to Photos and group them into
 * a single "Draw Up" album. Used by gallery view (per-gallery) and
 * profile (across-all-galleries).
 *
 * - Requests Photos permission
 * - Skips pieces without an original_image_url
 * - Uses createAlbumAsync seeded with first asset, addAssetsToAlbumAsync
 *   for the rest (matches macOS Photos album-creation API)
 * - Reports progress via onProgress(done, total)
 * - Web returns saved=0 with a friendly Alert (Photos not supported)
 */
export async function saveOriginalsToPhotos(
  pieces: SavablePiece[],
  onProgress?: (p: SaveProgress) => void,
): Promise<SaveResult> {
  const eligible = pieces.filter((p) => !!p.original_image_url)
  if (eligible.length === 0) return { saved: 0, total: 0 }

  if (Platform.OS === 'web') {
    Alert.alert('Open the app', 'Saving originals to Photos works on the iPhone app.')
    return { saved: 0, total: eligible.length }
  }

  const { status } = await MediaLibrary.requestPermissionsAsync()
  if (status !== 'granted') {
    return { saved: 0, total: eligible.length, noPermission: true }
  }

  const assets: MediaLibrary.Asset[] = []
  let saved = 0

  for (const piece of eligible) {
    try {
      const safeChild = (piece.childName || 'art').replace(/[^a-z0-9]+/gi, '_').toLowerCase()
      const filename = `drawup_${safeChild}_${piece.id}.jpg`
      const localUri = FileSystem.documentDirectory + filename
      await FileSystem.downloadAsync(piece.original_image_url!, localUri)
      const asset = await MediaLibrary.createAssetAsync(localUri)
      assets.push(asset)
      saved++
      onProgress?.({ done: saved, total: eligible.length })
    } catch {
      // Skip individual failures, keep going
    }
  }

  if (assets.length > 0) {
    try {
      const existing = await MediaLibrary.getAlbumAsync(ALBUM_NAME)
      if (!existing) {
        const album = await MediaLibrary.createAlbumAsync(ALBUM_NAME, assets[0], false)
        if (assets.length > 1) {
          await MediaLibrary.addAssetsToAlbumAsync(assets.slice(1), album, false)
        }
      } else {
        await MediaLibrary.addAssetsToAlbumAsync(assets, existing, false)
      }
    } catch {
      // Album grouping isn't critical — assets are still in the camera roll
    }
  }

  return { saved, total: eligible.length }
}
