// Dynamic OG share card generator.
//
// Renders a 1200x630 PNG showing the AI-rendered WORLD as the hero
// (the "wow") with the child's ORIGINAL drawing as a small inset on
// the right (the attribution). Tells the same story as the previous
// side-by-side layout but reads at iMessage preview thumbnail size,
// where two equal panels were too small to land.
//
// Edge runtime + @vercel/og. Plain createElement (no JSX) so this
// compiles without any JSX transform pipeline.

import React from "react"
import { ImageResponse } from "@vercel/og"

export const config = { runtime: "edge" }

const h = React.createElement

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

async function fetchPiece(id: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/pieces?id=eq.${encodeURIComponent(id)}&select=title,original_image_url,transformed_image_url,watermarked_image_url,stores(child_name)`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  )
  if (!res.ok) return null
  const rows = await res.json()
  return rows && rows[0] ? rows[0] : null
}

async function fetchGallery(slug: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/stores?slug=eq.${encodeURIComponent(slug)}&select=child_name,pieces(original_image_url,transformed_image_url,watermarked_image_url,created_at,published)`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  )
  if (!res.ok) return null
  const rows = await res.json()
  return rows && rows[0] ? rows[0] : null
}

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const type = url.searchParams.get("type")
  const id = url.searchParams.get("id")

  let original: string | null = null
  let transformed: string | null = null
  let childName = "a young artist"

  try {
    if (type === "piece" && id) {
      const piece = await fetchPiece(id)
      if (piece) {
        original = piece.original_image_url
        transformed = piece.transformed_image_url || piece.watermarked_image_url
        childName = piece.stores?.child_name || childName
      }
    } else if ((type === "gallery" || type === "store") && id) {
      const gallery = await fetchGallery(id)
      if (gallery) {
        const published = (gallery.pieces || []).filter((p: any) => p.published && p.original_image_url)
        const sorted = published.slice().sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""))
        const latest = sorted[0]
        if (latest) {
          original = latest.original_image_url
          transformed = latest.transformed_image_url || latest.watermarked_image_url
        }
        childName = gallery.child_name || childName
      }
    }
  } catch {
    // Fall through to default card
  }

  if (!original || !transformed) {
    return new ImageResponse(brandFallback(), { width: 1200, height: 630 })
  }

  return new ImageResponse(
    heroCard({ original, transformed, childName, type: type || "piece" }),
    {
      width: 1200,
      height: 630,
      headers: {
        "cache-control": "public, immutable, no-transform, s-maxage=31536000, max-age=31536000",
      },
    }
  )
}

// ── Element builders (createElement, no JSX) ─────────────────────────────

function heroCard({
  original,
  transformed,
  childName,
  type,
}: {
  original: string
  transformed: string
  childName: string
  type: string
}) {
  const headline =
    type === "piece" ? `${childName} drew this.` : `${childName}'s gallery on Draw Up.`
  const subhead =
    type === "piece" ? `Draw Up turned it into a world.` : `Every drawing, brought to life.`

  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: "#FEFAF3",
        fontFamily: "system-ui, -apple-system, sans-serif",
      },
    },
    // Hero: rendered world image, full-bleed left ~55%
    h("img", {
      src: transformed,
      width: 660,
      height: 630,
      style: {
        width: 660,
        height: 630,
        objectFit: "cover",
        flexShrink: 0,
      },
    }),
    // Right pane: drawing inset on top, headline + brand on bottom
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "48px 44px 40px 40px",
          justifyContent: "space-between",
        },
      },
      // Top: small drawing inset with caption
      h(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        h(
          "div",
          {
            style: {
              display: "flex",
              fontSize: 13,
              fontWeight: 800,
              color: "#A89880",
              letterSpacing: 1.2,
              marginBottom: 12,
              textTransform: "uppercase",
            },
          },
          `${childName}'s drawing`
        ),
        h("img", {
          src: original,
          width: 168,
          height: 168,
          style: {
            width: 168,
            height: 168,
            objectFit: "cover",
            borderRadius: 14,
            border: "1px solid #EDE4D0",
            backgroundColor: "#FFFFFF",
          },
        })
      ),
      // Bottom: headline + subhead + brand
      h(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        h(
          "div",
          {
            style: {
              fontSize: 38,
              fontWeight: 900,
              letterSpacing: -1.4,
              color: "#1C1810",
              lineHeight: 1.05,
              marginBottom: 8,
            },
          },
          headline
        ),
        h(
          "div",
          {
            style: {
              fontSize: 19,
              fontWeight: 600,
              color: "#6B5E4E",
              letterSpacing: -0.4,
              marginBottom: 24,
            },
          },
          subhead
        ),
        h(
          "div",
          {
            style: {
              display: "flex",
              fontSize: 24,
              fontWeight: 900,
              color: "#1C1810",
              letterSpacing: -0.8,
            },
          },
          "draw ",
          h("span", { style: { color: "#E8A020" } }, "up")
        )
      )
    )
  )
}

function brandFallback() {
  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FEFAF3",
        fontFamily: "system-ui, -apple-system, sans-serif",
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          fontSize: 64,
          fontWeight: 900,
          letterSpacing: -2,
          color: "#1C1810",
        },
      },
      "draw ",
      h("span", { style: { color: "#E8A020" } }, "up")
    ),
    h(
      "div",
      {
        style: {
          fontSize: 28,
          color: "#6B5E4E",
          marginTop: 12,
          fontWeight: 500,
        },
      },
      "Step inside your child's drawing"
    )
  )
}
