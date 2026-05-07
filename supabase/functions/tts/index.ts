const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_VOICE_ID = 'XB0fDUnXU5powFXDhCwa' // Charlotte
const MODEL_ID = 'eleven_multilingual_v2'

// Mirror of the curated voices in app/lib/voices.ts. We allowlist the
// ids here so a stray voice_id from the wire can't make us bill a
// random ElevenLabs voice. Update both files together when adding voices.
const ALLOWED_VOICE_IDS = new Set([
  'XB0fDUnXU5powFXDhCwa', // Charlotte
  'EXAVITQu4vr4xnSDxMaL', // Bella
  'pNInz6obpgDQGcFmaJgB', // Adam
  '21m00Tcm4TlvDq8ikWAM', // Rachel
  'ErXwobaYiN019PkySvjV', // Antoni
  'keLVje3aBMuRpxuu0bqO', // Crofty
])

function resolveVoiceId(requested: unknown): string {
  if (typeof requested === 'string' && ALLOWED_VOICE_IDS.has(requested)) return requested
  return DEFAULT_VOICE_ID
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { text, voice_id } = await req.json()
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'text required' }), { status: 400, headers: corsHeaders })
    }

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY')
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set')

    const VOICE_ID = resolveVoiceId(voice_id)

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.75,
          style: 0.6,
          use_speaker_boost: true,
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`ElevenLabs TTS error: ${res.status} ${err}`)
    }

    const audioBuffer = await res.arrayBuffer()
    const bytes = new Uint8Array(audioBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    const base64 = btoa(binary)

    return new Response(
      JSON.stringify({ audio: base64 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
