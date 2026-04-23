import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system'
import { Share, Platform } from 'react-native'
import { colors } from './theme'

/**
 * Generates a 9:16 branded story card for Instagram/Social sharing.
 * Uses expo-image-manipulator to resize and pad the artwork to a story-friendly aspect ratio.
 */
export async function exportStoryCard(imageUri: string, title: string, childName: string) {
  try {
    // 1. Prepare the artwork: resize to fit 1080px width
    // 2. Use 'extent' to pad to 1080x1920 (9:16) with brand cream background
    // Note: 'extent' on native might require recent Expo versions (2025/2026+)
    const result = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        { resize: { width: 1080 } },
        { 
          // @ts-ignore - extent might be marked as web-only in some types but supported in newer Expo
          extent: { 
            width: 1080, 
            height: 1920, 
            backgroundColor: colors.cream,
            // Center the image vertically (1920 - 1080) / 2 = 420
            originY: 420 
          } 
        }
      ],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    )

    if (Platform.OS === 'web') {
      // On web, we just open the image or trigger a download
      const link = document.createElement('a')
      link.href = result.uri
      link.download = `story-${title.toLowerCase().replace(/\s+/g, '-')}.jpg`
      link.click()
      return
    }

    // 3. Share the generated card
    await Share.share({
      url: result.uri,
      title: `Step inside ${childName}'s imagination`,
      message: `Step inside ${childName}'s imagination: "${title}" 🌱`,
    })
    
  } catch (error) {
    console.error('Error exporting story card:', error)
    throw new Error('Failed to generate story card. Please try again.')
  }
}
