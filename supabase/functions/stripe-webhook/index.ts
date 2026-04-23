import Stripe from 'https://esm.sh/stripe@14?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-04-10' })

// Printful variant ID for Enhanced Matte Paper Poster 11x14"
const PRINTFUL_POSTER_VARIANT_ID = 14125

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature!, webhookSecret)
  } catch (e) {
    return new Response(JSON.stringify({ error: `Webhook error: ${e.message}` }), { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent
    await supabase
      .from('orders')
      .update({ status: 'failed' })
      .eq('stripe_payment_intent', intent.id)
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  }

  if (event.type !== 'payment_intent.succeeded') {
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  }

  const intent = event.data.object as Stripe.PaymentIntent
  const { type, user_id, amount } = intent.metadata

  if (type === 'credits' && user_id && amount) {
    const { error } = await supabase.rpc('grant_credits', {
      p_user_id: user_id,
      p_amount: parseInt(amount),
      p_reason: 'purchase',
      p_stripe_payment_intent: intent.id,
    })
    if (error) return new Response(JSON.stringify({ error: `Failed to grant credits: ${error.message}` }), { status: 500 })
    return new Response(JSON.stringify({ received: true }), { status: 200 })
  }

  const { order_type } = intent.metadata

  const { data: order } = await supabase
    .from('orders')
    .update({ status: 'paid' })
    .eq('stripe_payment_intent', intent.id)
    .select('*, pieces(transformed_image_url, title)')
    .single()

  if (order_type === 'print' && order?.shipping_address) {
    try {
      await createPrintfulOrder(order, supabase)
    } catch (e) {
      await supabase
        .from('orders')
        .update({ status: 'printful_failed' })
        .eq('id', order.id)
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})

async function createPrintfulOrder(order: any, supabase: any) {
  const printfulKey = Deno.env.get('PRINTFUL_API_KEY')
  if (!printfulKey) throw new Error('PRINTFUL_API_KEY not set')

  const addr = order.shipping_address
  const imageUrl = order.pieces?.transformed_image_url
  if (!imageUrl) throw new Error('Missing transformed_image_url on order')

  const body = {
    recipient: {
      name: addr.name,
      address1: addr.address1,
      address2: addr.address2 ?? '',
      city: addr.city,
      state_code: addr.state_code ?? '',
      country_code: addr.country_code,
      zip: addr.zip,
    },
    items: [{
      variant_id: PRINTFUL_POSTER_VARIANT_ID,
      quantity: 1,
      files: [{
        type: 'default',
        url: imageUrl,
      }],
    }],
    retail_costs: {
      currency: 'USD',
    },
  }

  const res = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${printfulKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (!res.ok || !data.result?.id) {
    throw new Error(data.error?.message ?? `Printful API error: ${res.status}`)
  }

  await supabase
    .from('orders')
    .update({ printful_order_id: String(data.result.id), status: 'fulfilling' })
    .eq('id', order.id)

  const confirmRes = await fetch(`https://api.printful.com/orders/${data.result.id}/confirm`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${printfulKey}` },
  })

  if (!confirmRes.ok) {
    throw new Error(`Printful confirm failed: ${confirmRes.status}`)
  }
}
