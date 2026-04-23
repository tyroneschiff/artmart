import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadPiece } from './download'
import { supabase } from './supabase'
import * as FileSystem from 'expo-file-system'
import { Share, Platform, Alert } from 'react-native'

vi.mock('expo-file-system', () => ({
  documentDirectory: 'file:///test-dir/',
  downloadAsync: vi.fn(() => Promise.resolve({ uri: 'file:///test-dir/drawup_123.jpg' })),
}))

describe('downloadPiece', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('throws error if not signed in', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as any)
    await expect(downloadPiece('123')).rejects.toThrow('Not signed in')
  })

  it('throws error if API returns error', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ 
      data: { session: { access_token: 'fake-token' } as any }, 
      error: null 
    } as any)
    
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve({ error: 'Failed to generate link' }),
    } as any)

    await expect(downloadPiece('123')).rejects.toThrow('Failed to generate link')
  })

  it('downloads and shares on iOS/Android', async () => {
    Platform.OS = 'ios'
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ 
      data: { session: { access_token: 'fake-token' } as any }, 
      error: null 
    } as any)
    
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve({ download_url: 'https://example.com/piece.jpg' }),
    } as any)

    await downloadPiece('123')

    expect(FileSystem.downloadAsync).toHaveBeenCalledWith('https://example.com/piece.jpg', 'file:///test-dir/drawup_123.jpg')
    expect(Share.share).toHaveBeenCalledWith({ url: 'file:///test-dir/drawup_123.jpg', title: 'Your Draw Up download' })
  })

  it('opens new window on web', async () => {
    Platform.OS = 'web'
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ 
      data: { session: { access_token: 'fake-token' } as any }, 
      error: null 
    } as any)
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve({ download_url: 'https://example.com/piece.jpg' }),
    } as any)
    
    // @ts-ignore
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => ({}) as any)

    await downloadPiece('123')

    expect(windowOpenSpy).toHaveBeenCalledWith('https://example.com/piece.jpg', '_blank')
    Platform.OS = 'ios' // reset
  })

  it('handles download error and shows alert', async () => {
    Platform.OS = 'ios'
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ 
      data: { session: { access_token: 'fake-token' } as any }, 
      error: null 
    } as any)
    
    vi.mocked(global.fetch).mockResolvedValue({
      json: () => Promise.resolve({ download_url: 'https://example.com/piece.jpg' }),
    } as any)

    vi.mocked(FileSystem.downloadAsync).mockRejectedValue(new Error('Network failure'))

    await downloadPiece('123')

    expect(Alert.alert).toHaveBeenCalledWith('Download Error', 'Network failure')
  })
})
