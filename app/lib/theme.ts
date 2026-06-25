// Radius scale — intentional rather than arbitrary. sm=chips/inputs,
// md=cards/standard, lg=large cards & sheets, xl=bottom-sheet tops,
// pill=capsule buttons & badges. Use these instead of hardcoded numbers.
export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 100,
} as const

// Single source of truth for disabled-button opacity. Was split 0.4/0.5
// across 6 files — 0.5 reads "off" without being too faint to see.
export const opacity = {
  disabled: 0.5,
} as const

export const colors = {
  cream: '#FEFAF3',
  creamDark: '#F5EDD8',
  white: '#FFFFFF',
  border: '#EDE4D0',
  gold: '#E8A020',
  goldDark: '#8B5E00',
  goldLight: '#FDF0D5',
  goldMid: '#F5C96A',
  dark: '#1C1810',
  mid: '#6B5E4E',
  muted: '#A89880',
  danger: '#C0392B',
  dangerText: '#8B1A1A',
  dangerBg: '#FFF5F5',
  dangerBorder: '#F5C0C0',
  // Overlay/scrim family — replaces the rgba(0,0,0,*) literals that were
  // scattered across vote badges, dropdowns, and the lightbox.
  scrim: 'rgba(0,0,0,0.45)',
  scrimStrong: 'rgba(0,0,0,0.95)',
  scrimSoft: 'rgba(0,0,0,0.25)',
  scrimWhite: 'rgba(255,255,255,0.15)',
  // WhatsApp brand green — kept as a token so the "no raw hex" rule holds.
  whatsapp: '#25D366',
}

// Consistent top inset for screens that don't sit under a native header.
// Was copy-pasted as `paddingTop: 56` across ~8 files.
export const layout = {
  screenTop: 56,
} as const

export const type = {
  h1: { fontSize: 32, fontWeight: '900' as const, letterSpacing: -1, color: colors.dark },
  h2: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.5, color: colors.dark },
  h3: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3, color: colors.dark },
  // 13px bold card title used on the Discover + Gallery 2-up grids.
  cardTitle: { fontSize: 13, fontWeight: '700' as const, letterSpacing: -0.2, color: colors.dark },
  // Centered muted intro paragraph (onboarding lede, credits subhead, login tagline).
  lede: { fontSize: 15, fontWeight: '500' as const, color: colors.mid, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.mid, lineHeight: 22 },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.5, color: colors.muted },
}

export const btn = {
  primary: {
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center' as const,
  },
  primaryText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  ghost: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: 28,
    alignItems: 'center' as const,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  ghostText: {
    color: colors.mid,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  secondary: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center' as const,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  secondaryText: {
    color: colors.dark,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  disabledOpacity: opacity.disabled,
}

export const card = {
  backgroundColor: colors.white,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.border,
}

// The app's most-repeated visual unit: a soft gold-bordered light card.
// Was copy-pasted (goldLight bg + goldMid border + radius.md) into the
// create description box, inline-store create, mystores upsell,
// credits balance/featured, and onboarding bubbles.
export const goldCard = {
  backgroundColor: colors.goldLight,
  borderRadius: radius.md,
  borderWidth: 1,
  borderColor: colors.goldMid,
}
