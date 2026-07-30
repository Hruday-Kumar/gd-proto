---
name: gd-proto
description: A reliable, efficient app UI for joining rooms, matchmaking, and viewing history.
colors:
  primary: "#2563eb"
  on-primary: "#ffffff"
  primary-container: "#dbeafe"
  on-primary-container: "#1e3a8a"
  secondary: "#64748b"
  on-secondary: "#ffffff"
  secondary-container: "#e2e8f0"
  tertiary: "#b45309"
  tertiary-container: "#fef3c7"
  on-tertiary-container: "#78350f"
  success: "#059669"
  success-container: "#d1fae5"
  danger: "#dc2626"
  danger-container: "#fee2e2"
  surface: "#ffffff"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f8fafc"
  surface-container: "#f1f5f9"
  surface-container-high: "#e2e8f0"
  on-surface: "#0f172a"
  on-surface-variant: "#475569"
  outline: "#94a3b8"
  outline-variant: "#cbd5e1"
  border-base: "#e2e8f0"
  background: "#f8fafc"
  text-primary: "#0f172a"
  text-secondary: "#64748b"
typography:
  headline-xl:
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "2.5rem"
    lineHeight: 1.1
  headline-lg:
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "2rem"
    lineHeight: 1.15
  headline-md:
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.5rem"
    lineHeight: 1.25
  headline-sm:
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.25rem"
    lineHeight: 1.3
  body-lg:
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.125rem"
    lineHeight: 1.5
  body-md:
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    lineHeight: 1.5
  body-sm:
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    lineHeight: 1.45
  label-md:
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    lineHeight: 1.3
  label-sm:
    fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    lineHeight: 1.3
rounded:
  lg: "0.5rem"
  xl: "0.75rem"
  full: "9999px"
spacing:
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
    padding: "0.75rem 2rem"
  card-container:
    backgroundColor: "{colors.surface-container-lowest}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
  pill-status:
    backgroundColor: "{colors.surface-container-high}"
    rounded: "{rounded.full}"
    padding: "0.375rem 1.5rem"
---

# Design System: gd-proto

## 1. Overview

**Creative North Star: "The Modern Atheneum"**

This system represents a professional, secure, and focused environment. It prioritizes clear navigation and workflow completion over playful academic tropes. The design is structured and legible, instilling confidence and reliability without feeling outdated or institutional. It rejects clunky legacy layouts in favor of modern efficiency, precision, and ambient depth.

**Key Characteristics:**
- Crisp Digital Sapphire accents against cool off-white backgrounds
- Inter-based typography system optimized for dense data and clear hierarchy
- Soft, diffuse shadows (ambient depth) that create a structured, tactile environment
- Forceful rejection of generic academic portal clichés

## 2. Colors

A structured, serious palette anchored by a crisp blue accent.

### Primary
- **Crisp Digital Sapphire** (#2563eb): Used for primary actions, active states, and high-emphasis indicators. Confident and focused.

### Secondary
- **Slate Gray** (#64748b): Supports the primary color for secondary information, borders, and disabled or less critical states.

### Tertiary
- **Warm Amber** (#b45309): Used sparingly for accents, highlights, or warnings that require attention without indicating failure.

### Neutral
- **Off-White Canvas** (#f8fafc): The primary background color. Cool and clean, avoiding the warm "paper" AI default.
- **Deep Ink** (#0f172a): Used for primary text (`text-primary`). Ensures high contrast against light surfaces.

### Named Rules
**The Crisp Anchor Rule.** The primary blue (#2563eb) is used purposefully and sparingly. If more than 20% of a screen's surface area is primary blue, it's too loud for this system.

## 3. Typography

**Display Font:** Inter (with system-ui, sans-serif)
**Body Font:** Inter (with system-ui, sans-serif)

**Character:** Highly legible, precise, and unadorned. Built for efficiency and clarity in a functional product.

### Hierarchy
- **Headline XL** (2.5rem, 1.1): Used for major page titles or empty states.
- **Headline MD/LG** (1.5rem-2rem, 1.15-1.25): Used for primary content sections and modal headers.
- **Headline SM** (1.25rem, 1.3): Used for card titles and sub-sections.
- **Body MD/LG** (1rem-1.125rem, 1.5): Standard prose and paragraph text. Max line length ~70ch.
- **Body SM** (0.875rem, 1.45): Supporting text, descriptions, and secondary data.
- **Label MD** (0.875rem, 1.3, semibold): Button labels, small headers, and status pills.

### Named Rules
**The Structural Scale Rule.** Avoid arbitrary font sizes. All text must map to the defined headline, body, or label steps to maintain rhythm and predictability.

## 4. Elevation

Ambient depth: Soft, diffuse shadows create a structured environment.

### Shadow Vocabulary
- **Shadow Small** (`box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05)`): Used on primary cards and containers to lift them subtly from the background.
- **Shadow Medium**: Used for dropdowns and popovers (hovering above the surface).

### Named Rules
**The Ambient Depth Rule.** Shadows are never harsh or directional. They act as ambient occlusion, gently separating interactive layers rather than simulating intense lighting.

## 5. Components

Components are structured, legible, and functional.

### Buttons
- **Shape:** Rounded Large (0.5rem)
- **Primary:** Crisp Digital Sapphire (#2563eb) with white text, padded horizontally for a confident click target.
- **Hover / Focus:** Opacity drops slightly on hover. Focus triggers a crisp 2px primary outline with an offset.
- **Disabled:** Drops to 60% opacity with a not-allowed cursor.

### Cards / Containers
- **Corner Style:** Rounded Extra Large (0.75rem)
- **Background:** Lowest surface container (#ffffff) or low surface (#f8fafc) depending on hierarchy.
- **Shadow Strategy:** Small ambient shadow to separate from the main canvas.
- **Border:** 1px solid base border (#e2e8f0) to reinforce structure.
- **Internal Padding:** Comfortable padding (typically 1.5rem / 24px) for breathing room.

### Status Pills / Tags
- **Style:** Fully rounded (9999px) background.
- **Colors:** Uses container colors mapped to status (e.g. `primary-container` for live, `success-container` for ended) with matching high-contrast text.
- **Padding:** 0.375rem vertical, 1.5rem horizontal.

## 6. Do's and Don'ts

### Do:
- **Do** use Inter for all typography to maintain a serious, professional tone.
- **Do** ensure all interactive elements have a clear `:focus-visible` state (2px solid primary outline with 2px offset).
- **Do** honor reduced motion preferences by stripping animations and transitions when requested.

### Don't:
- **Don't** make the interface look like a boring academic portal.
- **Don't** use warm, cream, or beige backgrounds. Stick to the cool `#f8fafc` off-white to maintain modern efficiency.
- **Don't** use playful typography or decorative gradient text.
