// Server-rendered OG page for shared piece/gallery URLs.
// Runs as a Vercel serverless function, served directly from drawup.ink.
// No third-party cookies, no proxy chain — preview crawlers (iMessage, WhatsApp,
// Slack, FB) get a clean HTML response with proper OG tags.

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://twwittitwwuuauhgrdaw.supabase.co"
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY
const APP_STORE_URL = "https://apps.apple.com/us/app/draw-up/id6762963488"

function escapeHtml(str) {
  if (str == null) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

async function fetchPiece(id) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/pieces?id=eq.${encodeURIComponent(id)}&select=title,ai_description,transformed_image_url,watermarked_image_url,stores(child_name,slug)`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  )
  if (!res.ok) return null
  const rows = await res.json()
  return rows && rows[0] ? rows[0] : null
}

async function fetchStore(slug) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/stores?slug=eq.${encodeURIComponent(slug)}&select=child_name,pieces(transformed_image_url,watermarked_image_url,created_at,published)`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  )
  if (!res.ok) return null
  const rows = await res.json()
  return rows && rows[0] ? rows[0] : null
}

function renderHtml({ title, description, imageUrl, canonicalUrl, bodyHeadline, bodySubtitle, bylineLabel, ctaLabel }) {
  const safe = {
    title: escapeHtml(title),
    description: escapeHtml(description),
    imageUrl: escapeHtml(imageUrl),
    canonicalUrl: escapeHtml(canonicalUrl),
    bodyHeadline: escapeHtml(bodyHeadline),
    bodySubtitle: escapeHtml(bodySubtitle),
    bylineLabel: bylineLabel ? escapeHtml(bylineLabel) : null,
    ctaLabel: escapeHtml(ctaLabel),
    appStore: escapeHtml(APP_STORE_URL),
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safe.title}</title>
  <meta name="title" content="${safe.title}">
  <meta name="description" content="${safe.description}">
  <link rel="canonical" href="${safe.canonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${safe.canonicalUrl}">
  <meta property="og:site_name" content="Draw Up">
  <meta property="og:title" content="${safe.title}">
  <meta property="og:description" content="${safe.description}">
  <meta property="og:image" content="${safe.imageUrl}">
  <meta property="og:image:width" content="1024">
  <meta property="og:image:height" content="1024">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${safe.canonicalUrl}">
  <meta name="twitter:title" content="${safe.title}">
  <meta name="twitter:description" content="${safe.description}">
  <meta name="twitter:image" content="${safe.imageUrl}">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html,body{background:#FEFAF3;color:#1C1810}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;min-height:100vh;padding:32px 20px 48px}
    .wrap{max-width:520px;margin:0 auto}
    .brand{text-align:center;font-weight:900;letter-spacing:-1px;font-size:22px;margin-bottom:24px}
    .brand span{color:#E8A020}
    .card{background:#fff;border-radius:24px;overflow:hidden;border:1px solid #EDE4D0;box-shadow:0 12px 40px rgba(28,24,16,.06)}
    .hero{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#EDE4D0}
    .body{padding:28px 24px 24px;text-align:center}
    .byline{color:#A89880;font-size:13px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;margin-bottom:8px}
    h1{font-size:26px;font-weight:800;letter-spacing:-.6px;line-height:1.15;margin-bottom:14px}
    p.desc{color:#6B5E4E;line-height:1.55;font-size:16px;margin-bottom:28px}
    .cta{background:#1C1810;color:#fff;text-decoration:none;padding:16px 28px;border-radius:999px;font-weight:700;display:inline-block;font-size:16px}
    .footer{text-align:center;color:#A89880;font-size:13px;margin-top:24px}
    .footer a{color:#6B5E4E;text-decoration:none;border-bottom:1px solid #EDE4D0}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">draw <span>up</span></div>
    <div class="card">
      <img class="hero" src="${safe.imageUrl}" alt="${safe.bodyHeadline}">
      <div class="body">
        ${safe.bylineLabel ? `<div class="byline">${safe.bylineLabel}</div>` : ""}
        <h1>${safe.bodyHeadline}</h1>
        <p class="desc">${safe.bodySubtitle}</p>
        <a class="cta" href="${safe.appStore}">${safe.ctaLabel}</a>
      </div>
    </div>
    <div class="footer">Made with <a href="${safe.appStore}">Draw Up</a> — step inside your child's drawing.</div>
  </div>
</body>
</html>`
}

export default async function handler(req, res) {
  const { type, id, debug } = req.query

  if (debug === "env") {
    res.setHeader("Content-Type", "application/json")
    return res.status(200).send(JSON.stringify({
      hasSupabaseUrl: !!SUPABASE_URL,
      supabaseUrlSource: process.env.SUPABASE_URL ? "SUPABASE_URL"
        : process.env.NEXT_PUBLIC_SUPABASE_URL ? "NEXT_PUBLIC_SUPABASE_URL"
        : process.env.EXPO_PUBLIC_SUPABASE_URL ? "EXPO_PUBLIC_SUPABASE_URL"
        : process.env.VITE_SUPABASE_URL ? "VITE_SUPABASE_URL"
        : "fallback-hardcoded",
      hasAnonKey: !!SUPABASE_ANON_KEY,
      anonKeySource: process.env.SUPABASE_ANON_KEY ? "SUPABASE_ANON_KEY"
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? "EXPO_PUBLIC_SUPABASE_ANON_KEY"
        : process.env.VITE_SUPABASE_ANON_KEY ? "VITE_SUPABASE_ANON_KEY"
        : "MISSING",
      supabaseUrl: SUPABASE_URL,
      anonKeyLength: SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.length : 0,
    }))
  }

  let payload = {
    title: "Draw Up — Step inside your child's drawing",
    description: "Snap a photo of your kid's drawing and watch it come to life. Hear the world described back to them. Share the magic with family.",
    imageUrl: `${SUPABASE_URL}/storage/v1/object/public/artwork/og-default.png`,
    canonicalUrl: "https://drawup.ink",
    bodyHeadline: "Step inside your child's drawing",
    bodySubtitle: "Draw Up turns your kid's artwork into a vivid world they can step into and hear described aloud.",
    bylineLabel: null,
    ctaLabel: "Get the app",
  }

  try {
    if (type === "piece" && id) {
      payload.canonicalUrl = `https://drawup.ink/piece/${id}`
      const piece = await fetchPiece(id)
      if (piece) {
        const childName = (piece.stores && piece.stores.child_name) || "a young artist"
        const safeTitle = piece.title || "A new world"
        payload.title = `${safeTitle} — a world by ${childName}`
        payload.description = piece.ai_description || `Step inside ${childName}'s drawing on Draw Up.`
        payload.imageUrl = piece.transformed_image_url || piece.watermarked_image_url || payload.imageUrl
        payload.bodyHeadline = safeTitle
        payload.bodySubtitle = payload.description
        payload.bylineLabel = `A world by ${childName}`
        payload.ctaLabel = "Step inside on Draw Up"
      }
    } else if (type === "store" && id) {
      payload.canonicalUrl = `https://drawup.ink/store/${id}`
      const store = await fetchStore(id)
      if (store) {
        const pieces = (store.pieces || []).filter((p) => p.published)
        const sorted = pieces.slice().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
        const latest = sorted[0]
        const count = pieces.length
        payload.title = `${store.child_name}'s Gallery on Draw Up`
        payload.description = count > 0
          ? `Step inside ${count} ${count === 1 ? "world" : "worlds"} dreamed up by ${store.child_name}.`
          : `${store.child_name}'s drawings will live here. Step inside soon.`
        payload.bodyHeadline = `${store.child_name}'s Gallery`
        payload.bodySubtitle = payload.description
        payload.bylineLabel = count > 0 ? `${count} ${count === 1 ? "world" : "worlds"}` : null
        payload.ctaLabel = "Visit the gallery on Draw Up"
        if (latest) {
          payload.imageUrl = latest.transformed_image_url || latest.watermarked_image_url || payload.imageUrl
        }
      }
    }
  } catch (e) {
    // Fall through to default payload — never break the preview.
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=86400")
  res.status(200).send(renderHtml(payload))
}
