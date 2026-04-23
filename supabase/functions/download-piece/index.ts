import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v4.15.4/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let userId: string
    try {
      const { payload } = await jwtVerify(authHeader.replace('Bearer ', ''), JWKS, {
        issuer: `${SUPABASE_URL}/auth/v1`,
      })
      if (!payload.sub) throw new Error('missing sub')
      userId = payload.sub
    } catch (err) {
      console.error('JWT verify error:', err)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { piece_id } = await req.json()
    if (!piece_id) return new Response(JSON.stringify({ error: 'Missing piece_id' }), { status: 400, headers: corsHeaders })

    // Verify buyer has a paid digital order for this piece
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, piece_id')
      .eq('buyer_id', userId)
      .eq('piece_id', piece_id)
      .eq('order_type', 'digital')
      .eq('status', 'paid')
      .single()

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'No paid order found for this piece' }), { status: 403, headers: corsHeaders })
    }

    // Fetch the piece to get the stored transformed image path
    const { data: piece, error: pieceError } = await supabase
      .from('pieces')
      .select('transformed_image_url')
      .eq('id', piece_id)
      .single()

    if (pieceError || !piece) {
      return new Response(JSON.stringify({ error: 'Piece not found' }), { status: 404, headers: corsHeaders })
    }

    // Extract storage path from public URL
    const url = new URL(piece.transformed_image_url)
    const storagePath = url.pathname.split('/storage/v1/object/public/artwork/')[1]

    if (!storagePath) {
      return new Response(JSON.stringify({ error: 'Could not resolve storage path' }), { status: 500, headers: corsHeaders })
    }

    // Generate a signed URL valid for 1 hour
    const { data: signedData, error: signedError } = await supabase.storage
      .from('artwork')
      .createSignedUrl(storagePath, 3600)

    if (signedError || !signedData) {
      return new Response(JSON.stringify({ error: 'Could not generate download link' }), { status: 500, headers: corsHeaders })
    }

    return new Response(
      JSON.stringify({ download_url: signedData.signedUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})
