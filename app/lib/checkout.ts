import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native'

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
    if (err.message === 'Network request failed') {
      throw new Error("We couldn't connect to the server. Please check your network and try again.")
    }
    throw err
  }
}

export async function purchaseCredits(userToken: string, amount?: number): Promise<number> {
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
    throw new Error(presentError.message)
  }

  const confirmRes = await fetchWithTimeout(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/purchase-credits`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ payment_intent_id: json.payment_intent_id }),
    }
  )

  if (!confirmRes.ok) {
    const body = await confirmRes.text()
    throw new Error(`Failed to confirm credits: ${body}`)
  }

  const confirmJson = await confirmRes.json()
  if (confirmJson.error) throw new Error(confirmJson.error)

  return confirmJson.credits as number
}
