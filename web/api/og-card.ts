// Dynamic OG share card generator.
//
// Renders a 1200x630 PNG showing the child's ORIGINAL drawing alongside
// the AI-rendered WORLD — so when someone shares a Draw Up link in
// iMessage/WhatsApp, the receiver immediately sees the relationship
// (kid drew this · Draw Up rendered the world) without needing the
// parent to explain it.
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
    beforeAfterCard({ original, transformed, childName, type: type || "piece" }),
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

function beforeAfterCard({
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
        flexDirection: "column",
        backgroundColor: "#FEFAF3",
        fontFamily: "system-ui, -apple-system, sans-serif",
      },
    },
    // Top row: two image panels with arrow between.
    // 48px top padding gives the floating labels (top: -10) breathing room
    // so they don't clip against iMessage's preview crop.
    h(
      "div",
      {
        style: {
          display: "flex",
          flex: 1,
          padding: "48px 32px 0 32px",
          gap: 16,
          alignItems: "center",
        },
      },
      imagePanel(original, "THE DRAWING", "#1C1810", "#FEFAF3"),
      arrow(),
      imagePanel(transformed, "THE WORLD", "#E8A020", "#FFFFFF")
    ),
    // Bottom: copy + brand
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          padding: "20px 36px 28px 36px",
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
          },
        },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column" } },
          h(
            "div",
            {
              style: {
                fontSize: 36,
                fontWeight: 900,
                letterSpacing: -1.4,
                color: "#1C1810",
                lineHeight: 1.1,
              },
            },
            headline
          ),
          h(
            "div",
            {
              style: {
                fontSize: 22,
                fontWeight: 600,
                color: "#6B5E4E",
                marginTop: 4,
                letterSpacing: -0.4,
              },
            },
            subhead
          )
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
          "draw ",
          h("span", { style: { color: "#E8A020" } }, "up")
        )
      )
    )
  )
}

function imagePanel(src: string, label: string, labelBg: string, labelColor: string) {
  return h(
    "div",
    {
      style: {
        flex: 1,
        height: 420,
        position: "relative",
        display: "flex",
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        border: "1px solid #EDE4D0",
        overflow: "hidden",
      },
    },
    h("img", {
      src,
      width: 520,
      height: 420,
      style: { width: "100%", height: "100%", objectFit: "cover" },
    }),
    h(
      "div",
      {
        style: {
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
        },
      },
      label
    )
  )
}

function arrow() {
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#A89880",
        fontSize: 36,
        fontWeight: 300,
        width: 28,
      },
    },
    "→"
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
      "draw ",
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
