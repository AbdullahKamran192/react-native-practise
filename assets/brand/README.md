# FoodWorth UI artwork

The screens work without custom artwork. They currently use vector icons and a
mint/teal vector background. No missing files are referenced at runtime.

Copy your images into this folder, then replace the matching `null` in `artwork.ts`
with its commented static `require(...)`. Restart Metro after adding files.

| File | Recommended pixels | Composition / display |
| --- | --- | --- |
| `meals-hero.png` | 600 × 600 | Transparent bowl/fruit illustration, no text; displayed at 88 × 88 logical pixels. |
| `meals-background.png` | 1200 × 2600 | Pale mint/white portrait background; food decoration near edges and bottom, calm centre. Covers the viewport and may crop on different devices. |
| `pantry-basket.png` | 480 × 480 | Transparent basket illustration, no text; displayed at 64 × 64 logical pixels. |
| `consume-basket.png` | 480 × 480 | Transparent basket/gauge illustration, no text; displayed at 72 × 72 logical pixels. |

PNG with transparency is best for isolated artwork. WebP is also supported if you
adjust the filename in `artwork.ts`. Aim for under 150 KB per illustration and
under 400 KB for the background. Keep key details within the middle 80% of each
square. Do not include headings/buttons in images: the app renders accessible text.

Nutrition and action icons use the already-installed Ionicons set; no icon downloads
are required. Product and meal photos continue to use their existing data sources.
These artwork slots do not replace the app launcher icon.
