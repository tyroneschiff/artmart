import { Share, Linking, Platform, Alert } from 'react-native'

export type ShareTarget = 'native' | 'whatsapp' | 'copy'

export interface SharePayload {
  title: string
  message: string
  url: string
}

export async function shareToWhatsApp(message: string): Promise<void> {
  const encoded = encodeURIComponent(message)
  // wa.me is a universal link — opens WhatsApp if installed, web.whatsapp.com otherwise
  const url = Platform.OS === 'web'
    ? `https://web.whatsapp.com/send?text=${encoded}`
    : `https://wa.me/?text=${encoded}`
  await Linking.openURL(url)
}

export async function shareToSMS(message: string): Promise<void> {
  const encoded = encodeURIComponent(message)
  // iOS: sms:&body=... opens Messages with pre-filled body, no recipient
  // Android: sms:?body=... does the same
  const url = Platform.OS === 'ios'
    ? `sms:&body=${encoded}`
    : `sms:?body=${encoded}`
  await Linking.openURL(url)
}

export async function shareNative(payload: SharePayload): Promise<void> {
  await Share.share({
    title: payload.title,
    message: Platform.OS === 'ios'
      ? payload.message
      : `${payload.message}\n${payload.url}`,
    url: payload.url,
  })
}

export function buildPieceShareMessage(title: string, childName: string, pieceId: string): SharePayload {
  return {
    // Names the relationship explicitly: kid is the author, Draw Up is the renderer.
    // Avoids the receiver wondering "wait, did the kid actually draw this?" — the
    // share artifact tells the story so the parent doesn't have to.
    title: `${childName} drew this — and Draw Up turned it into a world`,
    message: `${childName} drew this — and Draw Up turned it into a world ✨`,
    url: `https://drawup.ink/piece/${pieceId}`,
  }
}

export function buildStoreShareMessage(childName: string, slug: string): SharePayload {
  return {
    title: `${childName}'s drawings, brought to life on Draw Up`,
    message: `${childName}'s drawings, brought to life on Draw Up ✨`,
    url: `https://drawup.ink/gallery/${slug}`,
  }
}
