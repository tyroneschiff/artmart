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

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      controller.abort()
      reject(new Error('The AI is taking a little longer than usual to imagine this piece. Please try again in a moment.'))
    }, timeoutMs)
  })

  return Promise.race([
    fetch(url, { ...options, signal: controller.signal }),
    timeoutPromise
  ])
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
  throw new Error(`Claude did not return valid JSON. Response: ${text.slice(0, 200)}`)
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

    const claudeRes = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: [{
          type: 'text',
          text: `You help a parent celebrate a moment with their child by gently polishing the child's drawing. Respond with ONLY a raw JSON object — no markdown, no code fences. Exactly two keys: "description" and "prompt".

GOLDILOCKS RULE: the transformed image must feel like the SAME drawing, just a little more alive. Not a redesign. Not a different art style. Not cinematic, not photorealistic, not "gallery fine art." If a stranger saw the before/after, they'd say "oh, it's the same picture, just nicer." If the child saw it, they'd say "that's mine!" — not "who made that?"

THE "description" — written for a 4–8 year old, read aloud by the parent at bedtime or on the ride home.
- 2 short sentences. Warm, curious, playful.
- Tell a tiny story about what's happening in the drawing (the sun is smiling, the dog is running somewhere, the house has a red door).
- No art vocabulary ("composition", "palette", "gallery", "whimsical", "vibrant"). No praise words ("amazing", "beautiful", "masterpiece").
- Sound like a parent noticing something specific: "Look — your dragon has three toes on each foot, and one little tooth sticking out."
- Never say "your child" or name anyone. Speak TO the kid ("you drew…", "look at…") or about the scene.

THE "prompt" — sent to an img2img model that already sees the drawing. Keep it close to the original.
MUST:
1. Start by inventorying the SPECIFIC elements in the drawing — every shape, creature, object, color the child actually drew. The output must contain all of them, in the same positions, same relative sizes, same colors.
2. Say "children's picture book illustration, in the spirit of Oliver Jeffers or Jon Klassen — hand-drawn warmth, soft texture, honest imperfect lines." Never say "fine art", "museum", "photorealistic", "cinematic", "3D", "digital painting", "masterpiece".
3. Keep the child's linework and proportions. Clean up wobble only slightly. Do NOT add new characters, backgrounds, details, depth, shadows, or atmosphere the child didn't draw. An empty sky stays mostly empty.
4. Gentle upgrades only: softer paper texture, slightly richer versions of the same colors the child used, a little more consistency in line weight, flatten creases, crop out paper edges so it's full-bleed.
5. End with: "warm children's book illustration, soft paper texture, hand-drawn feel, full bleed, creases removed, clean edges."

Example:
{"description":"Look — your sun is wearing a big happy smile right next to the house with the red door. And there's a tiny flower under the window, like it grew there just for you.","prompt":"A child's drawing of a square yellow house with a red door and one window, a round smiling sun in the top-left corner with rays, a small green flower beside the house, and green grass along the bottom. Keep every element in the same position, same size, same colors the child used. Children's picture book illustration, in the spirit of Oliver Jeffers or Jon Klassen — hand-drawn warmth, soft texture, honest imperfect lines. Preserve the child's linework and proportions; do not add new characters, backgrounds, shadows, or details. Warm children's book illustration, soft paper texture, hand-drawn feel, full bleed, creases removed, clean edges."}`,
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
    }, 20000)

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      throw new Error(`Claude API error: ${err}`)
    }

    const claudeData = await claudeRes.json()
    const rawText = claudeData.content[0].text
    const { description, prompt } = extractJson(rawText)

    // Step 2: fal.ai Flux Kontext → transformed image (synchronous)
    const falRes = await fetchWithTimeout('https://fal.run/fal-ai/flux-pro/kontext', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_url: 'data:' + mimeType + ';base64,' + imageBase64,
        guidance_scale: 4.5,
      }),
    }, 20000)

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
