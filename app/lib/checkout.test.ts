import { describe, it, expect, vi, beforeEach } from 'vitest'
import { purchasePiece, purchaseCredits } from './checkout'
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native'

// Mock Stripe
vi.mock('@stripe/stripe-react-native', () => ({
  initPaymentSheet: vi.fn(() => Promise.resolve({ error: null })),
  presentPaymentSheet: vi.fn(() => Promise.resolve({ error: null })),
}))

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('checkout lib', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    
    // Default success for Stripe
    vi.mocked(initPaymentSheet).mockResolvedValue({ error: null } as any)
    vi.mocked(presentPaymentSheet).mockResolvedValue({ error: null } as any)
  })

  it('purchasePiece calls create-payment-intent and shows Stripe sheet', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ client_secret: 'pi_123_secret' }),
    })

    await purchasePiece('piece_1', 'digital', 'token_123')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/create-payment-intent'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token_123',
        }),
      })
    )
    expect(initPaymentSheet).toHaveBeenCalled()
    expect(presentPaymentSheet).toHaveBeenCalled()
  })

  it('purchasePiece passes quantity parameter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ client_secret: 'pi_123_secret' }),
    })

    await purchasePiece('piece_1', 'print', 'token_123', undefined, undefined, undefined, undefined, 2)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"quantity":2'),
      })
    )
  })

  it('purchasePiece handles server failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request'),
    })
    await expect(purchasePiece('p', 'digital')).rejects.toThrow('Server error 400')
  })

  it('purchasePiece handles initPaymentSheet error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ client_secret: 'pi_123' }),
    })
    vi.mocked(initPaymentSheet).mockResolvedValueOnce({ error: { message: 'Init failed' } } as any)

    await expect(purchasePiece('p', 'digital')).rejects.toThrow('Init failed')
  })

  it('purchasePiece handles presentPaymentSheet generic error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ client_secret: 'pi_123' }),
    })
    vi.mocked(presentPaymentSheet).mockResolvedValueOnce({ error: { message: 'Present failed', code: 'Failed' } } as any)

    await expect(purchasePiece('p', 'digital')).rejects.toThrow('Present failed')
  })

  it('purchasePiece handles presentPaymentSheet cancellation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ client_secret: 'pi_123' }),
    })
    vi.mocked(presentPaymentSheet).mockResolvedValueOnce({ error: { code: 'Canceled' } } as any)

    await expect(purchasePiece('p', 'digital')).rejects.toThrow('Canceled')
  })

  it('purchasePiece handles network timeout', async () => {
    mockFetch.mockRejectedValueOnce({ name: 'AbortError' })
    await expect(purchasePiece('p', 'digital')).rejects.toThrow('Connection timed out')
  })

  it('purchasePiece handles network failure (offline)', async () => {
    mockFetch.mockRejectedValueOnce({ message: 'Network request failed' })
    await expect(purchasePiece('p', 'digital')).rejects.toThrow('We couldn\'t connect to the server')
  })

  it('purchaseCredits handles successful payment flow', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ client_secret: 'pi_credits_secret' }),
    })

    await purchaseCredits('token_123')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/purchase-credits'),
      expect.any(Object)
    )
    expect(presentPaymentSheet).toHaveBeenCalled()
  })

  it('purchaseCredits handles generic present error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ client_secret: 'pi_c' }),
    })
    vi.mocked(presentPaymentSheet).mockResolvedValueOnce({ error: { message: 'Stripe broke', code: 'Failed' } } as any)
    await expect(purchaseCredits('t')).rejects.toThrow('Stripe broke')
  })

  it('purchaseCredits handles server error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauth'),
    })
    await expect(purchaseCredits('t')).rejects.toThrow('Server error 401')
  })

  it('purchaseCredits handles JSON error body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ error: 'Too many credits' }),
    })
    await expect(purchaseCredits('t')).rejects.toThrow('Too many credits')
  })

  it('purchaseCredits handles Stripe cancellation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ client_secret: 'pi_c' }),
    })
    vi.mocked(presentPaymentSheet).mockResolvedValueOnce({ error: { code: 'Canceled' } } as any)
    await expect(purchaseCredits('t')).rejects.toThrow('Canceled')
  })
})
