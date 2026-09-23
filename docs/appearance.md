# Appearance

Settings offers Light, Dark and System. The preference is saved on this device under AsyncStorage key `foodworth:appearance`. It works signed out and offline, and is independent of Supabase. System is the default and follows device appearance changes.

Light mode retains the original colour values, spacing, artwork and layouts. Dark mode uses the same teal identity and nutrient/grade meanings on darker surfaces. Product and meal photographs are not recoloured.

## Implementation

- `src/theme/palette.ts`: dark semantic colours and aliases for existing light shades. Text, surfaces, borders and shadows have separate roles so white button labels stay white while white cards become dark.
- `src/theme/AppThemeProvider.tsx`: local preference, system appearance, navigation theme, status bar and native-control appearance. The provider waits for storage before displaying the app. Changing mode updates existing components without remounting screens or resetting forms.
- `useThemeStyles(existingStyles)`: memoises the dark colour version of an existing stylesheet; returns the original stylesheet unchanged in light mode.
- `useAppTheme().color(value, role)`: resolves inline colours and colours supplied by nutrition/grade data. Default role is text; use `surface` for backgrounds and `border` for borders.

No new dependencies, SQL migrations or backend changes are required. Existing branded artwork remains the same; the built-in decorative meal background uses themed colours.

## Checks

Run `node tests/theme.test.cjs` for contrast and colour-role checks. The web export was also checked. TypeScript still reports the pre-existing implicit-any parameter in `ProfileCard.tsx`.

Device review: switch all three modes, reopen the app to check persistence, and change the OS appearance while System is selected. Check native tabs, keyboards/date pickers, dialogs and status bars on both iOS and Android. Review home, pantry, meal details, shopping, authentication and settings; toggling must preserve any in-progress form values. Native-device visual checks have not been performed in this workspace.
