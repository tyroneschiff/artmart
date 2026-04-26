import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const pathname = url.pathname
  const pieceId = url.searchParams.get('piece') || pathname.match(/\/piece\/([^/]+)/)?.[1]
  const storeSlug = url.searchParams.get('store') || pathname.match(/\/store\/([^/]+)/)?.[1]

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

  const APP_STORE_URL = "https://apps.apple.com/us/app/draw-up/id6762963488"
  const canonicalUrl = pieceId
    ? `https://drawup.ink/piece/${pieceId}`
    : storeSlug
    ? `https://drawup.ink/store/${storeSlug}`
    : "https://drawup.ink"

  let title = "Draw Up — Step inside your child's drawing"
  let description = "Snap a photo of your kid's drawing and watch it come to life. Hear the world described back to them. Share the magic with family."
  let imageUrl = "https://twwittitwwuuauhgrdaw.supabase.co/storage/v1/object/public/artwork/og-default.png"
  let bodyHeadline = title
  let bodySubtitle = description
  let ctaLabel = "Get the app"
  let bylineLabel: string | null = null

  if (pieceId) {
    const { data: piece, error } = await supabase
      .from('pieces')
      .select('title, ai_description, transformed_image_url, watermarked_image_url, stores(child_name, slug)')
      .eq('id', pieceId)
      .single()

    if (piece && !error) {
      const childName = (piece.stores as any)?.child_name || 'a young artist'
      const safeTitle = piece.title || 'A new world'
      title = `${safeTitle} — a world by ${childName}`
      description = piece.ai_description || `Step inside ${childName}'s drawing on Draw Up.`
      imageUrl = piece.transformed_image_url || piece.watermarked_image_url || imageUrl
      bodyHeadline = safeTitle
      bodySubtitle = description
      bylineLabel = `A world by ${childName}`
      ctaLabel = "Step inside on Draw Up"
    }
  } else if (storeSlug) {
    const { data: store, error } = await supabase
      .from('stores')
      .select('child_name, pieces(transformed_image_url, watermarked_image_url, created_at, published)')
      .eq('slug', storeSlug)
      .single()

    if (store && !error) {
      const publishedPieces = (store.pieces ?? []).filter((p: any) => p.published)
      const sorted = [...publishedPieces].sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''))
      const latestPiece = sorted[0]
      const count = publishedPieces.length

      title = `${store.child_name}'s Gallery on Draw Up`
      description = count > 0
        ? `Step inside ${count} ${count === 1 ? 'world' : 'worlds'} dreamed up by ${store.child_name}.`
        : `${store.child_name}'s drawings will live here. Step inside soon.`
      bodyHeadline = `${store.child_name}'s Gallery`
      bodySubtitle = description
      bylineLabel = count > 0 ? `${count} ${count === 1 ? 'world' : 'worlds'}` : null
      ctaLabel = "Visit the gallery on Draw Up"
      if (latestPiece) {
        imageUrl = latestPiece.transformed_image_url || latestPiece.watermarked_image_url || imageUrl
      }
    }
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${title}</title>
  <meta name="title" content="${title}">
  <meta name="description" content="${description}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:site_name" content="Draw Up">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${canonicalUrl}">
  <meta property="twitter:title" content="${title}">
  <meta property="twitter:description" content="${description}">
  <meta property="twitter:image" content="${imageUrl}">

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { background: #FEFAF3; color: #1C1810; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
      min-height: 100vh;
      padding: 32px 20px 48px;
    }
    .wrap { max-width: 520px; margin: 0 auto; }
    .brand { text-align: center; font-weight: 900; letter-spacing: -1px; font-size: 22px; margin-bottom: 24px; color: #1C1810; }
    .brand span { color: #E8A020; }
    .card {
      background: #FFFFFF;
      border-radius: 24px;
      overflow: hidden;
      border: 1px solid #EDE4D0;
      box-shadow: 0 12px 40px rgba(28,24,16,0.06);
    }
    .hero { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; background: #EDE4D0; }
    .body { padding: 28px 24px 24px; text-align: center; }
    .byline { color: #A89880; font-size: 13px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase; margin-bottom: 8px; }
    h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.6px; line-height: 1.15; margin-bottom: 14px; }
    p.desc { color: #6B5E4E; line-height: 1.55; font-size: 16px; margin-bottom: 28px; }
    .cta {
      background: #1C1810;
      color: #FFFFFF;
      text-decoration: none;
      padding: 16px 28px;
      border-radius: 999px;
      font-weight: 700;
      display: inline-block;
      font-size: 16px;
      transition: transform 0.15s ease;
    }
    .cta:hover { transform: scale(1.02); }
    .footer { text-align: center; color: #A89880; font-size: 13px; margin-top: 24px; }
    .footer a { color: #6B5E4E; text-decoration: none; border-bottom: 1px solid #EDE4D0; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">draw <span>up</span></div>
    <div class="card">
      <img class="hero" src="${imageUrl}" alt="${bodyHeadline}">
      <div class="body">
        ${bylineLabel ? `<div class="byline">${bylineLabel}</div>` : ''}
        <h1>${bodyHeadline}</h1>
        <p class="desc">${bodySubtitle}</p>
        <a class="cta" href="${APP_STORE_URL}">${ctaLabel}</a>
      </div>
    </div>
    <div class="footer">Made with <a href="${APP_STORE_URL}">Draw Up</a> — step inside your child's drawing.</div>
  </div>
</body>
</html>
`

  return new Response(html, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html',
    },
  })
})
