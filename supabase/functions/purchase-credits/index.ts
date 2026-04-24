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

async function verifyUser(req: Request): Promise<string> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized')
  const { payload } = await jwtVerify(authHeader.replace('Bearer ', ''), JWKS, {
    issuer: `${SUPABASE_URL}/auth/v1`,
  })
  if (!payload.sub) throw new Error('missing sub')
  return payload.sub
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const userId = await verifyUser(req).catch(() => {
      throw Object.assign(new Error('Unauthorized'), { status: 401 })
    })

    const body = await req.json().catch(() => ({}))

    // Confirm step: client sends payment_intent_id after presentPaymentSheet resolves
    if (body.payment_intent_id) {
      const intent = await stripe.paymentIntents.retrieve(body.payment_intent_id)

      if (intent.status !== 'succeeded') {
        return new Response(JSON.stringify({ error: 'Payment not confirmed' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { user_id, amount, type: intentType } = intent.metadata
      if (intentType !== 'credits' || user_id !== userId) {
        return new Response(JSON.stringify({ error: 'Intent mismatch' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: newBalance, error } = await supabase.rpc('grant_credits', {
        p_user_id: userId,
        p_amount: parseInt(amount),
        p_reason: 'purchase',
        p_stripe_payment_intent: intent.id,
      })
      if (error) throw new Error(`Failed to grant credits: ${error.message}`)

      return new Response(JSON.stringify({ credits: newBalance }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create step: returns a PaymentIntent client_secret
    let priceCents = 999
    let creditAmount = 12

    if (body.amount === 3) {
      priceCents = 299
      creditAmount = 3
    } else if (body.amount === 12) {
      priceCents = 999
      creditAmount = 12
    } else if (body.amount === 25) {
      priceCents = 1999
      creditAmount = 25
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
      JSON.stringify({ client_secret: paymentIntent.client_secret, payment_intent_id: paymentIntent.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: e.status ?? 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
