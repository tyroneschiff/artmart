// Email a gallery owner when someone votes on one of their pieces.
//
// The dopamine signal that gets a creator to re-open the app. Without
// this, votes silently accumulate and the parent never knows their
// kid's world landed for someone.
//
// Auth: caller must be authenticated (the voter). We don't require
// the caller to BE the voter for a piece — they just need a valid
// JWT. The vote itself is gated by RLS in the votes table.
//
// Debounce: at most one email per piece per 24h. A single piece
// getting 50 votes in a day → one email, not 50. Owners are excluded
// from notifying themselves on their own pieces (they can vote on
// their own work in principle; we just don't email about it).
//
// Fire-and-forget from the client. If Resend is down or the function
// errors, the vote already succeeded and the voter is unaffected.

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

// Milestone-based instead of time-debounced. Send only when the new
// vote_count crosses one of these thresholds; otherwise stay silent.
// Result: a piece with 10 hearts triggers ~6 emails across its life,
// not 1 per day for 10 days. Each email = a real moment ("your kid's
// drawing just hit 10 hearts") instead of a steady drumbeat.
const VOTE_MILESTONES = new Set([1, 5, 10, 25, 50, 100, 250, 500, 1000])

// Belt-and-suspenders: even on a milestone, never send twice within
// this window (handles upstream retries / duplicate triggers).
const SAFETY_DEBOUNCE_HOURS = 6

type Piece = {
  id: string
  title: string | null
  watermarked_image_url: string | null
  transformed_image_url: string | null
  vote_count: number
  store_id: string
  stores: {
    child_name: string
    slug: string
    owner_id: string
  }
}

function milestoneLine(voteCount: number, childName: string): { kicker: string; body: string } {
  if (voteCount === 1) {
    return {
      kicker: `Someone loved ${childName}'s world`,
      body: 'The very first heart. Show your kid — they\'ll love this.',
    }
  }
  if (voteCount >= 100) {
    return {
      kicker: `${voteCount} hearts and counting`,
      body: `This one's taking off. ${voteCount} people have loved ${childName}'s world so far.`,
    }
  }
  if (voteCount >= 25) {
    return {
      kicker: `${voteCount} hearts`,
      body: `It's catching on — ${voteCount} people have loved this on Draw Up. A great moment to share with ${childName}.`,
    }
  }
  // 5 or 10 — small but real milestones.
  return {
    kicker: `${voteCount} hearts`,
    body: `It just crossed ${voteCount} hearts on Draw Up. Worth showing ${childName}.`,
  }
}

