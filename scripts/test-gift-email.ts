import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function testGiftEmail() {
  console.log('🚀 Starting Gift Email Integration Test...')

  // 1. Get a test piece
  const { data: piece, error: pieceError } = await supabase
    .from('pieces')
    .select('id, title, transformed_image_url, stores(child_name)')
    .limit(1)
    .single()

  if (pieceError || !piece) {
    console.error('❌ Could not find a piece to test with:', pieceError)
    return
  }

  console.log(`📝 Using piece: "${piece.title}" by ${piece.stores?.child_name}`)

  // 2. Create a fake "paid" order with gift info
  const testEmail = 'test@example.com' // Replace with your email to actually see it
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      piece_id: piece.id,
      order_type: 'print',
      status: 'pending', // Webhook will update to 'paid'
      stripe_payment_intent: `test_intent_${Date.now()}`,
      gift_recipient_email: testEmail,
      gift_message: 'Step inside this world I found for you!',
      shipping_address: {
        name: 'Test Recipient',
        address1: '123 Magic Lane',
        city: 'Imagination',
        country_code: 'US',
        zip: '12345'
      }
    })
    .select()
    .single()

  if (orderError) {
    console.error('❌ Failed to create test order:', orderError)
    return
  }

  console.log(`✅ Created test order: ${order.id}`)

  // 3. Manually trigger the "Logic" that the webhook would run
  // Since we can't easily hit the local Edge Function from here without local-serve,
  // we are testing the database side. 
  // To truly test the email, you'd need to invoke the Edge Function with a mock Stripe event.
  
  console.log('🔗 To fully verify, run: supabase functions serve')
  console.log(`💡 Then run a curl to the local webhook with the payment_intent.succeeded event for intent: ${order.stripe_payment_intent}`)
}

testGiftEmail()
