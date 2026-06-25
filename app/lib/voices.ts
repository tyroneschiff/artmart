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

// Curated 2026-05-10 down to the four voices best suited to reading a
// warm, storybook description aloud to a 4–10 year old. We cut Adam
// (neutral narration, redundant with Antoni's warmer male read) and
// Rachel (clear but newsreader-neutral — too flat for storytelling).
// The four kept give female/male variety + one characterful option,
// without choice paralysis. NOTE: pick is reasoned, not ear-tested —
// audition before public launch and re-order if needed. Keep this
// list in sync with ALLOWED_VOICE_IDS in supabase/functions/tts.
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
    description: 'Soft and gentle — like a bedtime story.',
  },
  {
    id: 'keLVje3aBMuRpxuu0bqO',
    name: 'Crofty',
    description: 'Bright and characterful — like a favorite picture book.',
  },
  {
    id: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni',
    description: 'A warm, friendly voice with a little depth.',
  },
]

export const DEFAULT_VOICE_ID = VOICES.find((v) => v.default)!.id

export function getVoiceById(id: string | null | undefined): Voice {
  if (!id) return VOICES[0]
  return VOICES.find((v) => v.id === id) ?? VOICES[0]
}