function renderEmailHtml(opts: {
  childName: string
  pieceTitle: string
  voteCount: number
  imageUrl: string
  pieceUrl: string
}) {
  const safeTitle = opts.pieceTitle.replace(/[<>&]/g, '')
  const safeChild = opts.childName.replace(/[<>&]/g, '')
  const { kicker, body } = milestoneLine(opts.voteCount, safeChild)
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
          <img src="${opts.imageUrl}" alt="${safeTitle}" style="width:100%;height:auto;display:block;aspect-ratio:1/1;object-fit:cover;background:#EDE4D0;" />
          <div style="padding:24px;">
            <div style="font-size:12px;color:#A89880;font-weight:700;letter-spacing:.6px;text-transform:uppercase;margin-bottom:8px;">${kicker}</div>
            <h1 style="font-size:22px;font-weight:800;letter-spacing:-.4px;line-height:1.2;margin:0 0 12px 0;color:#1C1810;">${safeTitle}</h1>
            <p style="color:#6B5E4E;font-size:15px;margin:0 0 20px 0;">${body}</p>
            <a href="${opts.pieceUrl}" style="display:inline-block;background:#1C1810;color:#FEFAF3;text-decoration:none;font-weight:700;font-size:15px;padding:14px 24px;border-radius:999px;">See the world</a>
          </div>
        </td></tr>
        <tr><td align="center" style="padding:24px 0 0 0;color:#A89880;font-size:12px;">
          You're getting this because a piece in your gallery hit a milestone.<br>
          We only send at meaningful marks (1, 5, 10, 25, 50, 100…) — never on every vote.
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
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
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

    let voterId: string
    try {
      const { payload } = await jwtVerify(authHeader.replace('Bearer ', ''), JWKS, {
        issuer: `${SUPABASE_URL}/auth/v1`,
      })
      if (!payload.sub) throw new Error('missing sub')
      voterId = payload.sub
    } catch {
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

    const { data: piece, error: pErr } = await admin
      .from('pieces')
      .select('id, title, watermarked_image_url, transformed_image_url, vote_count, store_id, stores(child_name, slug, owner_id)')
      .eq('id', piece_id)
      .single()
    if (pErr || !piece) throw new Error(`piece not found: ${pErr?.message || 'no row'}`)

    const p = piece as unknown as Piece

    // Owner voting on their own piece doesn't generate a notification.
    if (p.stores.owner_id === voterId) {
      return new Response(JSON.stringify({ ok: true, skipped: 'self_vote' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Milestone gate: only send when the new vote_count is in the
    // milestone set. Below threshold or between thresholds → silent.
    // p.vote_count reflects the value AFTER the insert (the vote
    // trigger has already committed by the time the fire-and-forget
    // call reaches us — slight off-by-one risk in pathological
    // timing is acceptable; worst case the next milestone vote
    // sends a slightly delayed email).
    if (!VOTE_MILESTONES.has(p.vote_count)) {
      return new Response(JSON.stringify({ ok: true, skipped: 'not_milestone', vote_count: p.vote_count }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Safety debounce against duplicate-fire on the same milestone
    // (upstream retry, multiple voters hitting the same threshold,
    // etc.). Per-piece, 6h window.
    const safetyCutoff = new Date(Date.now() - SAFETY_DEBOUNCE_HOURS * 3600_000).toISOString()
    const { data: recentSends } = await admin
      .from('events')
      .select('id, metadata')
      .eq('event_type', 'notification_sent')
      .eq('piece_id', p.id)
      .gte('created_at', safetyCutoff)
      .limit(5)
    const alreadySent = (recentSends || []).some((r: any) =>
      r.metadata?.channel === 'email_vote' && r.metadata?.milestone === p.vote_count
    )
    if (alreadySent) {
      return new Response(JSON.stringify({ ok: true, skipped: 'milestone_already_sent', milestone: p.vote_count }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve the owner's email via service role.
    const { data: ownerLookup, error: oErr } = await admin.auth.admin.getUserById(p.stores.owner_id)
    if (oErr || !ownerLookup.user?.email) {
      throw new Error(`could not resolve owner email: ${oErr?.message || 'no email'}`)
    }
    const to = ownerLookup.user.email

    const imageUrl = p.watermarked_image_url || p.transformed_image_url || ''
    const pieceUrl = `https://drawup.ink/piece/${p.id}?ref=love-${p.id}`
    const subject = `Someone loved ${p.stores.child_name}'s world ✨`
    const html = renderEmailHtml({
      childName: p.stores.child_name,
      pieceTitle: p.title || 'A new world',
      voteCount: p.vote_count,
      imageUrl,
      pieceUrl,
    })

    let sent = 0
    let errors: string[] = []
    try {
      await sendResendEmail(to, subject, html)
      sent = 1
    } catch (e: any) {
      errors.push(e?.message || 'unknown')
    }

    await admin.from('events').insert({
      event_type: 'notification_sent',
      piece_id: p.id,
      store_id: p.store_id,
      metadata: {
        channel: 'email_vote',
        milestone: p.vote_count,
        recipient_count: 1,
        sent_count: sent,
        errors: errors.slice(0, 3),
      },
    })

    return new Response(JSON.stringify({ ok: true, sent, errors: errors.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('notify-vote error:', e)
    return new Response(JSON.stringify({ error: e?.message || 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
}

Deno.serve(handler)
