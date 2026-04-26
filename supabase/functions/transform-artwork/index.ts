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
  // Strip markdown code fences if present
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  // Try direct parse first
  try { return JSON.parse(stripped) } catch {}

  // Find the outermost { } block and try parsing it
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    try { return JSON.parse(stripped.slice(start, end + 1)) } catch {}
  }

  // Last resort: extract values with a regex that handles escaped quotes and newlines
  const descMatch = stripped.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/s)
  const promptMatch = stripped.match(/"prompt"\s*:\s*"((?:[^"\\]|\\.)*)"/s)
  if (descMatch && promptMatch) {
    return {
      description: descMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"'),
      prompt: promptMatch[1].replace(/\\n/g, ' ').replace(/\\"/g, '"'),
    }
  }

  throw new Error(`Claude did not return valid JSON. Response: ${text.slice(0, 300)}`)
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

    const { imageBase64, mimeType, childName } = await req.json()
    if (!imageBase64 || !mimeType) throw new Error('imageBase64 and mimeType required')
    const artistName = childName ? childName : null

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
        max_tokens: 1024,
        system: [{
          type: 'text',
          text: `You step inside a child's drawing and describe what you see in their world. The drawing IS the world — you are not fixing or improving it, you are walking into it.

You MUST respond with ONLY a raw JSON object — no markdown, no explanation, no code fences.
The JSON must have exactly two keys: "description" and "prompt".

The "description" is READ ALOUD to the child who drew this — 4–10 years old and listening closely. Make them grin. Make them feel seen. Spark a tiny bit of wonder.

Hard rules for the description:
- 2 sentences, max 30 words total.
- Kid-friendly vocabulary only. NEVER use: exuberance, kinetic, masterpiece, magnificent, fearless, bristling, rhythmic, extraordinary, vivid, dynamic, captivating, imaginative, delightful, composition, palette.
- NEVER start with "You painted", "You drew", "You made", "You created". Vary openings — surprise, wonder, observation, imagination.
- Name 1–2 specific things from the drawing (a color, a creature, a shape, a detail).
- Spark imagination — what's happening, where they might be, what it feels like.
- End with warmth, but make it feel earned, not formulaic.
- Speak TO them when natural ("I wonder if you...") but don't force "your" everywhere.
- Plain text only, no quotes, no emoji.

GOOD EXAMPLES:
"Wow — that purple dragon looks like he's about to take off into the clouds! And those tiny flowers down by his feet? Such a sweet detail."

"A whole rainbow city! I keep finding new windows in those blue towers — I bet the people who live there are happy all day long."

"Look at that brave little fox tiptoeing through the orange leaves. Something about his pointy ears makes me feel like he's about to find an adventure."

The "prompt" goes to a high-end AI image model (Flux) that will render this world. The model sees the original drawing as input, so be vivid and push hard or the output looks like the input. Treat the child's drawing as the blueprint for a real place — the characters, composition, and color choices are the source of truth. Show what it looks like to stand inside that place.

Your prompt MUST:
1. Be extremely descriptive, evocative, and visually rich (at least 60–100 words). Use strong adjectives and explicitly specify lighting, texture, camera angle, and atmosphere.
2. Describe the scene as a living world, not a drawing being redone. What's happening right now? Who's there? What time of day, what's the light like, what's the feeling in the air?
3. Honor the child's hand. The output should still feel made by — or at least true to — a child. Keep wobbly lines, naive proportions, irregular shapes, and slightly off geometry visible. Do NOT over-perfect anatomy, foreshortening, or symmetry. The result should feel hand-rendered, not polished commercial art. Avoid: perfect circles, hyper-detailed faces, technical accuracy, sterile gradients.
4. Pick ONE specific warm illustration style that fits the scene's spirit — e.g.
   - "soft dreamlike watercolor with glowing light and atmospheric haze, slightly bleeding pigments"
   - "warm storybook illustration with confident wobbly ink outlines and rich gouache fills"
   - "twilight pastel palette with soft painterly texture and hand-smudged color"
   - "bright saturated picture-book spread with crisp shapes and luminous color"
   - "matte gouache spread, deep cool palette, dusk atmosphere, visible brushwork"
   - "sun-bleached pastel painted on warm paper, hand-drawn linework with imperfect edges"
   - "vintage paperback illustration, soft halftone, muted yet glowing, slightly faded ink"
   Commit to it.
5. Keep the child's key choices central and recognizable — the characters stay in the same places, the colors stay as the dominant palette, the sun or moon or landmarks stay where placed.
6. Full bleed edge-to-edge composition filling the frame, no paper edges, no borders, no scan artifacts, creases removed, smooth clean surface.
7. End exactly with: "warm hand-rendered storybook illustration, naive charm preserved, vivid color, soft texture, 8k resolution, ready for full-screen viewing on phone."

Example:
{"description":"That dragon is right next to the cozy cottage, and the sun is smiling. What an awesome place you made.","prompt":"Step inside this imagined world: a friendly dragon guarding a cozy cottage at the heart of a wildflower meadow, with a smiling golden sun glowing from the corner of the sky. It's mid-morning, the air is warm and drowsy, soft cinematic sunlight catches on every delicate petal, and the cottage windows glow softly from within. The dragon's body is slightly lumpy, his eyes a bit lopsided, the cottage windows wobble — preserving the original drawing's joyful imperfection. Rendered as a breathtaking, warm storybook illustration with confident wobbly ink linework and rich gouache fills — buttercup yellow, coral, sage green, warm terracotta. The atmosphere is magical, nostalgic, and lovingly hand-rendered. Full bleed edge-to-edge composition filling the entire frame, no paper edges or borders, creases and scan artifacts removed, smooth clean surface. warm hand-rendered storybook illustration, naive charm preserved, vivid color, soft texture, 8k resolution, ready for full-screen viewing on phone."}`,
          cache_control: { type: 'ephemeral' },
        }],
        messages: [{
          role: 'user',
          content: [{
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 }
          }, {
            type: 'text',
            text: `Look at this child's drawing${artistName ? ` by ${artistName}` : ''}. Write your 2-sentence reaction to ${artistName ? artistName : 'the child'} — surprise them, spark wonder, name something specific. Don't start with "You painted/drew/made/created". Then write a vivid Flux prompt that renders the world as a real place. Reply with only the JSON object.`
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
        guidance_scale: 6.0,
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
