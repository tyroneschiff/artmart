// Curated ElevenLabs voice catalog for the Read Aloud feature.
//
// Keep this list short — choice paralysis kills delight. The first
// entry is the default; if a user has no `tts_voice_id` set, the
// system default (Charlotte, also the first entry here) is used.
//
// To preview a voice the picker calls the `tts` edge function with
// the voice_id and a fixed sample sentence; the resulting MP3 is
// cached in FileSystem.cacheDirectory keyed by voice_id so each user
// only pays the ElevenLabs cost once per voice per device.

export type Voice = {
  id: string
  name: string
  description: string
  default?: boolean
}

export const SAMPLE_TEXT = "Hi! I'd love to read your story to you."

export const VOICES: Voice[] = [
  {
    id: 'XB0fDUnXU5powFXDhCwa',
    name: 'Charlotte',
    description: 'Warm storyteller — the original Draw Up voice.',
    default: true,
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Bella',
    description: 'Soft and sweet — feels like a lullaby.',
  },
  {
    id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    description: 'A warm dad voice with depth.',
  },
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    description: 'Calm and steady — perfect for bedtime.',
  },
  {
    id: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni',
    description: 'Friendly uncle reading to the room.',
  },
]

export const DEFAULT_VOICE_ID = VOICES.find((v) => v.default)!.id

export function getVoiceById(id: string | null | undefined): Voice {
  if (!id) return VOICES[0]
  return VOICES.find((v) => v.id === id) ?? VOICES[0]
}
