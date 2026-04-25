const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VOICE_ID = 'SuZjJOmejdKQNzQbif43'
const MODEL_ID = 'eleven_flash_v2_5'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { text } = await req.json()
    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'text required' }), { status: 400, headers: corsHeaders })
    }

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY')
    if (!apiKey) throw new Error('ELEVENLABS_API_KEY not set')

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_22050_32`, {
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
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.35,
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
