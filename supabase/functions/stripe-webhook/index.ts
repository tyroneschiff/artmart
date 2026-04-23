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
    .select('*, pieces(transformed_image_url, title, stores(child_name))')
    .single()

  if (!order) return new Response(JSON.stringify({ received: true }), { status: 200 })

  // Ensure we have a buyer email for confirmations
  if (!order.guest_email && !order.buyer_email && order.buyer_id) {
    const { data: userData } = await supabase.auth.admin.getUserById(order.buyer_id)
    if (userData.user?.email) {
      order.buyer_email = userData.user.email
      // Update the order with the buyer email for future reference
      await supabase.from('orders').update({ buyer_email: order.buyer_email }).eq('id', order.id)
    }
  }

  if (order_type === 'print' && order.shipping_address) {
    try {
      await createPrintfulOrder(order, supabase)
      
      // Send receipt/confirmation to buyer
      await sendPrintConfirmationEmail(order)

      // If it's a gift, send notification email to recipient
      if (order.gift_recipient_email) {
        await sendGiftEmail(order)
      }
    } catch (e) {
      console.error('Printful/Email error:', e)
      await supabase
        .from('orders')
        .update({ status: 'printful_failed' })
        .eq('id', order.id)
    }
  } else if (order_type === 'digital') {
    try {
      const signedUrl = await generateSignedUrl(order, supabase)
      // Always send download email to buyer (acts as receipt/delivery)
      await sendDigitalDownloadEmail(order, signedUrl)
      
      // If it's a gift, also send to the recipient
      if (order.gift_recipient_email) {
        await sendDigitalGiftEmail(order, signedUrl)
      }
    } catch (e) {
      console.error('Digital download error:', e)
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})

async function sendPrintConfirmationEmail(order: any) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.error('RESEND_API_KEY not set')
    return
  }

  const email = order.guest_email || order.buyer_email
  if (!email) {
    console.error('No email found for print confirmation')
    return
  }

  const pieceTitle = order.pieces?.title || 'your artwork'
  const childName = order.pieces?.stores?.child_name || 'the artist'
  const isGift = !!order.gift_recipient_email

  const subject = isGift ? `🎁 Your gift of "${pieceTitle}" is confirmed!` : `✨ Your print of "${pieceTitle}" is confirmed!`
  
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Draw Up <hello@drawup.art>',
      to: [email],
      subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #FEFAF3; padding: 40px; border-radius: 20px;">
          <h1 style="color: #1C1810; font-size: 24px; font-weight: 800; letter-spacing: -1px; margin-bottom: 20px;">The magic is in motion...</h1>
          <p style="color: #6B5E4E; font-size: 16px; line-height: 24px;">
            ${isGift 
              ? `Thank you for gifting <strong>"${pieceTitle}"</strong>. We're preparing this piece of ${childName}'s imagination to be shipped to <strong>${order.gift_recipient_email}</strong>.`
              : `Thank you for bringing <strong>"${pieceTitle}"</strong> by ${childName} home. We're preparing your museum-quality print and will ship it soon.`}
          </p>
          
          <div style="margin: 30px 0;">
            <img src="${order.pieces?.transformed_image_url}" alt="${pieceTitle}" style="width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
          </div>
          
          <p style="color: #6B5E4E; font-size: 14px;">We'll notify you when it ships. If you have any questions, just reply to this email.</p>
          <p style="color: #A89880; font-size: 14px;">Keep creating,<br>The Draw Up Team</p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    console.error('Failed to send print confirmation email:', error)
  }
}

async function generateSignedUrl(order: any, supabase: any) {
  if (!order.pieces?.transformed_image_url) {
    throw new Error('No transformed_image_url found for digital order')
  }

  // Extract storage path from public URL
  const url = new URL(order.pieces.transformed_image_url)
  const storagePath = url.pathname.split('/storage/v1/object/public/artwork/')[1]
  
  if (!storagePath) {
    throw new Error('Could not resolve storage path for digital download')
  }

  // Generate signed URL valid for 7 days
  const { data: signedData, error: signedError } = await supabase.storage
    .from('artwork')
    .createSignedUrl(storagePath, 604800)

  if (signedError || !signedData) {
    throw new Error('Could not generate signed URL for digital download')
  }
  
  return signedData.signedUrl
}

