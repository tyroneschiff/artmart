import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v4.15.4/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let userId: string | null = null
    const authHeader = req.headers.get('Authorization')
    const { piece_id, error_code, error_message, payment_intent_id, metadata } = await req.json()

    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { payload } = await jwtVerify(authHeader.replace('Bearer ', ''), JWKS, {
          issuer: `${SUPABASE_URL}/auth/v1`,
        })
        if (payload.sub) {
          userId = payload.sub
        }
      } catch (err) {
        // We don't fail if JWT is invalid, we just log without user_id
        console.error('JWT verify error (logged as guest):', err)
      }
    }

    const { error: insertError } = await supabase.from('checkout_logs').insert({
      user_id: userId,
      piece_id: piece_id || null,
      error_code: String(error_code || 'unknown'),
      error_message: String(error_message || 'No error message provided'),
      payment_intent_id: payment_intent_id || null,
      metadata: metadata || {},
    })

    if (insertError) {
       console.error('Failed to insert into checkout_logs:', insertError)
       return new Response(JSON.stringify({ error: 'Failed to record log' }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ status: 'logged' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})
