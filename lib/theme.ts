/**
 * Design system — Haptic, refined. Now light + dark.
 *
 * Grounded in the real Haptic iOS app: a near-monochrome canvas where a single
 * violet accent is reserved for THE primary action. Big headlines paired with a
 * same-scale lighter subtitle. Whisper-soft, large-radius raised cards.
 * Uppercase micro-kickers, ghost-outline metadata pills, nested action rows.
 *
 * Colour discipline — read before adding violet:
 *  - `primary` (violet) = the ONE committing action per screen (Pray / Save /
 *    Sign in / create FAB) and the brand mark. Never for passive text, counts,
 *    or tags; never more than one violet element in a single view.
 *  - Selection / active states use `selectedBg` (soft violet tint) + `selectedText`,
 *    NOT a saturated violet fill.
 *  - Metadata, counts, tags, and kickers are neutral gray.
 *
 * THEMING: screens build styles from the active palette via a `makeStyles`
 * factory whose parameter is named `colors`, plus `const colors = useTheme()`
 * (from contexts/ThemeContext) for inline values. The static `colors` export
 * below is the LIGHT palette — kept as a default/SSR-safe alias so any module
 * that hasn't been migrated still compiles and renders (in light).
 */

const violet = '#7C5CFC';
const violetDark = '#6A45F0';
const violetSoft = '#ECE7FF'; // light selection / brand wash
const violetSoftDk = '#2A2540'; // dark selection / brand wash
const violetText = '#B6A6FF'; // selection text on dark surfaces

export const lightColors = {
  // Brand — the single accent
  primary: violet,
  primaryDark: violetDark,
  primarySoft: violetSoft,
  onPrimary: '#FFFFFF',

  // Selection (restrained: soft tint, never a full violet fill)
  selectedBg: violetSoft,
  selectedText: violet,

  // Surfaces — cool off-white canvas, pure-white raised tiles
  paper: '#F8F8FA',
  surface: '#FFFFFF',
  sectionBg: '#EFEFF3',
  fill: '#F1F1F5',
  cardBg: '#FFFFFF',

  // Text — softened cool dark grays (never pure black)
  ink: '#2B2A31',
  inkSoft: '#3D3C45',
  muted: '#74737D',
  quiet: '#A6A5AF',
  faint: '#C9C8D0',

  // Lines & status
  divider: '#E8E8ED',
  hairline: '#EDEDF1',
  red: '#FB5C4A',
  error: '#E5413A',
  success: '#34C759',
  white: '#FFFFFF',

  // Legacy alias
  amber: violet,
};

export type ThemeColors = typeof lightColors;

export const darkColors: ThemeColors = {
  // Brand — accent stays violet; the committing action still pops on dark.
  primary: violet,
  primaryDark: violetDark,
  primarySoft: violetSoftDk,
  onPrimary: '#FFFFFF',

  // Selection — soft violet wash + lighter violet text for contrast.
  selectedBg: violetSoftDk,
  selectedText: violetText,

  // Surfaces — deep cool charcoal canvas with clearly raised tiles. On dark,
  // shadows barely register, so elevation reads through surface lightness:
  // paper < surface < sectionBg/fill. Each step is a perceptible lift.
  paper: '#131217',
  surface: '#211F2A',
  sectionBg: '#2C2B37',
  fill: '#2C2B37',
  cardBg: '#211F2A',

  // Text — soft off-whites, never pure white. The secondary/tertiary ramp is
  // lifted vs a naive dark theme so metadata and the big hero subtitle stay
  // legible against charcoal (≈4.5:1 body, ≈3:1 large display) while still
  // reading as calm and recessive.
  ink: '#F4F3F8',
  inkSoft: '#DEDDE6',
  muted: '#A8A7B4',
  quiet: '#8A8995',
  faint: '#6E6D79',

  // Lines & status
  divider: '#33323E',
  hairline: '#2A2933',
  red: '#FF6F60',
  error: '#FF6B5E',
  success: '#3DDC6E',
  white: '#FFFFFF',

  amber: violet,
};

// Static light alias — default for non-migrated modules and non-React code.
export const colors = lightColors;

export const fonts = {
  display: 'Inter-ExtraBold',
  sansExtraBold: 'Inter-ExtraBold',
  sansBold: 'Inter-Bold',
  sansSemiBold: 'Inter-SemiBold',
  sansMedium: 'Inter-Medium',
  sans: 'Inter-Regular',
  serif: 'PlayfairDisplay-Regular',
  serifItalic: 'PlayfairDisplay-Italic',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 22,
  xl: 28,
  pill: 9999,
};

export const shadow = {
  // Whisper-soft, diffuse elevation. Barely visible on dark (cards separate by
  // surface colour there), gentle on light.
  card: {
    shadowColor: '#23222E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 2,
  },
  // Soft brand glow reserved for the single primary CTA / FAB.
  float: {
    shadowColor: violet,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 5,
  },
};
