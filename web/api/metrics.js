// Operator metrics dashboard — top-level KPIs for Draw Up.
// Token-gated single-page server-rendered HTML. No client JS, no session.
// Reads events via service role (SELECT on public.events is service-role only).

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://twwittitwwuuauhgrdaw.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const METRICS_KEY = process.env.METRICS_KEY

const KILL_THRESHOLD = 0.10

function escapeHtml(str) {
  if (str == null) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

async function fetchEvents({ sinceIso, excludeUser }) {
  const params = new URLSearchParams()
  params.set("select", "event_type,user_id,piece_id,store_id,metadata,created_at")
  params.set("created_at", `gte.${sinceIso}`)
  if (excludeUser) params.set("user_id", `not.eq.${excludeUser}`)
  params.set("order", "created_at.desc")
  params.set("limit", "5000")

  const res = await fetch(`${SUPABASE_URL}/rest/v1/events?${params.toString()}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`)
  return res.json()
}

function counts(events) {
  const c = {}
  for (const e of events) c[e.event_type] = (c[e.event_type] || 0) + 1
  return c
}

function within(events, days) {
  const cutoff = Date.now() - days * 86400000
  return events.filter((e) => new Date(e.created_at).getTime() >= cutoff)
}

function ratio(num, den) {
  if (!den) return null
  return num / den
}

function fmtRatio(r) {
  if (r == null) return "—"
  return r.toFixed(2)
}

function ratioStatus(r) {
  if (r == null) return "neutral"
  return r >= KILL_THRESHOLD ? "good" : "bad"
}

function shareChannels(events) {
  const out = { whatsapp: 0, native: 0, copy: 0, other: 0 }
  for (const e of events) {
    if (e.event_type !== "share_completed") continue
    const ch = e.metadata?.channel || "other"
    if (ch in out) out[ch]++
    else out.other++
  }
  return out
}

function dailySeries(events, type, days) {
  const buckets = new Array(days).fill(0)
  const todayMid = new Date()
  todayMid.setHours(0, 0, 0, 0)
  for (const e of events) {
    if (e.event_type !== type) continue
    const t = new Date(e.created_at).getTime()
    const dayDiff = Math.floor((todayMid.getTime() - t) / 86400000)
    if (dayDiff >= 0 && dayDiff < days) buckets[days - 1 - dayDiff]++
  }
  return buckets
}

function sparkline(series) {
  const max = Math.max(1, ...series)
  const w = 240
  const h = 32
  const step = w / Math.max(1, series.length - 1)
  const pts = series.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(" ")
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none">
    <polyline fill="none" stroke="#E8A020" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts}"/>
  </svg>`
}

function renderHtml({ events30d, excludeUser }) {
  const all = events30d
  const d7 = within(all, 7)
  const d30 = all
  const c7 = counts(d7)
  const c30 = counts(d30)

  const sharesPerTransform7 = ratio(c7.share_completed || 0, c7.transform_completed || 0)
  const signupsPerShare7 = ratio(c7.signup_completed || 0, c7.share_completed || 0)
  const transformSuccess7 = ratio(
    c7.transform_completed || 0,
    (c7.transform_completed || 0) + (c7.transform_failed || 0)
  )

  const channels = shareChannels(d7)
  const totalCh = channels.whatsapp + channels.native + channels.copy + channels.other

  const transformSeries = dailySeries(all, "transform_completed", 14)
  const shareSeries = dailySeries(all, "share_completed", 14)
  const signupSeries = dailySeries(all, "signup_completed", 14)

  const recent = d7.slice(0, 30)

  const stages = [
    { key: "signup_completed", label: "Signups" },
    { key: "gallery_created", label: "Galleries created" },
    { key: "transform_started", label: "Transforms started" },
    { key: "transform_completed", label: "Transforms completed" },
    { key: "piece_published", label: "Pieces published" },
    { key: "share_started", label: "Shares started" },
    { key: "share_completed", label: "Shares completed" },
    { key: "og_view", label: "Link previews seen" },
    { key: "vote_cast", label: "Votes cast" },
    { key: "original_saved", label: "Originals saved to Photos" },
  ]

  const failReasons = {}
  for (const e of d7) {
    if (e.event_type !== "transform_failed") continue
    const r = e.metadata?.reason || "unknown"
    failReasons[r] = (failReasons[r] || 0) + 1
  }
  const failRows = Object.entries(failReasons).sort((a, b) => b[1] - a[1])

  const status1 = ratioStatus(sharesPerTransform7)
  const status2 = ratioStatus(signupsPerShare7)

  const generated = new Date().toISOString()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Draw Up — Metrics</title>
  <meta name="robots" content="noindex">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --gold:#E8A020;--gold-light:#FDF0D5;--gold-dark:#8B5E00;
      --cream:#FEFAF3;--dark:#1C1810;--mid:#6B5E4E;--muted:#A89880;--border:#EDE4D0;
      --good:#2E7D4F;--good-bg:#E8F3EC;--bad:#B53D2E;--bad-bg:#FBEAE6;
    }
    html,body{background:var(--cream);color:var(--dark);min-height:100vh}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;padding:32px 20px 64px;line-height:1.5}
    .wrap{max-width:960px;margin:0 auto}
    header{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:32px;flex-wrap:wrap;gap:12px}
    .brand{font-weight:900;letter-spacing:-1px;font-size:24px}
    .brand span{color:var(--gold)}
    .meta{color:var(--muted);font-size:13px}
    h2{font-size:13px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--mid);margin-bottom:12px}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
    @media (max-width:640px){.row{grid-template-columns:1fr}}
    .kpi{background:#fff;border:1px solid var(--border);border-radius:20px;padding:24px}
    .kpi.good{border-color:var(--good);background:var(--good-bg)}
    .kpi.bad{border-color:var(--bad);background:var(--bad-bg)}
    .kpi .label{font-size:13px;font-weight:600;color:var(--mid);margin-bottom:8px}
    .kpi .value{font-size:48px;font-weight:900;letter-spacing:-1.5px;line-height:1}
    .kpi .pill{display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;margin-top:10px}
    .kpi.good .pill{background:var(--good);color:#fff}
    .kpi.bad .pill{background:var(--bad);color:#fff}
    .kpi.neutral .pill{background:var(--muted);color:#fff}
    .kpi .hint{font-size:12px;color:var(--mid);margin-top:6px}
    .card{background:#fff;border:1px solid var(--border);border-radius:20px;padding:20px 24px;margin-bottom:16px}
    .card h3{font-size:15px;font-weight:800;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;font-size:14px}
    td,th{padding:8px 0;text-align:left;border-bottom:1px solid var(--border)}
    tr:last-child td{border-bottom:none}
    th{font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--muted)}
    td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
    .funnel-bar{display:inline-block;height:6px;background:var(--gold);border-radius:3px;vertical-align:middle;margin-right:8px}
    .channel{display:flex;justify-content:space-between;padding:6px 0;font-size:14px}
    .spark-card{display:flex;flex-direction:column;gap:8px}
    .spark-card .top{display:flex;justify-content:space-between;align-items:baseline}
    .spark-card .num{font-size:24px;font-weight:800;letter-spacing:-.5px}
    .spark-card .label{font-size:12px;color:var(--mid)}
    .recent{font-size:13px;color:var(--mid)}
    .recent .ev{font-weight:700;color:var(--dark)}
    .recent .row-r{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)}
    .recent .row-r:last-child{border-bottom:none}
    .footer{margin-top:32px;text-align:center;color:var(--muted);font-size:12px}
    .filterbar{display:flex;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--mid);margin-bottom:16px}
    .filterbar code{background:var(--gold-light);padding:2px 8px;border-radius:6px;color:var(--gold-dark);font-size:11px}
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <div class="brand">draw <span>up</span> · metrics</div>
        <div class="meta">Generated ${escapeHtml(generated)} · last 7d unless noted</div>
      </div>
    </header>

    <div class="filterbar">
      ${excludeUser ? `<span>Excluding user <code>${escapeHtml(excludeUser.slice(0, 8))}…</code></span>` : `<span>Including all users · add <code>?excludeUser=&lt;uuid&gt;</code> to filter your own events</span>`}
    </div>

    <h2>Kill criteria (must stay above 0.10)</h2>
    <div class="row">
      <div class="kpi ${status1}">
        <div class="label">Shares per completed transform</div>
        <div class="value">${fmtRatio(sharesPerTransform7)}</div>
        <div class="pill">${status1 === "good" ? "ABOVE THRESHOLD" : status1 === "bad" ? "BELOW THRESHOLD" : "NO DATA"}</div>
        <div class="hint">${c7.share_completed || 0} shares ÷ ${c7.transform_completed || 0} transforms</div>
      </div>
      <div class="kpi ${status2}">
        <div class="label">Signups per share</div>
        <div class="value">${fmtRatio(signupsPerShare7)}</div>
        <div class="pill">${status2 === "good" ? "ABOVE THRESHOLD" : status2 === "bad" ? "BELOW THRESHOLD" : "NO DATA"}</div>
        <div class="hint">${c7.signup_completed || 0} signups ÷ ${c7.share_completed || 0} shares</div>
      </div>
    </div>

    <h2>Last 14 days</h2>
    <div class="row">
      <div class="card spark-card">
        <div class="top"><span class="label">Transforms / day</span><span class="num">${c7.transform_completed || 0}<span style="font-size:12px;color:var(--muted);font-weight:500"> last 7d</span></span></div>
        ${sparkline(transformSeries)}
      </div>
      <div class="card spark-card">
        <div class="top"><span class="label">Shares / day</span><span class="num">${c7.share_completed || 0}<span style="font-size:12px;color:var(--muted);font-weight:500"> last 7d</span></span></div>
        ${sparkline(shareSeries)}
      </div>
    </div>
    <div class="row">
      <div class="card spark-card">
        <div class="top"><span class="label">Signups / day</span><span class="num">${c7.signup_completed || 0}<span style="font-size:12px;color:var(--muted);font-weight:500"> last 7d</span></span></div>
        ${sparkline(signupSeries)}
      </div>
      <div class="card spark-card">
        <div class="top"><span class="label">Transform success rate</span><span class="num">${transformSuccess7 == null ? "—" : (transformSuccess7 * 100).toFixed(0) + "%"}</span></div>
        <div class="hint" style="font-size:12px;color:var(--mid)">${c7.transform_completed || 0} ok · ${c7.transform_failed || 0} failed</div>
      </div>
    </div>

    <h2>Funnel (7d / 30d)</h2>
    <div class="card">
      <table>
        <thead><tr><th>Stage</th><th class="num">7d</th><th class="num">30d</th></tr></thead>
        <tbody>
          ${stages.map((s) => {
            const v7 = c7[s.key] || 0
            const v30 = c30[s.key] || 0
            const max7 = Math.max(...stages.map((x) => c7[x.key] || 0), 1)
            const widthPct = Math.max(2, Math.round((v7 / max7) * 100))
            return `<tr>
              <td><span class="funnel-bar" style="width:${widthPct}px"></span>${escapeHtml(s.label)}</td>
              <td class="num">${v7}</td>
              <td class="num">${v30}</td>
            </tr>`
          }).join("")}
        </tbody>
      </table>
    </div>

    <h2>Share channels (7d)</h2>
    <div class="card">
      ${totalCh === 0 ? `<div class="recent">No shares yet.</div>` : `
        <div class="channel"><span>WhatsApp</span><span>${channels.whatsapp}</span></div>
        <div class="channel"><span>Native (iOS share sheet)</span><span>${channels.native}</span></div>
        <div class="channel"><span>Copy link</span><span>${channels.copy}</span></div>
        ${channels.other ? `<div class="channel"><span>Other</span><span>${channels.other}</span></div>` : ""}
      `}
    </div>

    ${failRows.length ? `
    <h2>Transform failures (7d)</h2>
    <div class="card">
      <table>
        <thead><tr><th>Reason</th><th class="num">Count</th></tr></thead>
        <tbody>
          ${failRows.map(([r, n]) => `<tr><td>${escapeHtml(r)}</td><td class="num">${n}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}

    <h2>Recent activity (last 30 events, 7d)</h2>
    <div class="card recent">
      ${recent.length === 0 ? `<div>No events in the last 7 days.</div>` : recent.map((e) => {
        const t = new Date(e.created_at)
        const ago = Math.round((Date.now() - t.getTime()) / 60000)
        const agoStr = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago/60)}h ago` : `${Math.round(ago/1440)}d ago`
        const userTag = e.user_id ? `<code style="font-size:11px;color:var(--muted)">${escapeHtml(e.user_id.slice(0, 8))}</code>` : `<span style="color:var(--muted)">anon</span>`
        return `<div class="row-r"><span><span class="ev">${escapeHtml(e.event_type)}</span> · ${userTag}</span><span>${agoStr}</span></div>`
      }).join("")}
    </div>

    <div class="footer">
      Read-only · service-role query · cached 60s · refresh page to update
    </div>
  </div>
</body>
</html>`
}

export default async function handler(req, res) {
  if (!METRICS_KEY) {
    res.status(500).send("METRICS_KEY env var not set")
    return
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).send("SUPABASE_SERVICE_ROLE_KEY env var not set")
    return
  }

  const { key, excludeUser } = req.query
  if (!key || key !== METRICS_KEY) {
    res.status(401).send("unauthorized")
    return
  }

  try {
    const sinceIso = new Date(Date.now() - 30 * 86400000).toISOString()
    const events30d = await fetchEvents({ sinceIso, excludeUser })
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.setHeader("Cache-Control", "private, max-age=60")
    res.status(200).send(renderHtml({ events30d, excludeUser }))
  } catch (e) {
    res.status(500).send(`metrics error: ${escapeHtml(e?.message || "unknown")}`)
  }
}
