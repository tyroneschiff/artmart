import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v4.15.4/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))

async function rpc(fn: string, body: Record<string, unknown>): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${fn} failed: ${res.status} ${await res.text()}`)
  return await res.json()
}

function extractJson(text: string): { description: string; prompt: string } {
  try {
    return JSON.parse(text)
  } catch {}
  const match = text.match(/\{[\s\S]*"description"[\s\S]*"prompt"[\s\S]*\}/)
  if (match) {
    try {
      return JSON.parse(match[0])
    } catch {}
  }
  const desc = text.match(/"description"\s*:\s*"([^"]+)"/)
  const prom = text.match(/"prompt"\s*:\s*"([^"]+)"/)
  if (desc && prom) return { description: desc[1], prompt: prom[1] }
  throw new Error(`Gemini did not return valid JSON. Response: ${text.slice(0, 200)}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let userId: string
    try {
      const { payload } = await jwtVerify(authHeader.replace('Bearer ', ''), JWKS, {
        issuer: `${SUPABASE_URL}/auth/v1`,
      })
      if (!payload.sub) throw new Error('missing sub')
      userId = payload.sub
    } catch {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { imageBase64, mimeType } = await req.json()
    if (!imageBase64 || !mimeType) throw new Error('imageBase64 and mimeType required')

    const falKey = Deno.env.get('FAL_API_KEY')
    if (!falKey) throw new Error('Missing server-side API keys')

    const balanceAfter = await rpc('spend_credit', { p_user_id: userId, p_reason: 'transform' })
    if (balanceAfter === -1) {
      return new Response(
        JSON.stringify({ error: 'out_of_credits', message: 'You\'re out of credits. Buy a pack to keep bringing your child\'s imagination to life.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let refunded = false
    const refundOnce = async () => {
      if (refunded) return
      refunded = true
      try { await rpc('refund_credit', { p_user_id: userId, p_reason: 'refund' }) } catch {}
    }

    try {

    // Step 1: Claude 3.5 Sonnet → description + transform prompt
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) throw new Error('Missing ANTHROPIC_API_KEY')

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: [{
          type: 'text',
          text: `You are an art director reimagining a child's drawing as a museum-quality fine art print. Your job is to ELEVATE the piece, not just clean it up.
You MUST respond with ONLY a raw JSON object — no markdown, no explanation, no code fences.
The JSON must have exactly two keys: "description" and "prompt".

The "description" is shown to family on the artwork's page — write it like a warm gallery curator who genuinely loves children's art. Celebrate the imagination and energy in the piece. 2–3 sentences. Focus on what makes it special and alive, not just what objects are depicted. Sound like something a proud parent would read aloud to a grandparent.

The "prompt" is sent to an AI image model. The model sees the original photo as input, so your prompt must push it HARD toward a transformation — otherwise the output looks like the input.

Your prompt MUST:
1. Pick ONE specific fine-art medium that suits the piece and commit to it fully (e.g. "lush watercolor with visible brushwork and pigment bloom", "thick impasto oil painting on linen canvas with palette-knife texture", "rich gouache illustration with soft paper grain", "screen-printed poster with bold flat color fields and halftone texture", "mixed-media collage with torn paper edges and ink outlines"). Never say "in the style of the drawing" — reinvent the surface.
2. Preserve the child's composition, subjects, and spirit — the shapes they drew stay in the same places — but upgrade every stroke: refined line quality, richer saturated color palette with depth and shadow, painterly light, atmospheric background treatment, professional color grading.
3. Add sensory detail the original lacks: texture of the medium, play of light, subtle gradients, ambient depth, a hint of artistic interpretation that makes this feel intentional and gallery-worthy.
4. Full bleed edge-to-edge composition filling the entire frame, no paper edges, no borders, no scan artifacts, creases removed, pristine smooth surface.
5. End with: "gallery quality fine art print, museum reproduction, 11x14 inch premium print, vivid color, crisp detail".

Do NOT just describe what's in the drawing. Describe the transformed artwork as a curator would describe a framed piece hanging in a boutique gallery.

Example output:
{"description":"There's a joyful confidence to the way Emma planted that bright yellow sun in the corner — like she knew exactly where the warmth should come from. The house sits bold and happy at the centre, surrounded by flowers that reach upward with real optimism. This one belongs on a wall.","prompt":"A whimsical countryside cottage scene rendered as a lush watercolor illustration with visible brushwork, pigment blooms, and soft paper grain. The cottage glows in warm ochre and terracotta tones under a luminous golden sun, surrounded by a meadow of painterly wildflowers in coral, violet, and buttercream. Atmospheric depth from soft gradient sky washes in peach and sky-blue, subtle shadows beneath each bloom, refined confident linework in sepia ink. Full bleed edge-to-edge composition filling the entire frame, no paper edges or borders, creases and scan artifacts removed, pristine smooth surface. Gallery quality fine art print, museum reproduction, 11x14 inch premium print, vivid color, crisp detail."}`,
          cache_control: { type: 'ephemeral' },
        }],
        messages: [{
          role: 'user',
          content: [{
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 }
          }, {
            type: 'text',
            text: 'Describe this child\'s drawing and write a transformation prompt. Reply with only the JSON object.'
          }]
        }]
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      throw new Error(`Claude API error: ${err}`)
    }

    const claudeData = await claudeRes.json()
    const rawText = claudeData.content[0].text
    const { description, prompt } = extractJson(rawText)

    // Step 2: fal.ai Flux Kontext → transformed image (synchronous)
    const falRes = await fetch('https://fal.run/fal-ai/flux-pro/kontext', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: `You are an art director reimagining a child's drawing as a museum-quality fine art print. Your job is to ELEVATE the piece, not just clean it up.

Your prompt MUST:
1. Pick ONE specific fine-art medium that suits the piece and commit to it fully (e.g. "lush watercolor with visible brushwork and pigment bloom", "thick impasto oil painting on linen canvas with palette-knife texture", "rich gouache illustration with soft paper grain", "screen-printed poster with bold flat color fields and halftone texture", "mixed-media collage with torn paper edges and ink outlines"). Never say "in the style of the drawing" — reinvent the surface.
2. Preserve the child's composition, subjects, and spirit — the shapes they drew stay in the same places — but upgrade every stroke: refined line quality, richer saturated color palette with depth and shadow, painterly light, atmospheric background treatment, professional color grading.
3. Add sensory detail the original lacks: texture of the medium, play of light, subtle gradients, ambient depth, a hint of artistic interpretation that makes this feel intentional and gallery-worthy.
4. Full bleed edge-to-edge composition filling the entire frame, no paper edges, no borders, no scan artifacts, creases removed, pristine smooth surface.
5. End with: "gallery quality fine art print, museum reproduction, 11x14 inch premium print, vivid color, crisp detail".

Do NOT just describe what's in the drawing. Describe the transformed artwork as a curator would describe a framed piece hanging in a boutique gallery.
Original drawing prompt: ${prompt}`,
        image_url: 'data:' + mimeType + ';base64,' + imageBase64,
        guidance_scale: 6.0,
      }),
    })

    if (!falRes.ok) {
      const err = await falRes.text()
      throw new Error(`fal.ai error: ${err}`)
    }

    const falData = await falRes.json()
    const transformedUrl: string | null = falData.images?.[0]?.url ?? null

    if (!transformedUrl) throw new Error(`fal.ai returned no image. Response: ${JSON.stringify(falData).slice(0, 200)}`)

    return new Response(
      JSON.stringify({ transformedUrl, description, prompt, credits: balanceAfter }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    } catch (e) {
      await refundOnce()
      throw e
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
