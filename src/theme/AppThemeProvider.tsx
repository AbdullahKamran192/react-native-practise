import AsyncStorage from "@react-native-async-storage/async-storage";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance, Platform, StyleSheet, useColorScheme } from "react-native";
import { darkColor, darkPalette, type ColorRole } from "./palette";

export type ThemePreference = "light" | "dark" | "system";
const STORAGE_KEY = "foodworth:appearance";
void SplashScreen.preventAutoHideAsync().catch(() => {});
const lightColor = (value: string, _role?: ColorRole) => value;
const ThemeContext = createContext({
  preference: "system" as ThemePreference, isDark: false, color: lightColor,
  setPreference: (_value: ThemePreference) => {}, saveError: "",
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setValue] = useState<ThemePreference>("system");
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(STORAGE_KEY).then(value => {
      if (mounted && (value === "light" || value === "dark" || value === "system")) setValue(value);
    }).catch(() => {}).finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);
  const isDark = preference === "dark" || (preference === "system" && system === "dark");
  useEffect(() => {
    if (!ready) return;
    // Native alerts, pickers and native tabs follow the same preference.
    if (Platform.OS !== "web") Appearance.setColorScheme(preference === "system" ? "unspecified" : preference);
  }, [preference, ready]);
  useEffect(() => {
    if (!ready) return;
    void SystemUI.setBackgroundColorAsync(isDark ? darkPalette.background : "#F3FAFB").catch(() => {});
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    }
    void SplashScreen.hideAsync().catch(() => {});
  }, [isDark, ready]);
  const value = useMemo(() => ({ preference, isDark, saveError, color: isDark ? darkColor : lightColor,
    setPreference(next: ThemePreference) {
      setValue(next); setSaveError("");
      void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => setSaveError("Appearance changed, but could not be saved on this device."));
    },
  }), [preference, isDark, saveError]);
  const navigation = useMemo(() => isDark ? { ...DarkTheme, colors: { ...DarkTheme.colors,
    background: darkPalette.background, card: darkPalette.surface, text: darkPalette.text,
    border: darkPalette.border, primary: darkPalette.teal,
  } } : DefaultTheme, [isDark]);
  if (!ready) return null;
  return <ThemeContext.Provider value={value}><ThemeProvider value={navigation}>
    <StatusBar style={isDark ? "light" : "dark"} />{children}
  </ThemeProvider></ThemeContext.Provider>;
}

export const useAppTheme = () => useContext(ThemeContext);

/** Resolve colour properties only; layout, sizing and light styles remain identical. */
export function useThemeStyles<T extends StyleSheet.NamedStyles<T>>(styles: T): T {
  const { isDark } = useAppTheme();
  return useMemo(() => {
    if (!isDark) return styles;
    return Object.fromEntries(Object.entries(styles).map(([name, style]) => [name,
      Object.fromEntries(Object.entries(style as object).map(([key, value]) => [key,
        typeof value === "string" && /color$/i.test(key)
          ? darkColor(value, key === "backgroundColor" ? "surface" : key.startsWith("border") ? "border" : key === "shadowColor" ? "shadow" : "text")
          : value,
      ])),
    ])) as T;
  }, [styles, isDark]);
}
