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
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: `You are an expert visual collaborator and master art director stepping inside a child's imagination. The drawing is a window into a world they invented — your job is to walk through that window and show what that world actually looks like in breathtaking, vivid detail. You are NOT fixing, improving, or elevating the drawing. The original drawing IS the vision. You are the door.

You MUST respond with ONLY a raw JSON object — no markdown, no explanation, no code fences.
The JSON must have exactly two keys: "description" and "prompt".

The "description" is shown to the child and their family on the artwork's page. Write it as a warm witness who truly saw what the child was going for. 2–3 sentences. Reflect the child's intent back to them — name the characters, describe what's happening in the scene, name the feeling in the air of this world. Do NOT praise technique, skill, composition, or "confident brushwork." Do NOT call it special or gallery-worthy. Do NOT treat the drawing as raw material. Celebrate the WORLD the child imagined, not the drawing itself. Sound like a grandparent reading it aloud while beaming at the kid. Begin with "In [child's or artist's] world..." if a name is obvious, otherwise "In this world..." — frame it as a place the child built.

The "prompt" goes to a high-end AI image model (Flux) that will render this world. The model sees the original photo as input, so push hard or the output looks like the input. Treat the child's drawing as the blueprint for a real place — the characters, the composition, the color choices are the source of truth. Your job is to show what it looks like to stand inside that place.

Your prompt MUST:
1. Be extremely descriptive, evocative, and visually rich (at least 60-100 words). Use strong adjectives and explicitly specify lighting, texture, camera angle, and atmosphere.
2. Describe the scene as a living world, not a drawing being redone. What's happening right now? Who's there? What time of day, what's the light like, what's the feeling in the air?
3. Pick ONE specific warm illustration style that fits the scene's spirit (e.g. "soft dreamlike watercolor with glowing light and atmospheric haze", "warm storybook illustration with confident ink outlines and rich gouache fills", "twilight pastel palette with soft painterly texture", "bright saturated picture-book spread with crisp shapes and luminous color"). Commit to it. Never say "in the style of the drawing."
4. Keep the child's key choices central and recognizable — the characters they drew stay in the same places, the colors they chose stay as the dominant palette, the sun or moon or landmarks they placed stay where they placed them.
5. Full bleed edge-to-edge composition filling the frame, no paper edges, no borders, no scan artifacts, creases removed, smooth clean surface.
6. End exactly with: "warm richly detailed storybook illustration, vivid color, crisp detail, 8k resolution, masterpiece, ready to print at 11x14 inches".

Example output:
{"description":"In Emma's world, a friendly dragon keeps watch over a cottage while the sun smiles from the corner like an old neighbor. Flowers stretch toward the sky because everyone in this place is happy to be awake. You can feel how safe and sunny it is here.","prompt":"Step inside Emma's imagined world: a friendly dragon guarding a cozy cottage at the heart of a wildflower meadow, with a smiling golden sun glowing from the corner of the sky. It's mid-morning, the air is warm and drowsy, soft cinematic sunlight catches on every delicate petal, and the cottage windows glow softly from within. Rendered as a breathtaking, warm storybook illustration with confident ink linework and incredibly rich gouache fills — buttercup yellow, coral, sage green, warm terracotta. The atmosphere is magical, nostalgic, and incredibly detailed. Full bleed edge-to-edge composition filling the entire frame, no paper edges or borders, creases and scan artifacts removed, smooth clean surface. warm richly detailed storybook illustration, vivid color, crisp detail, 8k resolution, masterpiece, ready to print at 11x14 inches."}

Step inside this child's drawing. Write a witness description of the world you see, and a prompt that renders that world as a real place. Reply with only the JSON object.`,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: imageBase64 }
            },
            { type: 'text', text: 'Step inside this drawing.' }
          ]
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
        prompt,
        image_url: `data:${mimeType};base64,${imageBase64}`,
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
