// Generative video clip — Phase 1 of growth/video-clips-plan.md.
//
// Owner taps "Make a video" on a published piece. We:
//   1. verify they own the gallery, the feature is enabled, and they're
//      under the cost/rate caps
//   2. spend a credit
//   3. ask Claude (vision) for a per-image MOTION prompt (gentle, in-
//      character, subject-protecting — see the rules in the plan doc)
//   4. submit the rendered image to fal.ai Kling image-to-video via the
//      QUEUE api with a webhook callback (the render takes 15–60s, far
//      past the 150s edge envelope, so we never block on it)
//   5. mark the piece clip_status='queued' and return
//
// Completion is handled asynchronously by the `clip-webhook` function,
// which fal calls when the render finishes.
//
// COST SAFETY: this invocation triggers a paid fal.ai render. It is
// gated behind CLIPS_ENABLED, a per-user 24h rate limit, and a global
// monthly cap. Do not enable in production until budget is confirmed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v4.15.4/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))

// Feature + cost controls.
const CLIPS_ENABLED = Deno.env.get('CLIPS_ENABLED') === 'true'
const CLIP_WEBHOOK_SECRET = Deno.env.get('CLIP_WEBHOOK_SECRET') || ''
const PER_USER_DAILY_LIMIT = Number(Deno.env.get('CLIP_USER_DAILY_LIMIT') || '5')
const GLOBAL_MONTHLY_CAP = Number(Deno.env.get('CLIP_MONTHLY_CAP') || '500')

// fal.ai Kling 2.1 image-to-video (standard tier for cost; swap to /pro
// for hero clips). Kept in one place so it's trivial to change/A-B.
const FAL_MODEL = Deno.env.get('FAL_VIDEO_MODEL') || 'fal-ai/kling-video/v2.1/standard/image-to-video'
const CLIP_DURATION = '5' // seconds; Kling accepts "5" or "10"
// NOTE: Kling image-to-video does NOT accept an aspect_ratio param — the
// output ratio is derived from the input image. Our transformed images are
// square (1:1), so v1 clips are square. 9:16 framing (pre-padding the
// keyframe) is a fast-follow.

type Piece = {
  id: string
  title: string | null
  ai_description: string | null
  transformed_image_url: string | null
  watermarked_image_url: string | null
  clip_status: string
  store_id: string
  stores: { child_name: string; owner_id: string }
}

async function rpc(fn: string, body: Record<string, unknown>): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${fn} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

