import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native'
import { ShippingAddress } from '../components/GiftingModal'

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 30000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timeout)
    return res
  } catch (err: any) {
    clearTimeout(timeout)
    if (err.name === 'AbortError') {
      throw new Error('Connection timed out. Please check your network and try again.')
    }
    // Handle standard React Native fetch error for offline state
    if (err.message === 'Network request failed') {
      throw new Error('We couldn\'t connect to the server. Please check your network and try again.')
    }
    throw err
  }
}

async function logCheckoutError(
  params: {
    piece_id?: string;
    error_code: string;
    error_message: string;
    payment_intent_id?: string;
    metadata?: any;
  },
  userToken?: string
) {
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    if (userToken) {
      headers['Authorization'] = `Bearer ${userToken}`
    }

    await fetchWithTimeout(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/log-checkout-error`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      },
      5000 // 5s timeout for logging
    ).catch(e => console.error('Silent failure logging checkout error:', e))
  } catch (err) {
    console.error('Failed to log checkout error:', err)
  }
}

export async function purchasePiece(
  pieceId: string,
  orderType: 'digital' | 'print',
  userToken?: string, // Made optional
  shippingAddress?: ShippingAddress,
  guestEmail?: string,
  recipientEmail?: string,
  giftMessage?: string,
  quantity: number = 1
): Promise<void> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  if (userToken) {
    headers['Authorization'] = `Bearer ${userToken}`
  }

  const res = await fetchWithTimeout(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-intent`,
    {
      method: 'POST',
      headers, // Use the dynamically created headers
      body: JSON.stringify({
        piece_id: pieceId,
        order_type: orderType,
        shipping_address: shippingAddress ?? null,
        guest_email: guestEmail ?? null,
        recipient_email: recipientEmail ?? null,
        gift_message: giftMessage ?? null,
        quantity,
      }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Server error ${res.status}: ${body}`)
  }

  const json = await res.json()
  if (json.error) throw new Error(json.error)
  if (!json.client_secret) throw new Error(`No client secret returned. Response: ${JSON.stringify(json)}`)

  const { error: initError } = await initPaymentSheet({
    merchantDisplayName: 'Draw Up',
    paymentIntentClientSecret: json.client_secret,
    defaultBillingDetails: {},
  })
  if (initError) throw new Error(initError.message)

  const { error: presentError } = await presentPaymentSheet()
  if (presentError) {
    if (presentError.code === 'Canceled') throw new Error('Canceled')
    
    // Log the failure for reliability tracking
    const payment_intent_id = json.client_secret.split('_secret')[0]
    logCheckoutError({
      piece_id: pieceId,
      error_code: presentError.code,
      error_message: presentError.message,
      payment_intent_id,
      metadata: { orderType }
    }, userToken)

    throw new Error(presentError.message)
  }
}

export async function purchaseCredits(userToken: string, amount?: number): Promise<void> {
  const res = await fetchWithTimeout(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/purchase-credits`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: amount ? JSON.stringify({ amount }) : undefined,
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Server error ${res.status}: ${body}`)
  }

  const json = await res.json()
  if (json.error) throw new Error(json.error)

  const { error: initError } = await initPaymentSheet({
    merchantDisplayName: 'Draw Up',
    paymentIntentClientSecret: json.client_secret,
    defaultBillingDetails: {},
  })
  if (initError) throw new Error(initError.message)

  const { error: presentError } = await presentPaymentSheet()
  if (presentError) {
    if (presentError.code === 'Canceled') throw new Error('Canceled')
    
    // Log the failure for reliability tracking
    const payment_intent_id = json.client_secret.split('_secret')[0]
    logCheckoutError({
      error_code: presentError.code,
      error_message: presentError.message,
      payment_intent_id,
      metadata: { type: 'credits', amount }
    }, userToken)

    throw new Error(presentError.message)
  }
}
