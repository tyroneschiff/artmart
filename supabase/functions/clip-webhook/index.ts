// fal.ai async completion callback for generate-clip.
//
// Two stages, both routed here (distinguished by ?stage=):
//   (default) Veo render finished. If NARRATION_ENABLED, we dub our
//     ElevenLabs narration onto the (silent) clip: TTS the description →
//     upload the mp3 → submit a fal ffmpeg compose job (audio over video)
//     with a webhook back here at &stage=compose. Otherwise we finalize
//     the Veo clip as-is (music bed).
//   stage=compose: the ffmpeg job finished → finalize with the dubbed mp4.
//
// Every narration step degrades gracefully: any failure finalizes the
// plain Veo clip rather than losing the user's video. NARRATION_ENABLED
// is OFF by default — the narration path ships dormant until verified
// against a real render (and the fal ffmpeg compose schema confirmed).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIP_WEBHOOK_SECRET = Deno.env.get('CLIP_WEBHOOK_SECRET') || ''
const CLOUDINARY_CLOUD = Deno.env.get('CLOUDINARY_CLOUD_NAME') || ''
const CLIP_CREDITS = Number(Deno.env.get('CLIP_CREDITS') || '1')
const NARRATION_ENABLED = Deno.env.get('NARRATION_ENABLED') === 'true'
const FAL_KEY = Deno.env.get('FAL_API_KEY') || ''
const CLIP_DURATION_SEC = Number((Deno.env.get('FAL_VIDEO_DURATION') || '8s').replace('s', '')) || 8

async function rpc(fn: string, body: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {})
}

