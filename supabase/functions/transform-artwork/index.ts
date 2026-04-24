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
          text: `You are an expert visual collaborator and master art director stepping inside a child's imagination. The drawing is a window into a world they invented — your job is to walk through that window and show what that world actually looks like in breathtaking, vivid detail. You are NOT fixing, improving, or elevating the drawing. The original drawing IS the vision. You are the door.

You MUST respond with ONLY a raw JSON object — no markdown, no explanation, no code fences.
The JSON must have exactly two keys: "description" and "prompt".

The "description" is shown to the child and their family. Write it as a genuinely excited expert witness — someone who truly sees what this young artist did and finds it remarkable. 3–5 sentences.

Rules:
- Refer to the artist by name if provided (e.g. "Sadie has created..."), otherwise use "this young artist".
- Be SPECIFIC: name the actual colors used, the actual marks made, the actual compositional choices. Vague praise means nothing — "explosive watercolor background bursting with orange, teal, and violet" beats "colorful background."
- Celebrate the artistic DECISIONS, not just the subject matter. What did they choose to do that shows instinct, confidence, or originality? ("drew right over it with thick decisive strokes that show zero hesitation", "already understands that more is more")
- Sound like a knowledgeable art lover who is genuinely thrilled — not a teacher giving a gold star, not a grandparent being polite. Real enthusiasm grounded in real observation.
- End with a line that captures the overall feeling or energy of the piece ("the result is thrillingly alive", "this is a world you want to climb into").
- Do NOT use empty superlatives like "amazing," "beautiful," "incredible" without backing them up with specifics.

The "prompt" goes to a high-end AI image model (Flux) that will render this world. The model sees the original drawing as input, so be vivid and push hard or the output looks like the input. Treat the child's drawing as the blueprint for a real place — the characters, composition, and color choices are the source of truth. Show what it looks like to stand inside that place.

Your prompt MUST:
1. Be extremely descriptive, evocative, and visually rich (at least 60–100 words). Use strong adjectives and explicitly specify lighting, texture, camera angle, and atmosphere.
2. Describe the scene as a living world, not a drawing being redone. What's happening right now? Who's there? What time of day, what's the light like, what's the feeling in the air?
3. Pick ONE specific warm illustration style that fits the scene's spirit — e.g. "soft dreamlike watercolor with glowing light and atmospheric haze", "warm storybook illustration with confident ink outlines and rich gouache fills", "twilight pastel palette with soft painterly texture", "bright saturated picture-book spread with crisp shapes and luminous color". Commit to it.
4. Keep the child's key choices central and recognizable — the characters stay in the same places, the colors stay as the dominant palette, the sun or moon or landmarks stay where placed.
5. Full bleed edge-to-edge composition filling the frame, no paper edges, no borders, no scan artifacts, creases removed, smooth clean surface.
6. End exactly with: "warm richly detailed storybook illustration, vivid color, crisp detail, 8k resolution, masterpiece, ready to print at 11x14 inches".

Example:
{"description":"This young artist has built something genuinely joyful here — a sunny cottage anchored by a smiling sun in the corner, drawn with the kind of cheerful confidence that makes every element feel exactly where it belongs. The dragon stands guard with a friendly posture, and the flowers reach upward like they're happy to be in this world. What's striking is how warmly it all holds together — this is a place you'd want to live in.","prompt":"Step inside this imagined world: a friendly dragon guarding a cozy cottage at the heart of a wildflower meadow, with a smiling golden sun glowing from the corner of the sky. It's mid-morning, the air is warm and drowsy, soft cinematic sunlight catches on every delicate petal, and the cottage windows glow softly from within. Rendered as a breathtaking, warm storybook illustration with confident ink linework and incredibly rich gouache fills — buttercup yellow, coral, sage green, warm terracotta. The atmosphere is magical, nostalgic, and incredibly detailed. Full bleed edge-to-edge composition filling the entire frame, no paper edges or borders, creases and scan artifacts removed, smooth clean surface. warm richly detailed storybook illustration, vivid color, crisp detail, 8k resolution, masterpiece, ready to print at 11x14 inches."}`,
          cache_control: { type: 'ephemeral' },
        }],
        messages: [{
          role: 'user',
          content: [{
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 }
          }, {
            type: 'text',
            text: `Step inside this child's drawing${artistName ? ` by ${artistName}` : ''}. Write a witness description of the world you see, and a prompt that renders that world as a real place. Reply with only the JSON object.`
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
