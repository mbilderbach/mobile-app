/**
 * Nova Assist design tokens.
 *
 * Nova Assist ships its own brand palette — a cool slate ink on a near-white
 * canvas, with a single lime→cyan gradient reserved for the "New chat" mark.
 * These are lifted verbatim from the Figma spec (named styles "Slate/Slate",
 * "Slate/Lighter slate", etc.) and kept separate from the app's violet theme
 * so the surface matches the mockups exactly.
 */
export const nova = {
  // Canvas
  canvas: '#FAFBFC',

  // Slate ink ramp
  slate: '#546A83', // primary text + icons ("Slate/Slate")
  slateBold: '#2E3D52', // selected / emphasised row text
  slateQuiet: '#8A99AC', // section kickers ("TODAY"), muted labels

  // Lines & fills
  line: '#DEE2E7', // hairline dividers, control borders ("Lighter slate")
  rowSelected: '#E6EAEF', // highlighted history row
  segmentTrack: '#FFFFFF', // account toggle track
  segmentActive: '#FFFFFF', // active segment chip

  // New-chat mark
  newChatGradient: ['#A4F5FF', '#E7FC53'] as const, // 97.18deg in Figma
  newChatInk: '#3C461E', // the "+" glyph
} as const;

export const NOVA_FONT = {
  // Figma uses Open Sans; the app ships Inter, whose 600/400 weights are the
  // closest available match for the "Body - Heavy" / "Body" styles.
  heavy: 'Inter-SemiBold',
  regular: 'Inter-Regular',
} as const;

/** Sidebar panel width from the spec. */
export const NOVA_SIDEBAR_WIDTH = 288;
