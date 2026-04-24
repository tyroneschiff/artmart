import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v4.15.4/index.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-04-10' })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))

Deno.serve(async (req) => {
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

    // Default to Imagination Pack if not specified or invalid
    const { amount: requestedAmount } = await req.json().catch(() => ({}))
    
    let priceCents = 999
    let creditAmount = 12
    
    if (requestedAmount === 3) {
      priceCents = 299
      creditAmount = 3
    } else if (requestedAmount === 12) {
      priceCents = 999
      creditAmount = 12
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: priceCents,
        currency: 'usd',
        metadata: {
          user_id: String(userId),
          type: 'credits',
          amount: String(creditAmount),
        },
      },
      { idempotencyKey: `credits-${userId}-${creditAmount}-${Date.now()}` }
    )

    return new Response(
      JSON.stringify({ client_secret: paymentIntent.client_secret }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})
