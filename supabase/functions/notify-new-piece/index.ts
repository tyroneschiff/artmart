// Email fanout when a parent publishes a new piece.
//
// Subscribers (followers of the gallery, excluding the owner) get an
// email with the child's name, the watermarked rendered world, and a
// deep link to the piece on drawup.ink.
//
// Debounce: at most one email per gallery per 6 hours. If a parent
// publishes 4 pieces in a row at bedtime, the followers get ONE email
// covering "Zadie drew new worlds" rather than four pings. We use the
// events table (event_type='notification_sent', store_id, channel)
// to record the last send and check window.
//
// Auth: caller must be the gallery owner. We verify the JWT and then
// check store.owner_id == jwt.sub before fanning out.
//
// Failures are non-fatal for the publisher: the app fires this
// function fire-and-forget after a successful publish. If Resend is
// down or the function errors, the publish still succeeded and the
// parent is unaware of the missed notification.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'
import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v4.15.4/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_ADDRESS = Deno.env.get('NOTIFY_FROM_ADDRESS') || 'Draw Up <hello@drawup.ink>'
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))

// 24h debounce: even if a parent publishes 5 pieces in a bedtime
// burst, followers only get one "new world" email per day per
// gallery. Less is better — each email should feel earned.
const DEBOUNCE_HOURS = 24

type Piece = {
  id: string
  title: string | null
  ai_description: string | null
  watermarked_image_url: string | null
  transformed_image_url: string | null
  store_id: string
  stores: {
    child_name: string
    slug: string
    owner_id: string
  }
}

