// Account deletion — Apple Section 5.1.1(v) compliance and basic
// user-respecting hygiene. Verifies the caller via JWT, then uses the
// service role to call auth.admin.deleteUser, which cascades through
// every table that references auth.users (profiles, stores, pieces,
// votes, comments, reports, subscriptions) and nulls the user_id in
// retained business records (orders, events, checkout_logs).
//
// Images in Supabase Storage are NOT auto-deleted here — they're
// orphaned and can be swept by a periodic job. For App Store
// compliance, deleting the auth user + cascading DB rows is enough;
// the storage objects can no longer be associated with the deleted
// user.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v4.15.4/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))

export const handler = async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) throw error

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('delete-account error:', e)
    return new Response(JSON.stringify({ error: e?.message || 'Failed to delete account' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

Deno.serve(handler)
