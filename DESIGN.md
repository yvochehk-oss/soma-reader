---
# DESIGN.md - Soma African Reader & Fanqie UI Design System Manifest
name: soma-fanqie-reader
version: 1.0.0
description: Standardized design system manifest for Soma African Reading App with Fanqie Novel Mobile-First UI patterns.

tokens:
  colors:
    primary:
      orange: "#ED7248"
      orange_dark: "#C95631"
      orange_light: "#FFF0EB"
    neutral:
      ink: "#172B29"
      muted: "#6E7E7A"
      paper: "#F8F7F2"
      surface: "#FFFFFF"
      line: "#E5E8E2"
    secondary:
      teal: "#1E7772"
      cream: "#F1E6D0"
      amber: "#E6A13C"
      purple: "#8879AF"
      green: "#6B9E59"
    rank_metallic:
      gold_start: "#FFC837"
      gold_end: "#FF8008"
      silver_start: "#E0E0E0"
      silver_end: "#8A9EA7"
      bronze_start: "#F09819"
      bronze_end: "#ED6EA0"

  typography:
    font_family_base: "Arial, Helvetica, sans-serif"
    font_family_serif: "Georgia, serif"
    heading_sizes:
      h1_mobile: "38px"
      h1_desktop: "58px"
      h2_mobile: "24px"
      h2_desktop: "29px"
      h3_mobile: "17px"
      h3_desktop: "21px"
    body_sizes:
      sm: "11px"
      base: "13px"
      md: "14px"
      lg: "16px"

  spacing:
    container_max_width: "1120px"
    touch_target_min: "44px"
    header_height_desktop: "70px"
    header_height_mobile: "60px"
    bottom_nav_height: "56px"

  radii:
    card: "18px"
    cover: "10px"
    pill: "99px"
    icon: "14px"

  shadows:
    sm: "0 4px 12px rgba(23, 43, 41, 0.03)"
    md: "0 6px 18px rgba(23, 43, 41, 0.04)"
    lg: "0 12px 30px rgba(23, 43, 41, 0.10)"
    orange_glow: "0 4px 14px rgba(237, 114, 72, 0.12)"
---

# Soma African Reader (Fanqie Mobile-First Design System)

This document dictates the visual identity, UI patterns, and layout principles for **Soma**, a mobile-first African (Kenyan) web novel reader platform supporting English and Kiswahili, styled after the high-engagement **Fanqie Novel Reader (番茄小说)** app.

---

## 1. Visual Theme & Atmosphere

* **Mobile-First App Feel**: The UI is designed primarily for smartphones (375px–430px viewports), featuring large touch targets, sticky search header, horizontal swipeable cards, and fixed bottom navigation.
* **Warm African Warmth Meets Fanqie Energy**: Combines vibrant warmth (warm orange `#ED7248`, savannah green `#172B29`, and parchment cream `#F8F7F2`) with high-energy novel badges and rankings.
* **Tactile Glassmorphism & Elevation**: Subtle backdrop blurs (`backdrop-filter: blur(12px)`), soft card elevation, and smooth micro-scale interactions on hover/tap.

---

## 2. Color Palette & Roles

| Token Role | Hex Code | Usage |
| :--- | :--- | :--- |
| `primary.orange` | `#ED7248` | Main action buttons, active tabs, search button, brand accent |
| `primary.orange_dark` | `#C95631` | Hover states, active links, rank heat tags |
| `neutral.ink` | `#172B29` | Headings, primary body text, dark buttons, container borders |
| `neutral.muted` | `#6E7E7A` | Secondary text, captions, inactive nav icons |
| `neutral.paper` | `#F8F7F2` | Page background, reading surface base |
| `neutral.surface` | `#FFFFFF` | Cards, search input background, popups, header background |
| `secondary.cream` | `#F1E6D0` | Language banner background, warm highlight sections |

---

## 3. Core Component Patterns

### A. Sticky Fanqie Header & Search (`.fanqie-header-wrapper`)
* **Floating Header**: Sticky at top (`z-index: 100`) with glassmorphism blur and subtle shadow.
* **Search Input Bar (`.fanqie-search-box`)**: 
  - Pill-shaped (`border-radius: 99px`), 2px solid orange border.
  - Contains magnifying icon 🔍, prompt text ("Search title, author or keywords..."), and rounded search action button.
* **Channel Tabs (`.fanqie-channel-tabs`)**: Horizontal scroll bar with categories (`Home`, `Romance`, `Thriller`, `Rankings`, `Completed`). Active tab highlights with orange bottom border.

### B. Golden Diamond Shortcuts (`.fanqie-quick-grid`)
* 5 Grid items across mobile & desktop:
  1. 🔥 **Top Rankings** (Orange Gradient)
  2. ⚡️ **Just Added** (Teal Gradient)
  3. 🎁 **Free Zone** (Purple Gradient)
  4. 🏆 **Completed** (Green Gradient)
  5. 🌐 **Swahili / English** (Amber Gradient)
* Micro-interaction: `transform: translateY(-4px)` on hover with smooth shadow depth.

### C. Leaderboard Ranking Cards (`.fanqie-rank-card`)
* **Rank Badges (🥇 🥈 🥉)**:
  - **Rank 1**: Metallic Gold Gradient (`linear-gradient(135deg, #FFC837, #FF8008)`)
  - **Rank 2**: Metallic Silver Gradient (`linear-gradient(135deg, #E0E0E0, #8A9EA7)`)
  - **Rank 3**: Metallic Bronze Gradient (`linear-gradient(135deg, #F09819, #ED6EA0)`)
* **Popularity Heat Tag**: Light pink background `#FFF0EB` displaying reader count e.g., `🔥 212k Readers`.

### D. Book Cards & Book Covers (`.book-card`, `.book-cover`)
* Aspect ratio and depth: Medium covers (`height: 218px` desktop / `185px` mobile) with 3D gradient spine overlay and clean typography.
* Title line-clamp: Maximum 2 lines with `-webkit-line-clamp: 2`.

---

## 4. Layout & Ergonomics

* **Mobile (<= 760px)**:
  - Grid converts into horizontal swipeable lists (`overflow-x: auto; scroll-snap-type: x proximity;`).
  - Search input expands to full screen width.
  - Mobile bottom navigation bar (`.bottom-nav`) stays fixed at bottom with safe-area padding.
* **Desktop (> 760px)**:
  - Max width container: `min(1120px, calc(100% - 48px))` centered.
  - Multi-column grids (3-column leaderboard, 5-column diamond entry, 4-column book discovery).

---

## 5. Strict Guardrails (Do's and Don'ts for AI Agents)

### ✅ DO's:
* **Mobile-First Priority**: Always prioritize touch-friendly ergonomics (minimum 44px tap targets).
* **Pure UI Changes**: Maintain strict separation between visual rendering and data layer.
* **Preserve i18n Translation Hooks**: Always render labels using the `<T id="..." />` component or `t("...")` helper.
* **Vanilla CSS Alignment**: Write clean, standard CSS in `app/globals.css` using CSS custom properties (`var(--orange)`, `var(--ink)`).

### ❌ DON'Ts:
* **DO NOT** alter database fetching functions (`listPublishedBooks`, Supabase schema, or server actions).
* **DO NOT** introduce arbitrary third-party utility frameworks like Tailwind unless requested.
* **DO NOT** remove mobile touch optimization or break fixed bottom navigation rules.
