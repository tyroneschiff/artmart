import { describe, it, expect, vi } from 'vitest'
import { buildPieceShareMessage, buildStoreShareMessage, shareNative, shareToWhatsApp } from './share'
import { Share, Linking, Platform } from 'react-native'

describe('share lib', () => {
  it('builds piece share message correctly', () => {
    const payload = buildPieceShareMessage('Starry Night', 'Emma', '123')
    expect(payload.title).toContain("Emma's world")
    expect(payload.message).toContain('"Starry Night"')
    expect(payload.url).toBe('https://drawup.art/piece/123')
  })

  it('builds store share message correctly', () => {
    const payload = buildStoreShareMessage('Emma', 'emma-store')
    expect(payload.title).toContain("Emma's imagination")
    expect(payload.url).toBe('https://drawup.art/store/emma-store')
  })

  it('calls Share.share in shareNative', async () => {
    const payload = { title: 'T', message: 'M', url: 'U' }
    await shareNative(payload)
    expect(Share.share).toHaveBeenCalled()
  })

  it('calls Linking.openURL in shareToWhatsApp', async () => {
    await shareToWhatsApp('Hello')
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('wa.me'))
  })

  it('uses web URL for WhatsApp on web platform', async () => {
    // @ts-ignore
    Platform.OS = 'web'
    await shareToWhatsApp('Hello')
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('web.whatsapp.com'))
    // @ts-ignore
    Platform.OS = 'ios' // Reset
  })
})
