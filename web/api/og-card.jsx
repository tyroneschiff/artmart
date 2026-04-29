// Dynamic OG share card generator.
//
// Renders a 1200x630 PNG showing the child's ORIGINAL drawing alongside
// the AI-rendered WORLD — so when someone shares a Draw Up link in
// iMessage/WhatsApp, the receiver immediately sees the relationship
// (kid drew this · Draw Up rendered the world) without needing the
// parent to explain it.
//
// Edge runtime + @vercel/og. Cached at the CDN so each piece's card
// is generated once and then served fast.

import { ImageResponse } from "@vercel/og"

export const config = { runtime: "edge" }

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

async function fetchPiece(id) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/pieces?id=eq.${encodeURIComponent(id)}&select=title,original_image_url,transformed_image_url,watermarked_image_url,stores(child_name)`,
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

async function fetchGallery(slug) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/stores?slug=eq.${encodeURIComponent(slug)}&select=child_name,pieces(original_image_url,transformed_image_url,watermarked_image_url,created_at,published)`,
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

export default async function handler(req) {
  const url = new URL(req.url)
  const type = url.searchParams.get("type")
  const id = url.searchParams.get("id")

  let original = null
  let transformed = null
  let childName = "a young artist"
  let title = ""

  try {
    if (type === "piece" && id) {
      const piece = await fetchPiece(id)
      if (piece) {
        original = piece.original_image_url
        transformed = piece.transformed_image_url || piece.watermarked_image_url
        childName = piece.stores?.child_name || childName
        title = piece.title || ""
      }
    } else if ((type === "gallery" || type === "store") && id) {
      const gallery = await fetchGallery(id)
      if (gallery) {
        const published = (gallery.pieces || []).filter((p) => p.published && p.original_image_url)
        const sorted = published.slice().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
        const latest = sorted[0]
        if (latest) {
          original = latest.original_image_url
          transformed = latest.transformed_image_url || latest.watermarked_image_url
        }
        childName = gallery.child_name || childName
      }
    }
  } catch (e) {
    // Fall through to default card
  }

  // Fallback: brand splash if we don't have a pair
  if (!original || !transformed) {
    return new ImageResponse(
      <BrandFallback />,
      { width: 1200, height: 630 }
    )
  }

  return new ImageResponse(
    <BeforeAfterCard
      original={original}
      transformed={transformed}
      childName={childName}
      title={title}
      type={type}
    />,
    {
      width: 1200,
      height: 630,
      headers: {
        "cache-control": "public, immutable, no-transform, s-maxage=31536000, max-age=31536000",
      },
    }
  )
}

function BeforeAfterCard({ original, transformed, childName, title, type }) {
  const headline =
    type === "piece"
      ? `${childName} drew this.`
      : `${childName}'s gallery on Draw Up.`
  const subhead =
    type === "piece"
      ? `Draw Up turned it into a world.`
      : `Every drawing, brought to life.`

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#FEFAF3",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Top row: two image panels with arrow between */}
      <div
        style={{
          display: "flex",
          flex: 1,
          padding: "32px 32px 0 32px",
          gap: 16,
          alignItems: "center",
        }}
      >
        <ImagePanel src={original} label="THE DRAWING" labelBg="#1C1810" labelColor="#FEFAF3" />
        <Arrow />
        <ImagePanel src={transformed} label="THE WORLD" labelBg="#E8A020" labelColor="#FFFFFF" />
      </div>

      {/* Bottom: copy + brand */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "20px 36px 28px 36px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: -1.4,
                color: "#1C1810",
                lineHeight: 1.1,
              }}
            >
              {headline}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: "#6B5E4E",
                marginTop: 4,
                letterSpacing: -0.4,
              }}
            >
              {subhead}
            </div>
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: "#1C1810",
              letterSpacing: -0.8,
            }}
          >
            draw <span style={{ color: "#E8A020" }}>up</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ImagePanel({ src, label, labelBg, labelColor }) {
  return (
    <div
      style={{
        flex: 1,
        height: 420,
        position: "relative",
        display: "flex",
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        border: "1px solid #EDE4D0",
        overflow: "hidden",
      }}
    >
      <img
        src={src}
        width={520}
        height={420}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -10,
          left: 16,
          backgroundColor: labelBg,
          color: labelColor,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: 0.8,
          padding: "5px 12px",
          borderRadius: 999,
          display: "flex",
        }}
      >
        {label}
      </div>
    </div>
  )
}

function Arrow() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#A89880",
        fontSize: 36,
        fontWeight: 300,
        width: 28,
      }}
    >
      →
    </div>
  )
}

function BrandFallback() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FEFAF3",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          fontSize: 64,
          fontWeight: 900,
          letterSpacing: -2,
          color: "#1C1810",
        }}
      >
        draw <span style={{ color: "#E8A020" }}>up</span>
      </div>
      <div
        style={{
          fontSize: 28,
          color: "#6B5E4E",
          marginTop: 12,
          fontWeight: 500,
        }}
      >
        Step inside your child's drawing
      </div>
    </div>
  )
}
