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
const APP_STORE_URL = "https://testflight.apple.com/join/muwXQhQa"

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
    `${SUPABASE_URL}/rest/v1/stores?slug=eq.${encodeURIComponent(slug)}&select=child_name,cover_piece_id,pieces(id,title,transformed_image_url,watermarked_image_url,original_image_url,created_at,published,vote_count)`,
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

function renderHtml({ title, description, ogImageUrl, originalImageUrl, transformedImageUrl, canonicalUrl, bodyHeadline, bodySubtitle, bylineLabel, ctaLabel, childName, galleryPieces }) {
  const safe = {
    title: escapeHtml(title),
    description: escapeHtml(description),
    ogImageUrl: escapeHtml(ogImageUrl),
    originalImageUrl: originalImageUrl ? escapeHtml(originalImageUrl) : null,
    transformedImageUrl: transformedImageUrl ? escapeHtml(transformedImageUrl) : null,
    canonicalUrl: escapeHtml(canonicalUrl),
    bodyHeadline: escapeHtml(bodyHeadline),
    bodySubtitle: escapeHtml(bodySubtitle),
    bylineLabel: bylineLabel ? escapeHtml(bylineLabel) : null,
    ctaLabel: escapeHtml(ctaLabel),
    appStore: escapeHtml(APP_STORE_URL),
    childName: childName ? escapeHtml(childName) : null,
  }

  // For gallery pages, render a real grid of the child's pieces so a
  // grandparent tapping the WhatsApp link from a parent actually sees
  // the kid's worlds. For piece pages, keep the existing hero+inset
  // composition. For everything else, fall back to a single hero.
  const isGalleryView = Array.isArray(galleryPieces) && galleryPieces.length > 0
  const heroBlock = isGalleryView
    ? `
      <div class="grid">
        ${galleryPieces.map((p) => `
          <a class="tile" href="https://drawup.ink/piece/${escapeHtml(p.id)}">
            <img loading="lazy" src="${escapeHtml(p.transformed_image_url || p.watermarked_image_url || '')}" alt="${escapeHtml(p.title || 'A world')}">
            ${p.title ? `<span class="tile-label">${escapeHtml(p.title)}</span>` : ''}
          </a>
        `).join('')}
      </div>`
    : (safe.originalImageUrl && safe.transformedImageUrl ? `
      <div class="pair">
        <div class="panel">
          <span class="panel-label dark">The drawing</span>
          <img src="${safe.originalImageUrl}" alt="The original drawing">
        </div>
        <div class="arrow">→</div>
        <div class="panel">
          <span class="panel-label gold">The world</span>
          <img src="${safe.transformedImageUrl}" alt="The world rendered by Draw Up">
        </div>
      </div>` : `
      <img class="hero" src="${safe.transformedImageUrl || safe.ogImageUrl}" alt="${safe.bodyHeadline}">`)

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
  <meta property="og:image" content="${safe.ogImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${safe.canonicalUrl}">
  <meta name="twitter:title" content="${safe.title}">
  <meta name="twitter:description" content="${safe.description}">
  <meta name="twitter:image" content="${safe.ogImageUrl}">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html,body{background:#FEFAF3;color:#1C1810}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;min-height:100vh;padding:32px 20px 48px}
    .wrap{max-width:560px;margin:0 auto}
    .brand{text-align:center;font-weight:900;letter-spacing:-1px;font-size:22px;margin-bottom:24px}
    .brand span{color:#E8A020}
    .card{background:#fff;border-radius:24px;overflow:hidden;border:1px solid #EDE4D0;box-shadow:0 12px 40px rgba(28,24,16,.06)}
    .hero{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#EDE4D0}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px}
    .tile{position:relative;border-radius:14px;overflow:hidden;background:#FDF0D5;border:1px solid #EDE4D0;text-decoration:none;color:inherit;display:block}
    .tile img{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#EDE4D0}
    .tile-label{position:absolute;left:8px;bottom:8px;right:8px;font-size:11px;font-weight:700;letter-spacing:-0.1px;color:#fff;background:rgba(0,0,0,.45);padding:5px 8px;border-radius:8px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
    .pair{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;padding:14px 14px 0}
    .panel{position:relative;border-radius:14px;overflow:hidden;background:#FDF0D5;border:1px solid #EDE4D0}
    .panel img{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#EDE4D0}
    .panel-label{position:absolute;top:-10px;left:10px;font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;padding:4px 10px;border-radius:999px}
    .panel-label.dark{background:#1C1810;color:#FEFAF3}
    .panel-label.gold{background:#E8A020;color:#fff}
    .arrow{color:#A89880;font-size:22px;font-weight:300;display:flex;align-items:center;justify-content:center}
    .body{padding:28px 24px 24px;text-align:center}
    .gallery-header{padding:28px 24px 8px;text-align:center}
    .gallery-title{font-size:28px;font-weight:900;letter-spacing:-0.8px;line-height:1.1;margin-bottom:8px;color:#1C1810}
    .gallery-sub{color:#6B5E4E;font-size:15px;line-height:1.5;margin-bottom:0}
    .byline{color:#A89880;font-size:13px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;margin-bottom:8px}
    h1{font-size:26px;font-weight:800;letter-spacing:-.6px;line-height:1.15;margin-bottom:14px}
    p.desc{color:#6B5E4E;line-height:1.55;font-size:16px;margin-bottom:28px}
    .attribution{font-size:13px;color:#A89880;margin-top:-18px;margin-bottom:24px;font-weight:500}
    .attribution strong{color:#1C1810;font-weight:700}
    .cta{background:#1C1810;color:#fff;text-decoration:none;padding:16px 28px;border-radius:999px;font-weight:700;display:inline-block;font-size:16px}
    .footer{text-align:center;color:#A89880;font-size:13px;margin-top:24px}
    .footer a{color:#6B5E4E;text-decoration:none;border-bottom:1px solid #EDE4D0}
    @media (max-width:480px){
      .pair{grid-template-columns:1fr;gap:14px}
      .arrow{display:none}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">draw <span>up</span></div>
    <div class="card">
      ${isGalleryView ? `
        <div class="gallery-header">
          ${safe.bylineLabel ? `<div class="byline">${safe.bylineLabel}</div>` : ''}
          <h1 class="gallery-title">${safe.bodyHeadline}</h1>
          <p class="gallery-sub">${safe.bodySubtitle}</p>
        </div>
        ${heroBlock}
        <div class="body">
          <a class="cta" href="${safe.appStore}">${safe.ctaLabel}</a>
        </div>
      ` : `
        ${heroBlock}
        <div class="body">
          ${safe.bylineLabel ? `<div class="byline">${safe.bylineLabel}</div>` : ''}
          <h1>${safe.bodyHeadline}</h1>
          ${safe.childName ? `<p class="attribution">Drawn by <strong>${safe.childName}</strong> · World rendered by Draw Up</p>` : ''}
          <p class="desc">${safe.bodySubtitle}</p>
          <a class="cta" href="${safe.appStore}">${safe.ctaLabel}</a>
        </div>
      `}
    </div>
    <div class="footer">Made with <a href="${safe.appStore}">Draw Up</a> — step inside your child's drawing.</div>
  </div>
</body>
</html>`
}

async function logOgView(type, id, ref, userAgent) {
  if (!SUPABASE_ANON_KEY) return
  try {
    // Skip obvious bot/preview crawlers so click counts reflect human
    // attribution. iMessage's previewer announces itself as
    // facebookexternalhit-style; we want to NOT count that as a click.
    const ua = (userAgent || "").toLowerCase()
    const isPreviewer = /bot|crawler|spider|preview|facebookexternalhit|twitterbot|slackbot|whatsapp|telegrambot|imessage|skype|discord/.test(ua)
    await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event_type: isPreviewer ? "og_preview" : "og_view",
        piece_id: type === "piece" ? id : null,
        metadata: {
          type,
          slug: type !== "piece" ? id : null,
          ref: ref || null,
          ua: (userAgent || "").slice(0, 200),
        },
      }),
    })
  } catch {
    // Silent — telemetry must never break the OG response.
  }
}

export default async function handler(req, res) {
  const { type, id, ref } = req.query
  if ((type === "piece" || type === "gallery" || type === "store") && id) {
    logOgView(type, id, typeof ref === "string" ? ref : null, req.headers["user-agent"]) // fire and forget
  }

  let payload = {
    title: "Draw Up — Step inside your child's drawing",
    description: "Snap a photo of your kid's drawing and watch it come to life. Hear the world described back to them. Share the magic with family.",
    ogImageUrl: "https://drawup.ink/og-image.jpg",
    originalImageUrl: null,
    transformedImageUrl: null,
    canonicalUrl: "https://drawup.ink",
    bodyHeadline: "Step inside your child's drawing",
    bodySubtitle: "Draw Up turns your kid's artwork into a vivid world they can step into and hear described aloud.",
    bylineLabel: null,
    ctaLabel: "Get the app",
    childName: null,
    galleryPieces: null,
  }

  try {
    if (type === "piece" && id) {
      payload.canonicalUrl = `https://drawup.ink/piece/${id}`
      // OG card shows the dynamic before/after composite — receivers see the
      // relationship between the drawing and the rendered world instantly.
      payload.ogImageUrl = `https://drawup.ink/api/og-card?type=piece&id=${encodeURIComponent(id)}`
      const piece = await fetchPiece(id)
      if (piece) {
        const childName = (piece.stores && piece.stores.child_name) || "a young artist"
        const safeTitle = piece.title || "A new world"
        payload.title = `${childName} drew this — and Draw Up turned it into a world`
        payload.description = piece.ai_description || `${childName} drew this. Draw Up turned it into a world.`
        payload.bodyHeadline = safeTitle
        payload.bodySubtitle = payload.description
        payload.bylineLabel = null
        payload.ctaLabel = "Step inside on Draw Up"
        payload.childName = childName
        payload.originalImageUrl = piece.original_image_url || null
        payload.transformedImageUrl = piece.transformed_image_url || piece.watermarked_image_url || null
      }
    } else if ((type === "gallery" || type === "store") && id) {
      payload.canonicalUrl = `https://drawup.ink/gallery/${id}`
      payload.ogImageUrl = `https://drawup.ink/api/og-card?type=gallery&id=${encodeURIComponent(id)}`
      const store = await fetchStore(id)
      if (store) {
        const pieces = (store.pieces || []).filter((p) => p.published && (p.transformed_image_url || p.watermarked_image_url))
        // If the owner chose a specific cover, surface it first in the
        // tile grid so it leads the visual. Otherwise sort newest-first.
        const sorted = pieces.slice().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
        if (store.cover_piece_id) {
          const coverIdx = sorted.findIndex((p) => p.id === store.cover_piece_id)
          if (coverIdx > 0) {
            const [cover] = sorted.splice(coverIdx, 1)
            sorted.unshift(cover)
          }
        }
        const count = sorted.length
        payload.title = `${store.child_name}'s gallery on Draw Up`
        payload.description = count > 0
          ? `${count} world${count === 1 ? "" : "s"} drawn by ${store.child_name}, each turned into a vivid place.`
          : `${store.child_name}'s gallery is just getting started.`
        payload.bodyHeadline = `${store.child_name}'s gallery`
        payload.bodySubtitle = count > 0
          ? `Every world here started as one of ${store.child_name}'s drawings.`
          : `${store.child_name} is dreaming up their first world. Check back soon.`
        payload.bylineLabel = count > 0 ? `${count} ${count === 1 ? "world" : "worlds"}` : null
        payload.ctaLabel = count > 0 ? "Open in the Draw Up app" : "Get Draw Up"
        payload.childName = store.child_name
        // Pass the full piece list to the renderer so it can build a
        // real grid for human visitors. OG crawlers still get the
        // og-card image via the meta tags. Cap at 24 so the HTML
        // stays small and fast on cellular.
        payload.galleryPieces = sorted.slice(0, 24)
        // Keep the latest piece's images as fallback for the head
        // image (in case og-card service ever fails).
        const latest = sorted[0]
        if (latest) {
          payload.originalImageUrl = latest.original_image_url || null
          payload.transformedImageUrl = latest.transformed_image_url || latest.watermarked_image_url || null
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
