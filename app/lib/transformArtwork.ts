import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from './supabase'

export class OutOfCreditsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OutOfCreditsError'
  }
}

export async function transformArtwork(
  localImageUri: string,
  precomputedBase64?: string,
): Promise<{ transformedUrl: string; description: string; prompt: string; credits: number }> {
  const base64 = precomputedBase64 ?? await FileSystem.readAsStringAsync(localImageUri, { encoding: 'base64' })
  const mimeType = precomputedBase64
    ? 'image/jpeg'
    : localImageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) throw new Error('App configuration error: Supabase URL or key missing.')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('You must be signed in to transform artwork.')

  const bodySizeKB = Math.round((base64.length * 3) / 4 / 1024)
  if (bodySizeKB > 4096) throw new Error(`Image too large after compression (${bodySizeKB}KB). Please try a smaller photo.`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 90_000)

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/transform-artwork`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ imageBase64: base64, mimeType }),
      signal: controller.signal,
    }).catch((err: any) => {
      throw new Error(`Connection failed: ${err.message} (URL: ${supabaseUrl})`)
    })

    if (res.status === 402) {
      const body = await res.json().catch(() => ({}))
      throw new OutOfCreditsError(body.message ?? 'You\'re out of credits.')
    }

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Server error ${res.status}: ${body}`)
    }

    const data = await res.json()
    if (data.error) throw new Error(data.error)

    return { transformedUrl: data.transformedUrl, description: data.description, prompt: data.prompt, credits: data.credits ?? 0 }
  } catch (e: any) {
    if (e.name === 'AbortError') throw new Error('Transform timed out after 90 seconds. Please try again.')
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}
