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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let buyerId: string | null = null
    const authHeader = req.headers.get('Authorization')
    const { 
      piece_id, 
      order_type, 
      shipping_address, 
      guest_email, 
      recipient_email, 
      gift_message,
      quantity = 1 
    } = await req.json()

    // Authentication Logic
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { payload } = await jwtVerify(authHeader.replace('Bearer ', ''), JWKS, {
          issuer: `${SUPABASE_URL}/auth/v1`,
        })
        if (payload.sub) {
          buyerId = payload.sub
        }
      } catch (err) {
        console.error('JWT verify error:', err)
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    if (!buyerId) {
      // No auth or failed auth
      if (!guest_email) {
        return new Response(JSON.stringify({ error: `Guest email required for guest ${order_type} orders` }), { status: 400, headers: corsHeaders })
      }
    }

    if (!piece_id || !order_type) return new Response(JSON.stringify({ error: 'Missing piece_id or order_type' }), { status: 400, headers: corsHeaders })
    if (order_type === 'print' && !shipping_address) return new Response(JSON.stringify({ error: 'Shipping address required for print orders' }), { status: 400, headers: corsHeaders })

    const { data: piece, error: pieceError } = await supabase
      .from('pieces')
      .select('id, title, price_digital, price_print, published')
      .eq('id', piece_id)
      .single()

    if (pieceError || !piece) return new Response(JSON.stringify({ error: 'Piece not found' }), { status: 404, headers: corsHeaders })
    if (!piece.published) return new Response(JSON.stringify({ error: 'Piece not published' }), { status: 400, headers: corsHeaders })

    let amount = order_type === 'digital' ? piece.price_digital : piece.price_print

    // Discount Logic
    let isFirstOrder = false
    if (buyerId) {
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('buyer_id', buyerId)
        .eq('status', 'paid')
      
      isFirstOrder = count === 0
    }

    if (isFirstOrder) {
      // First order special: 20% off
      amount = Math.round(amount * 0.8)
    } else if (order_type === 'print') {
      // Apply 10% discount for physical print if digital version is already owned (only if not first order)
      const { data: digitalOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('piece_id', piece_id)
        .eq('order_type', 'digital')
        .eq('status', 'paid')
        .or(`buyer_id.eq.${buyerId},guest_email.eq.${guest_email}`)
        .maybeSingle()

      if (digitalOrder) {
        amount = Math.round(amount * 0.9)
      }
    }

    let totalAmount = amount * quantity

    // Apply 15% discount for bulk print orders (2 or more)
    if (order_type === 'print' && quantity >= 2) {
      totalAmount = Math.round(totalAmount * 0.85)
    }

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmount,
        currency: 'usd',
        metadata: {
          piece_id,
          order_type,
          quantity: quantity.toString(),
          buyer_id: buyerId ?? undefined, // Stripe metadata doesn't like null, use undefined
          guest_email: guest_email ?? undefined,
          gift_recipient_email: recipient_email ?? undefined,
          gift_message: gift_message ?? undefined,
          piece_title: piece.title,
        },
      },
      { idempotencyKey: `${buyerId ?? guest_email}-${piece_id}-${order_type}-${Date.now()}` }
    )

    // Delete existing pending/failed orders (only for authenticated users, to avoid deleting guest orders by mistake)
    if (buyerId) {
        await supabase
        .from('orders')
        .delete()
        .eq('buyer_id', buyerId)
        .eq('piece_id', piece_id)
        .eq('order_type', order_type)
        .in('status', ['pending', 'failed'])
    }


    const { error: insertError } = await supabase.from('orders').insert({
      buyer_id: buyerId,
      piece_id,
      order_type,
      quantity,
      stripe_payment_intent: paymentIntent.id,
      status: 'pending',
      shipping_address: shipping_address ?? null,
      guest_email: guest_email ?? null,
      gift_recipient_email: recipient_email ?? null,
      gift_message: gift_message ?? null,
    })

    if (insertError) {
      return new Response(JSON.stringify({ error: 'Failed to record order, please try again' }), { status: 500, headers: corsHeaders })
    }

    return new Response(
      JSON.stringify({ client_secret: paymentIntent.client_secret }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})