// Optional Cloudinary text watermark (env-gated; falls back to raw clip).
function watermark(videoUrl: string): string {
  if (!CLOUDINARY_CLOUD) return videoUrl
  try {
    const overlay = 'l_text:Arial_42_bold:drawup.ink,co_white,o_85,g_south_east,x_36,y_40'
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/video/fetch/${overlay}/${encodeURIComponent(videoUrl)}`
  } catch {
    return videoUrl
  }
}

function videoUrlFrom(body: any): string | null {
  return body?.payload?.video?.url || body?.payload?.video_url || body?.video?.url || body?.video_url || null
}

// Generate ElevenLabs narration of the description (via the tts function),
// upload the mp3 to Storage, and return its public URL. Throws on failure
// (caller degrades to the silent clip).
async function makeNarrationUrl(admin: any, pieceId: string, description: string): Promise<string> {
  const ttsRes = await fetch(`${SUPABASE_URL}/functions/v1/tts`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: description }),
  })
  if (!ttsRes.ok) throw new Error(`tts ${ttsRes.status}`)
  const { audio } = await ttsRes.json()
  if (!audio) throw new Error('no audio')
  // base64 → bytes
  const bin = atob(audio)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const path = `narration/${pieceId}.mp3`
  const { error } = await admin.storage.from('artwork').upload(path, bytes, { contentType: 'audio/mpeg', upsert: true })
  if (error) throw error
  return admin.storage.from('artwork').getPublicUrl(path).data.publicUrl
}

// Submit a fal ffmpeg compose job that lays the narration audio over the
// (silent) video, calling back here at &stage=compose.
// NOTE: the `tracks` schema is our best read of fal-ai/ffmpeg-api/compose
// and must be verified against a real render before NARRATION_ENABLED is
// flipped on. On any error the caller finalizes the plain clip.
async function submitCompose(pieceId: string, videoUrl: string, audioUrl: string) {
  const cb = `${SUPABASE_URL}/functions/v1/clip-webhook?piece_id=${encodeURIComponent(pieceId)}&token=${encodeURIComponent(CLIP_WEBHOOK_SECRET)}&stage=compose`
  const res = await fetch(`https://queue.fal.run/fal-ai/ffmpeg-api/compose?fal_webhook=${encodeURIComponent(cb)}`, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tracks: [
        { id: 'video', type: 'video', keyframes: [{ url: videoUrl, timestamp: 0, duration: CLIP_DURATION_SEC }] },
        { id: 'audio', type: 'audio', keyframes: [{ url: audioUrl, timestamp: 0, duration: CLIP_DURATION_SEC }] },
      ],
    }),
  })
  if (!res.ok) throw new Error(`compose submit ${res.status}`)
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const pieceId = url.searchParams.get('piece_id')
    const token = url.searchParams.get('token')
    const stage = url.searchParams.get('stage')
    if (!pieceId || !token || token !== CLIP_WEBHOOK_SECRET) {
      return new Response('forbidden', { status: 403 })
    }

    const body = await req.json().catch(() => ({} as any))
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    const { data: piece } = await admin
      .from('pieces')
      .select('id, store_id, ai_description, clip_url, stores(owner_id)')
      .eq('id', pieceId)
      .single()
    const ownerId = (piece as any)?.stores?.owner_id ?? null
    const storeId = (piece as any)?.store_id ?? null

    const ok = body?.status === 'OK' || body?.status === 'COMPLETED'
    const outUrl = videoUrlFrom(body)

    const finalizeReady = async (finalUrl: string, branded: boolean) => {
      await admin.from('pieces').update({ clip_status: 'ready', clip_url: finalUrl }).eq('id', pieceId)
      await admin.from('events').insert({
        event_type: 'clip_ready', user_id: ownerId, piece_id: pieceId, store_id: storeId,
        metadata: { branded, narrated: NARRATION_ENABLED && stage === 'compose' },
      })
    }
    const fail = async (reason: string) => {
      await admin.from('pieces').update({ clip_status: 'failed' }).eq('id', pieceId)
      if (ownerId) await rpc('refund_credits', { p_user_id: ownerId, p_amount: CLIP_CREDITS, p_reason: 'video_refund' })
      await admin.from('events').insert({
        event_type: 'clip_failed', user_id: ownerId, piece_id: pieceId, store_id: storeId,
        metadata: { error: reason.slice(0, 200), stage },
      })
    }

    // Stage 2: the ffmpeg compose finished.
    if (stage === 'compose') {
      if (ok && outUrl) {
        await finalizeReady(watermark(outUrl), !!CLOUDINARY_CLOUD)
      } else {
        // Compose failed but the Veo render had succeeded — deliver the
        // plain (silent) clip we stashed in clip_url rather than refund.
        const fallback = (piece as any)?.clip_url
        if (fallback) await finalizeReady(fallback, false)
        else await fail(String(body?.error || 'compose failed'))
      }
      return new Response('ok', { status: 200 })
    }

    // Stage 1: the Veo render finished.
    if (!ok || !outUrl) {
      await fail(String(body?.error || body?.payload_error || 'render failed'))
      return new Response('ok', { status: 200 })
    }

    const description = (piece as any)?.ai_description
    if (NARRATION_ENABLED && FAL_KEY && description) {
      // Stash the silent Veo url as the fallback, keep status processing,
      // then try to dub narration; compose webhook will finalize.
      await admin.from('pieces').update({ clip_status: 'processing', clip_url: outUrl }).eq('id', pieceId)
      try {
        const audioUrl = await makeNarrationUrl(admin, pieceId, description)
        await submitCompose(pieceId, outUrl, audioUrl)
        return new Response('ok', { status: 200 })
      } catch (e) {
        // Narration failed → deliver the plain clip (silent, since Veo was
        // asked for no audio when narration is enabled). Logged.
        console.error('narration dub failed:', e)
        await finalizeReady(outUrl, false)
        return new Response('ok', { status: 200 })
      }
    }

    // No narration: finalize the Veo clip (music bed), optional watermark.
    await finalizeReady(watermark(outUrl), !!CLOUDINARY_CLOUD)
    return new Response('ok', { status: 200 })
  } catch (e) {
    console.error('clip-webhook error:', e)
    return new Response('ok', { status: 200 })
  }
})
