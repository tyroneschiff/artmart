// fal.ai async completion callback for generate-clip. fal POSTs here
// when a Kling render finishes. We registered the URL with the piece_id
// and a shared secret as query params, so we can match the piece and
// verify the caller without a JWT (fal has no Supabase token).
//
// On success: optionally watermark via Cloudinary (env-gated; skipped
// gracefully if unconfigured), then mark the piece clip_status='ready'
// with the final URL. On failure: mark 'failed' and refund the credit.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLIP_WEBHOOK_SECRET = Deno.env.get('CLIP_WEBHOOK_SECRET') || ''
const CLOUDINARY_CLOUD = Deno.env.get('CLOUDINARY_CLOUD_NAME') || ''
const CLIP_CREDITS = Number(Deno.env.get('CLIP_CREDITS') || '1') // marginal animate cost, refunded on failure

async function rpc(fn: string, body: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {})
}

// Optional branding. With only a Cloudinary cloud name we can use the
// fetch delivery pipeline to burn a "drawup.ink" text watermark into the
// remote clip — no upload, no asset management. Any failure (fetch not
// enabled, transform error) falls back to the raw clip so the user still
// gets their video. Unbranded is acceptable for v1 per the plan.
function watermark(videoUrl: string): string {
  if (!CLOUDINARY_CLOUD) return videoUrl
  try {
    const overlay = 'l_text:Arial_42_bold:drawup.ink,co_white,o_85,g_south_east,x_36,y_40'
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/video/fetch/${overlay}/${encodeURIComponent(videoUrl)}`
  } catch {
    return videoUrl
  }
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const pieceId = url.searchParams.get('piece_id')
    const token = url.searchParams.get('token')
    if (!pieceId || !token || token !== CLIP_WEBHOOK_SECRET) {
      return new Response('forbidden', { status: 403 })
    }

    const body = await req.json().catch(() => ({} as any))
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // Look up the piece's owner for refund + attribution.
    const { data: piece } = await admin
      .from('pieces')
      .select('id, store_id, stores(owner_id)')
      .eq('id', pieceId)
      .single()
    const ownerId = (piece as any)?.stores?.owner_id ?? null

    // fal queue webhook: { status: 'OK' | 'ERROR', payload: {...}, error }
    const ok = body?.status === 'OK' || body?.status === 'COMPLETED'
    const videoUrl = body?.payload?.video?.url || body?.payload?.video_url || body?.video?.url || null

    if (ok && videoUrl) {
      await admin.from('pieces').update({
        clip_status: 'ready',
        clip_url: watermark(videoUrl),
      }).eq('id', pieceId)
      await admin.from('events').insert({
        event_type: 'clip_ready', user_id: ownerId, piece_id: pieceId,
        store_id: (piece as any)?.store_id ?? null, metadata: { branded: !!CLOUDINARY_CLOUD },
      })
    } else {
      await admin.from('pieces').update({ clip_status: 'failed' }).eq('id', pieceId)
      if (ownerId) await rpc('refund_credits', { p_user_id: ownerId, p_amount: CLIP_CREDITS, p_reason: 'video_refund' })
      await admin.from('events').insert({
        event_type: 'clip_failed', user_id: ownerId, piece_id: pieceId,
        store_id: (piece as any)?.store_id ?? null,
        metadata: { error: String(body?.error || body?.payload_error || 'unknown').slice(0, 200) },
      })
    }

    return new Response('ok', { status: 200 })
  } catch (e) {
    console.error('clip-webhook error:', e)
    // 200 so fal doesn't hammer retries; we've logged it.
    return new Response('ok', { status: 200 })
  }
})
