# FoodWorth UI artwork

## Central UI configuration

Start in `assets/brand/uiAssets.ts`. `uiIcons` contains the current library icons,
with entries such as `caloriesIcon`, `proteinIcon`, `searchIcon`, `editIcon` and
`deleteIcon`. Screens use `AppIcon`, so replacing an entry updates every use of
that icon. Outlined and filled variants have separate entries to preserve the
current appearance. `iconKeys` connects existing names to these entries; leave
that mapping as it is when replacing an image.

For example, after adding `assets/brand/icons/calories.png`, change:

```ts
caloriesIcon: { kind: "icon", name: "flame-outline" } as UIIcon,
```

to:

```ts
caloriesIcon: { kind: "image", source: require('./icons/calories.png') } as UIIcon,
```

Use square transparent PNGs, ideally 144 × 144 pixels with minimal empty space.
Screens keep their current icon sizes. Images keep their original colours; add
`tint: true` for a monochrome image that should use each screen's icon colour.
Static `require(...)` paths must point to real files. Restart Metro after adding
assets. No custom files are required until you replace an entry.

`tabIcons` in the same file contains the existing iOS (`sf`) and Android (`md`)
system icons. To use a local tab image, replace that tab's object with
`{ src: require('./icons/home.png') }`. Native tabs handle their own rendering.

Large illustrations and the meal background remain in `artwork.ts`, re-exported
from `uiAssets.ts`; their dimensions are listed below. Nutrition colours stay in
`src/components/brand/theme.ts`. Product/meal photos and the launcher icon are
separate from these UI settings.

## Decorative artwork

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