function renderEmailHtml(opts: {
  childName: string
  pieceTitle: string | null
  description: string | null
  imageUrl: string
  galleryUrl: string
}) {
  const safeTitle = (opts.pieceTitle || `A new world`).replace(/[<>&]/g, '')
  const safeChild = opts.childName.replace(/[<>&]/g, '')
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FEFAF3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;color:#1C1810;line-height:1.5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#FEFAF3;">
    <tr><td align="center" style="padding:32px 20px;">
      <table role="presentation" width="480" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="font-weight:900;font-size:22px;letter-spacing:-1px;color:#1C1810;">draw <span style="color:#E8A020;">up</span></div>
        </td></tr>
        <tr><td style="background:#fff;border:1px solid #EDE4D0;border-radius:20px;overflow:hidden;">
          <img src="${opts.imageUrl}" alt="${safeChild} drew this" style="width:100%;height:auto;display:block;aspect-ratio:1/1;object-fit:cover;background:#EDE4D0;" />
          <div style="padding:24px;">
            <div style="font-size:12px;color:#A89880;font-weight:700;letter-spacing:.6px;text-transform:uppercase;margin-bottom:8px;">${safeChild} drew a new world</div>
            <h1 style="font-size:22px;font-weight:800;letter-spacing:-.4px;line-height:1.2;margin:0 0 12px 0;color:#1C1810;">${safeTitle}</h1>
            ${opts.description ? `<p style="color:#6B5E4E;font-size:15px;margin:0 0 20px 0;">${opts.description.replace(/[<>&]/g, '').slice(0, 280)}</p>` : ''}
            <a href="${opts.galleryUrl}" style="display:inline-block;background:#1C1810;color:#FEFAF3;text-decoration:none;font-weight:700;font-size:15px;padding:14px 24px;border-radius:999px;">Step inside</a>
          </div>
        </td></tr>
        <tr><td align="center" style="padding:24px 0 0 0;color:#A89880;font-size:12px;">
          You're getting this because you follow ${safeChild}'s gallery on Draw Up.<br>
          <a href="${opts.galleryUrl}" style="color:#6B5E4E;">Manage your subscriptions in the app.</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function sendResendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [to],
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend ${res.status}: ${body}`)
  }
  return res.json()
}

export const handler = async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!RESEND_API_KEY) {
      // Soft-fail when not configured so we don't break publish flow.
      console.warn('notify-new-piece: RESEND_API_KEY not set; skipping fanout.')
      return new Response(JSON.stringify({ ok: true, skipped: 'no_resend_key' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let callerId: string
    try {
      const { payload } = await jwtVerify(authHeader.replace('Bearer ', ''), JWKS, {
        issuer: `${SUPABASE_URL}/auth/v1`,
      })
      if (!payload.sub) throw new Error('missing sub')
      callerId = payload.sub
    } catch (err) {
      console.error('JWT verify error:', err)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { piece_id } = await req.json()
    if (!piece_id || typeof piece_id !== 'string') {
      return new Response(JSON.stringify({ error: 'piece_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // 1. Load the piece + store
    const { data: piece, error: pErr } = await admin
      .from('pieces')
      .select('id, title, ai_description, watermarked_image_url, transformed_image_url, store_id, stores(child_name, slug, owner_id)')
      .eq('id', piece_id)
      .single()
    if (pErr || !piece) throw new Error(`piece not found: ${pErr?.message || 'no row'}`)

    const p = piece as unknown as Piece

    // 2. Auth: caller must be the gallery owner. Prevents random
    //    accounts from spamming someone else's followers.
    if (p.stores.owner_id !== callerId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Debounce. If we already sent for this gallery within the
    //    DEBOUNCE_HOURS window, skip silently.
    const cutoffIso = new Date(Date.now() - DEBOUNCE_HOURS * 3600_000).toISOString()
    const { data: lastSent } = await admin
      .from('events')
      .select('id')
      .eq('event_type', 'notification_sent')
      .eq('store_id', p.store_id)
      .gte('created_at', cutoffIso)
      .limit(1)
      .maybeSingle()
    if (lastSent) {
      return new Response(JSON.stringify({ ok: true, skipped: 'debounced', store_id: p.store_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Fetch subscribers (email-enabled, not the owner).
    const { data: subs, error: sErr } = await admin
      .from('subscriptions')
      .select('subscriber_id')
      .eq('store_id', p.store_id)
      .eq('notify_email', true)
      .neq('subscriber_id', p.stores.owner_id)
    if (sErr) throw new Error(`subscriptions query: ${sErr.message}`)
    const subscriberIds = (subs || []).map((s: { subscriber_id: string }) => s.subscriber_id)

    if (subscriberIds.length === 0) {
      // No one to notify. Still log so debounce counts.
      await admin.from('events').insert({
        event_type: 'notification_sent',
        store_id: p.store_id,
        piece_id: p.id,
        metadata: { channel: 'email', recipient_count: 0, reason: 'no_subscribers' },
      })
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Resolve emails from auth.users via admin API (service role).
    //    listUsers paginates 1000 at a time; we filter client-side.
    //    For low subscriber counts this is fine; if galleries get to
    //    hundreds of followers we'll need a smarter lookup.
    const recipients: string[] = []
    for (const id of subscriberIds) {
      const { data, error } = await admin.auth.admin.getUserById(id)
      if (error) {
        console.warn(`could not resolve user ${id}: ${error.message}`)
        continue
      }
      if (data.user?.email) recipients.push(data.user.email)
    }

    // 6. Send.
    const imageUrl = p.watermarked_image_url || p.transformed_image_url || ''
    const galleryUrl = `https://drawup.ink/gallery/${p.stores.slug}`
    const subject = `${p.stores.child_name} drew a new world ✨`
    const html = renderEmailHtml({
      childName: p.stores.child_name,
      pieceTitle: p.title,
      description: p.ai_description,
      imageUrl,
      galleryUrl,
    })

    let sent = 0
    const errors: string[] = []
    for (const to of recipients) {
      try {
        await sendResendEmail(to, subject, html)
        sent++
      } catch (e: any) {
        errors.push(`${to}: ${e?.message || 'unknown'}`)
      }
    }

    // 7. Log the fanout (sets the debounce clock).
    await admin.from('events').insert({
      event_type: 'notification_sent',
      store_id: p.store_id,
      piece_id: p.id,
      metadata: {
        channel: 'email',
        recipient_count: recipients.length,
        sent_count: sent,
        errors: errors.slice(0, 5),
      },
    })

    return new Response(
      JSON.stringify({ ok: true, sent, attempted: recipients.length, errors: errors.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e: any) {
    console.error('notify-new-piece error:', e)
    return new Response(JSON.stringify({ error: e?.message || 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

Deno.serve(handler)
