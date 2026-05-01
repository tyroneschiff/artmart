import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v4.15.4/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))

export const handler = async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

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
    } catch (err) {
      console.error('JWT verify error:', err)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { piece_id, content } = await req.json()
    if (!piece_id || !content) return new Response(JSON.stringify({ error: 'Missing piece_id or content' }), { status: 400, headers: corsHeaders })

    if (content.length > 300) return new Response(JSON.stringify({ error: 'Comment too long' }), { status: 400, headers: corsHeaders })

    // Rate limit check: 1 per 30s (anti-flood; AI moderation handles abuse)
    const { data: lastComment } = await supabase
      .from('comments')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastComment) {
      const lastTime = new Date(lastComment.created_at).getTime()
      const now = new Date().getTime()
      if (now - lastTime < 30 * 1000) {
        return new Response(JSON.stringify({ error: 'Hold on a sec — wait a moment before posting again.' }), { status: 429, headers: corsHeaders })
      }
    }

    // Gemini Moderation
    const geminiKey = Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY')
    if (!geminiKey) throw new Error('Missing GOOGLE_GENERATIVE_AI_API_KEY')

    const prompt = `You are a content moderator for a children's art application. 
Your job is to ensure comments are safe, kind, and appropriate for families and children.

Rules:
1. No profanity or offensive language.
2. No bullying or harassment.
3. No sexual content.
4. No personal identifiable information (PII).
5. No spam or nonsensical text.

Comment to moderate: "${content}"

Respond with ONLY a raw JSON object:
{"safe": true/false, "reason": "short explanation if unsafe"}
`

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      }),
    })

    if (!geminiRes.ok) throw new Error(`Gemini API error: ${await geminiRes.text()}`)

    const geminiData = await geminiRes.json()
    const moderation = JSON.parse(geminiData.candidates[0].content.parts[0].text)

    if (!moderation.safe) {
      return new Response(JSON.stringify({ error: `Comment rejected: ${moderation.reason}` }), { status: 400, headers: corsHeaders })
    }

    // Insert comment
    const { data: comment, error: insertError } = await supabase
      .from('comments')
      .insert({
        piece_id,
        user_id: userId,
        content: content.trim(),
      })
      .select('*, profiles(display_name)')
      .single()

    if (insertError) throw insertError

    return new Response(JSON.stringify(comment), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
}

Deno.serve(handler)
