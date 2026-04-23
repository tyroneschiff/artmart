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

  let title = "Draw Up — Step inside your child's imagination"
  let description = "AI transforms children's drawings into a world you can step inside. Preserve the magic, share with family, and bring their imagination home."
  let imageUrl = "https://artmart.drawup.app/og-default.png" // Placeholder
  let redirectUrl = "https://drawup.art"

  if (pieceId) {
    const { data: piece, error } = await supabase
      .from('pieces')
      .select('title, ai_description, transformed_image_url, stores(child_name, slug)')
      .eq('id', pieceId)
      .single()

    if (piece && !error) {
      const childName = (piece.stores as any)?.child_name || 'a young artist'
      title = `${piece.title || 'Untitled'} — by ${childName}`
      description = piece.ai_description || description
      imageUrl = piece.transformed_image_url
      redirectUrl = `https://drawup.art/piece/${pieceId}`
    }
  } else if (storeSlug) {
    const { data: store, error } = await supabase
      .from('stores')
      .select('child_name, pieces(transformed_image_url)')
      .eq('slug', storeSlug)
      .order('created_at', { foreignTable: 'pieces', ascending: false })
      .limit(1, { foreignTable: 'pieces' })
      .single()

    if (store && !error) {
      title = `${store.child_name}'s Art Store`
      description = `Step inside ${store.child_name}'s imagination. Browse their artwork and bring their world home.`
      const latestPiece = store.pieces?.[0]
      if (latestPiece) {
        imageUrl = latestPiece.transformed_image_url
      }
      redirectUrl = `https://drawup.art/store/${storeSlug}`
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
  <meta property="og:url" content="${url.href}">
  <meta property="og:site_name" content="Draw Up">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${url.href}">
  <meta property="twitter:title" content="${title}">
  <meta property="twitter:description" content="${description}">
  <meta property="twitter:image" content="${imageUrl}">

  <style>
    body {
      background-color: #FEFAF3;
      color: #1C1810;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      padding: 20px;
      text-align: center;
    }
    .card {
      background: white;
      border-radius: 24px;
      padding: 32px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.05);
      max-width: 500px;
      width: 100%;
      border: 1px solid #EDE4D0;
    }
    img {
      width: 100%;
      border-radius: 16px;
      margin-bottom: 24px;
      aspect-ratio: 1;
      object-fit: cover;
    }
    h1 {
      font-size: 24px;
      font-weight: 800;
      margin-bottom: 12px;
      letter-spacing: -1px;
    }
    p {
      color: #6B5E4E;
      line-height: 1.5;
      margin-bottom: 32px;
    }
    .btn {
      background: #1C1810;
      color: white;
      text-decoration: none;
      padding: 16px 32px;
      border-radius: 100px;
      font-weight: 700;
      display: inline-block;
      transition: transform 0.2s;
    }
    .btn:hover {
      transform: scale(1.02);
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="${imageUrl}" alt="${title}">
    <h1>${title}</h1>
    <p>${description}</p>
    <a href="${redirectUrl}" class="btn">View on Draw Up</a>
  </div>
  <script>
    // Optional: Auto-redirect to app if not a crawler
    // const isCrawler = /bot|googlebot|crawler|spider|robot|crawling/i.test(navigator.userAgent);
    // if (!isCrawler) {
    //   window.location.href = "${redirectUrl}";
    // }
  </script>
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