// Ask Claude for a per-image motion prompt. Rules mirror the plan doc:
// one gentle in-character primary action + ambient motion, and HARD
// subject protection (kid-art characters morph easily).
async function buildMotionPrompt(imageUrl: string, description: string | null): Promise<string> {
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) throw new Error('Missing ANTHROPIC_API_KEY')

  // Fetch the image and inline it as base64 (Claude needs the bytes).
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`could not fetch image: ${imgRes.status}`)
  const buf = new Uint8Array(await imgRes.arrayBuffer())
  let binary = ''
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i])
  const base64 = btoa(binary)
  const mediaType = imgRes.headers.get('content-type')?.includes('png') ? 'image/png' : 'image/jpeg'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: `You write a single short image-to-video motion prompt for a children's storybook illustration that will be animated into a 5-second clip. Rules:
- Choose ONE primary action for the main character/element: small, gentle, in-character (blink, breathe, slow head tilt, one slow step, tail swish, wings settle). Never a full traversal across the frame.
- Add ambient secondary motion: drifting light, floating motes, swaying foliage, rippling water, or a very slow push-in.
- PROTECT THE SUBJECT: explicitly say to keep the character's shape, face, count, and colors stable — no morphing, melting, adding, or removing features. Children's art is fragile.
- Match the mood (cozy = slow/warm; wild = a touch more energy, still controlled).
- Output ONLY the motion prompt as plain text, 2–4 sentences, no preamble, no quotes.`,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: `This rendered world${description ? ` is described as: "${description}"` : ''}. Write the motion prompt.` },
        ],
      }],
    }),
  })
  if (!res.ok) throw new Error(`Claude motion-prompt error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return (data.content?.[0]?.text || '').trim()
}

export const handler = async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    if (!CLIPS_ENABLED) return json({ error: 'clips_disabled' }, 403)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)
    let userId: string
    try {
      const { payload } = await jwtVerify(authHeader.replace('Bearer ', ''), JWKS, { issuer: `${SUPABASE_URL}/auth/v1` })
      if (!payload.sub) throw new Error('missing sub')
      userId = payload.sub
    } catch {
      return json({ error: 'Unauthorized' }, 401)
    }

    const falKey = Deno.env.get('FAL_API_KEY')
    if (!falKey) throw new Error('Missing FAL_API_KEY')
    if (!CLIP_WEBHOOK_SECRET) throw new Error('Missing CLIP_WEBHOOK_SECRET')

    const { piece_id } = await req.json()
    if (!piece_id) return json({ error: 'piece_id required' }, 400)

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    const { data: piece, error: pErr } = await admin
      .from('pieces')
      .select('id, title, ai_description, transformed_image_url, watermarked_image_url, clip_status, store_id, stores(child_name, owner_id)')
      .eq('id', piece_id)
      .single()
    if (pErr || !piece) throw new Error(`piece not found: ${pErr?.message || 'no row'}`)
    const p = piece as unknown as Piece

    if (p.stores.owner_id !== userId) return json({ error: 'Forbidden' }, 403)
    if (p.clip_status === 'queued' || p.clip_status === 'processing') return json({ ok: true, status: p.clip_status })

    const imageUrl = p.transformed_image_url || p.watermarked_image_url
    if (!imageUrl) return json({ error: 'piece has no image' }, 400)

    // Per-user daily rate limit + global monthly cap (count clip_requested events).
    const since24h = new Date(Date.now() - 24 * 3600_000).toISOString()
    const since30d = new Date(Date.now() - 30 * 86400_000).toISOString()
    const [{ count: userCount }, { count: globalCount }] = await Promise.all([
      admin.from('events').select('id', { count: 'exact', head: true }).eq('event_type', 'clip_requested').eq('user_id', userId).gte('created_at', since24h),
      admin.from('events').select('id', { count: 'exact', head: true }).eq('event_type', 'clip_requested').gte('created_at', since30d),
    ])
    if ((userCount ?? 0) >= PER_USER_DAILY_LIMIT) return json({ error: 'rate_limited', message: 'You can make a few videos a day — try again tomorrow.' }, 429)
    if ((globalCount ?? 0) >= GLOBAL_MONTHLY_CAP) return json({ error: 'capacity', message: 'Video creation is at capacity for now. Try again later.' }, 503)

    // Spend a credit up front; refund on any failure before/at submit.
    const balance = await rpc('spend_credit', { p_user_id: userId, p_reason: 'clip' })
    if (balance === -1) return json({ error: 'out_of_credits', message: "You're out of credits." }, 402)

    try {
      const motionPrompt = await buildMotionPrompt(imageUrl, p.ai_description)

      await admin.from('pieces').update({
        clip_status: 'queued',
        clip_prompt: motionPrompt,
        clip_requested_at: new Date().toISOString(),
      }).eq('id', p.id)

      // Submit to fal queue with a webhook callback. fal will POST the
      // result to clip-webhook when the render is done; our query params
      // (piece_id + token) come back to us so we can match + verify.
      const webhook = `${SUPABASE_URL}/functions/v1/clip-webhook?piece_id=${encodeURIComponent(p.id)}&token=${encodeURIComponent(CLIP_WEBHOOK_SECRET)}`
      const falRes = await fetch(`https://queue.fal.run/${FAL_MODEL}?fal_webhook=${encodeURIComponent(webhook)}`, {
        method: 'POST',
        headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: motionPrompt, image_url: imageUrl, duration: CLIP_DURATION }),
      })
      if (!falRes.ok) throw new Error(`fal queue error: ${falRes.status} ${await falRes.text()}`)

      await admin.from('events').insert({
        event_type: 'clip_requested', user_id: userId, piece_id: p.id, store_id: p.store_id,
        metadata: { model: FAL_MODEL, duration: CLIP_DURATION },
      })

      return json({ ok: true, status: 'queued' })
    } catch (e) {
      // Roll back: refund the credit and reset status so they can retry.
      try { await rpc('refund_credit', { p_user_id: userId, p_reason: 'clip_refund' }) } catch {}
      await admin.from('pieces').update({ clip_status: 'failed' }).eq('id', p.id)
      throw e
    }
  } catch (e: any) {
    console.error('generate-clip error:', e)
    return json({ error: e?.message || 'unknown' }, 500)
  }
}

Deno.serve(handler)