async function sendDigitalDownloadEmail(order: any, signedUrl: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.error('RESEND_API_KEY not set')
    return
  }

  const email = order.guest_email || order.buyer_email
  if (!email) {
    console.error('No email found for digital order')
    return
  }

  const pieceTitle = order.pieces?.title || 'your artwork'
  
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Draw Up <hello@drawup.art>',
      to: [email],
      subject: '✨ Your digital artwork is ready!',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #FEFAF3; padding: 40px; border-radius: 20px;">
          <h1 style="color: #1C1810; font-size: 24px; font-weight: 800; letter-spacing: -1px; margin-bottom: 20px;">Step inside the imagination...</h1>
          <p style="color: #6B5E4E; font-size: 16px; line-height: 24px;">Thank you for your purchase of <strong>"${pieceTitle}"</strong>. You can download your high-resolution digital file using the button below:</p>
          
          <div style="margin: 30px 0; text-align: center;">
            <a href="${signedUrl}" style="background-color: #E8A020; color: #FFFFFF; padding: 16px 32px; border-radius: 100px; text-decoration: none; font-weight: 800; display: inline-block;">Download Artwork</a>
          </div>

          <div style="margin: 30px 0;">
            <img src="${order.pieces?.transformed_image_url}" alt="${pieceTitle}" style="width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
          </div>
          
          <p style="color: #6B5E4E; font-size: 14px;">This link will be valid for 7 days. If you need help, just reply to this email.</p>
          <p style="color: #A89880; font-size: 14px;">Keep creating,<br>The Draw Up Team</p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    console.error('Failed to send digital download email:', error)
  }
}

async function sendDigitalGiftEmail(order: any, signedUrl: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.error('RESEND_API_KEY not set')
    return
  }

  const pieceTitle = order.pieces?.title || 'your artwork'
  const childName = order.pieces?.stores?.child_name || 'the artist'
  const giftMessage = order.gift_message ? `<p style="color: #6B5E4E; font-size: 16px; font-style: italic; margin-bottom: 20px;">"${order.gift_message}"</p>` : ''

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Draw Up <hello@drawup.art>',
      to: [order.gift_recipient_email],
      subject: '🎁 You have a gift! ✨',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #FEFAF3; padding: 40px; border-radius: 20px;">
          <h1 style="color: #1C1810; font-size: 24px; font-weight: 800; letter-spacing: -1px; margin-bottom: 20px;">Someone stepped inside the imagination for you...</h1>
          <p style="color: #6B5E4E; font-size: 16px; line-height: 24px; margin-bottom: 20px;">You've been gifted a high-resolution digital copy of <strong>"${pieceTitle}"</strong> by ${childName}.</p>
          
          ${giftMessage}

          <div style="margin: 30px 0; text-align: center;">
            <a href="${signedUrl}" style="background-color: #E8A020; color: #FFFFFF; padding: 16px 32px; border-radius: 100px; text-decoration: none; font-weight: 800; display: inline-block;">Download Gift</a>
          </div>

          <div style="margin: 30px 0;">
            <img src="${order.pieces?.transformed_image_url}" alt="${pieceTitle}" style="width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
          </div>
          
          <p style="color: #6B5E4E; font-size: 14px;">This link will be valid for 7 days.</p>
          <p style="color: #A89880; font-size: 14px;">Keep creating,<br>The Draw Up Team</p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    console.error('Failed to send digital gift email:', error)
  }
}

async function sendGiftEmail(order: any) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.error('RESEND_API_KEY not set')
    return
  }

  const childName = order.pieces?.stores?.child_name || 'a young artist'
  const pieceTitle = order.pieces?.title || 'a beautiful artwork'
  const giftMessage = order.gift_message ? `<p><em>"${order.gift_message}"</em></p>` : ''

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Draw Up <hello@drawup.art>',
      to: [order.gift_recipient_email],
      subject: '✨ A gift is coming!',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #FEFAF3; padding: 40px; border-radius: 20px;">
          <h1 style="color: #1C1810; font-size: 24px; font-weight: 800; letter-spacing: -1px; margin-bottom: 20px;">Someone stepped inside ${childName}'s imagination for you...</h1>
          <p style="color: #6B5E4E; font-size: 16px; line-height: 24px;">A physical print of <strong>"${pieceTitle}"</strong> is being prepared and will be shipped to you soon.</p>
          ${giftMessage}
          <div style="margin: 30px 0;">
            <img src="${order.pieces?.transformed_image_url}" alt="${pieceTitle}" style="width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
          </div>
          <p style="color: #A89880; font-size: 14px;">This magic was made possible by Draw Up.</p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    console.error('Failed to send email:', error)
  }
}

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
