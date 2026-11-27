// Design tokens for Vaultra DigiGold — 3-Layer Transparent iOS Spatial Glass (3% / 6% / 4% / 13%)
// + Left Liquid Glass Menu (8% drawer / 32% grouped cards) + Top Notification Frosted Pill (47%)
// Auto-adapts (both at build time AND live at runtime) to every white-label jeweller's chosen colours.
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";

import { tenantConfig, type TenantTheme } from "./tenantConfig";

export type ColorScheme = "light" | "dark";

const BASE_LIGHT = {
  // Translucent Layer 2 glass surface + crisp pure-white text/icons over dark-satin theme-tinted iOS backdrop
  surface: "rgba(255,255,255,0.09)",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#2A2520",
  onSurfaceSecondary: "#FFFFFF",
  surfaceTertiary: "rgba(255,255,255,0.08)",
  onSurfaceTertiary: "rgba(255,255,255,0.82)",
  surfaceInverse: "rgba(255,255,255,0.15)",
  onSurfaceInverse: "#FFFFFF",
  sheetSurface: "#26221D",
  muted: "rgba(255,255,255,0.72)",
  mutedLight: "rgba(255,255,255,0.54)",
  brand: "#D4AF37",
  onBrand: "#FFFFFF",
  brandPrimary: "#D4AF37",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E8C868",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "rgba(255,255,255,0.09)",
  onBrandTertiary: "#FFFFFF",
  brandDeep: "#F3E3B3",
  success: "#6EE7B7",
  onSuccess: "#FFFFFF",
  successTint: "rgba(110,231,183,0.16)",
  warning: "#FCD34D",
  onWarning: "#FFFFFF",
  warningTint: "rgba(252,211,77,0.16)",
  error: "#FDA4AF",
  onError: "#FFFFFF",
  errorTint: "rgba(253,164,175,0.16)",
  info: "#93C5FD",
  onInfo: "#FFFFFF",
  border: "rgba(255,255,255,0.22)",
  borderStrong: "rgba(255,255,255,0.36)",
  divider: "rgba(255,255,255,0.14)",
  scrim: "rgba(0,0,0,0.46)",
  overlayLight: "rgba(255,255,255,0.12)",
  adminSurface: "#0F172A",
  adminOnSurface: "#F8FAFC",
  adminSurfaceSecondary: "#1E293B",
  adminOnSurfaceSecondary: "#F1F5F9",
  adminSurfaceTertiary: "#111827",
  adminOnSurfaceTertiary: "#CBD5E1",
  adminMuted: "#94A3B8",
  adminBorder: "#334155",
  adminGoldTint: "rgba(212,175,55,0.14)",
  adminSuccessTint: "rgba(22,163,74,0.16)",
  adminErrorTint: "rgba(220,38,38,0.16)",
  adminWarningTint: "rgba(245,158,11,0.16)",
  giftDiwali: "#7C2D12",
  giftDiwaliAccent: "#FDBA74",
  giftBirthday: "#831843",
  giftBirthdayAccent: "#F9A8D4",
  giftWedding: "#4C0519",
  giftWeddingAccent: "#FDA4AF",
  giftThanks: "#14532D",
  giftThanksAccent: "#86EFAC",
  giftCongrats: "#111827",
  giftCongratsAccent: "#D4AF37",
  inkSoft: "#FFFFFF",
  goldSheen: "#F3E3A6",
  goldHairline: "rgba(255,255,255,0.20)",
  silverTone: "#E5E7EB",

  // ── 3-Layer Ultra-Clear Transparent Glass Tokens ──
  // Layer 1 · Outer Spatial Glass Panel (3%)
  layer1FillA: "rgba(255,255,255,0.05)",
  layer1FillB: "rgba(255,255,255,0.03)",
  layer1Border: "rgba(255,255,255,0.28)",
  layer1RimStart: "rgba(255,255,255,0.34)",
  layer1RimMid: "rgba(255,255,255,0.16)",
  layer1RimEnd: "rgba(255,255,255,0.26)",

  // Layer 2 · Inner Cards (6%)
  layer2FillA: "rgba(255,255,255,0.08)",
  layer2FillB: "rgba(255,255,255,0.06)",
  layer2Border: "rgba(255,255,255,0.24)",
  layer2RimStart: "rgba(255,255,255,0.30)",
  layer2RimMid: "rgba(255,255,255,0.14)",
  layer2RimEnd: "rgba(255,255,255,0.22)",

  // Layer 2 Deep · Recessed Metric Cards (Gold / Silver / Vault / Input)
  layer2DeepFill: "rgba(0,0,0,0.18)",
  layer2DeepBorder: "rgba(255,255,255,0.18)",

  // Layer 3 · Transparent White-Icon Squircle Tiles (4%) & Active Pills (13%)
  layer3Fill: "rgba(255,255,255,0.04)",
  layer3Border: "rgba(255,255,255,0.30)",
  layer3ActiveFill: "rgba(255,255,255,0.13)",
  layer3ActiveBorder: "rgba(255,255,255,0.52)",

  // ── Left Liquid Glass Menu & Top Notification Pill (User-approved 8% / 32% / 47%) ──
  menuDrawerFillA: "rgba(255,255,255,0.16)",
  menuDrawerFillB: "rgba(255,255,255,0.08)",
  menuDrawerFallback: "rgba(32,26,22,0.82)",
  menuDrawerBorder: "rgba(255,255,255,0.36)",
  menuGroupFill: "rgba(255,255,255,0.32)",
  menuGroupBorder: "rgba(255,255,255,0.30)",
  menuGroupDivider: "rgba(255,255,255,0.18)",
  notifPillBg: "rgba(34,28,22,0.47)",
  notifPillFallback: "rgba(34,28,22,0.88)",
  notifPillBorder: "rgba(255,255,255,0.36)",

  // Legacy aliases mapped cleanly onto the 3-layer system
  glassFill: "rgba(255,255,255,0.04)",
  glassFallback: "rgba(255,255,255,0.06)",
  glassBorder: "rgba(255,255,255,0.28)",
  glassHighlight: "rgba(255,255,255,0.14)",
  glassTint: "dark",
  glassCard: "rgba(255,255,255,0.06)",
  glassCardBorder: "rgba(255,255,255,0.24)",

  liquidRimStart: "rgba(255,255,255,0.38)",
  liquidRimMid: "rgba(255,255,255,0.16)",
  liquidRimEnd: "rgba(255,255,255,0.28)",
  liquidGoldFillA: "rgba(255,255,255,0.16)",
  liquidGoldFillB: "rgba(255,255,255,0.09)",
  liquidGoldOrb: "rgba(255,255,255,0.06)",
  liquidGoldTitle: "#FFFFFF",
  liquidGoldSub: "rgba(255,255,255,0.72)",
  liquidGoldValue: "#FFFFFF",
  liquidSilverRimStart: "rgba(255,255,255,0.38)",
  liquidSilverRimMid: "rgba(255,255,255,0.16)",
  liquidSilverRimEnd: "rgba(255,255,255,0.28)",
  liquidSilverFillA: "rgba(255,255,255,0.16)",
  liquidSilverFillB: "rgba(255,255,255,0.09)",
  liquidSilverOrb: "rgba(255,255,255,0.05)",
  liquidSilverTitle: "#FFFFFF",
  liquidSilverSub: "rgba(255,255,255,0.72)",
  liquidSilverValue: "#FFFFFF",
  liquidSilverBtnA: "rgba(255,255,255,0.15)",
  liquidSilverBtnB: "rgba(255,255,255,0.09)",
  liquidCatFillA: "rgba(255,255,255,0.16)",
  liquidCatFillB: "rgba(255,255,255,0.09)",
  liquidArcTop: "rgba(255,255,255,0.22)",
  liquidArcMid: "rgba(255,255,255,0.03)",
  liquidDivider: "rgba(255,255,255,0.14)",
  liquidSilverDivider: "rgba(255,255,255,0.14)",
  liquidLensBg: "rgba(255,255,255,0.08)",
  liquidPillBg: "rgba(255,255,255,0.06)",
  luminousPillBg: "rgba(255,255,255,0.15)",
  luminousPillText: "#FFFFFF",

  // Default Royal Gold warm satin backdrop (auto-overridden per tenant theme)
  bgA: "#4B4338",
  bgB: "#38322B",
  bgC: "#27231F",
  orbA: "transparent",
  orbB: "transparent",
  orbC: "transparent",
};

export type ThemeColors = typeof BASE_LIGHT;
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

function parseHex(h: string): [number, number, number] {
  const clean = (h || "").replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full || "D4AF37", 16);
  if (Number.isNaN(n)) return [212, 175, 55];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function hslToHex(h: number, s: number, l: number): string {
  return toHex(...hslToRgb(h, s, l));
}

function mixHex(h1: string, h2: string, w2: number): string {
  const [r1, g1, b1] = parseHex(h1);
  const [r2, g2, b2] = parseHex(h2);
  return toHex(r1 * (1 - w2) + r2 * w2, g1 * (1 - w2) + g2 * w2, b1 * (1 - w2) + b2 * w2);
}

/**
 * True chromatic spread: near-black neutrals like `#111827` (spread 22) must NOT beat
 * intentional brand wine/emerald/rose hexes like `#711c30` (spread 85).
 */
function hasBrandChroma(hex?: string): boolean {
  if (!hex || !hex.startsWith("#")) return false;
  const [r, g, b] = parseHex(hex);
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const [, s, l] = rgbToHsl(r, g, b);
  return spread >= 30 && s >= 0.18 && l > 0.06 && l < 0.88;
}

/**
 * Derive rich dark-satin theme-tinted palettes from ANY jeweller's theme colours:
 *  - MVZA Jewels (brand `#711c30`) -> Wine / Dark Maroon satin (`#58202D -> #411721 -> #2A0F15`)
 *  - Shree Balaji (`#A02C2C`) -> Crimson Maroon satin (`#5E2020 -> #461717 -> #2E0F0F`)
 *  - Emerald Heritage (`#0F5132`) -> Deep Emerald satin (`#20563C -> #173F2D -> #0F291D`)
 *  - Rose Gold (`#B76E79`) -> Deep Rose satin (`#492C31 -> #362124 -> #231517`)
 *  - Royal Gold (`#D4AF37`) -> Warm Champagne-Charcoal satin (`#4D4633 -> #3A3627 -> #28251B`)
 */
function buildPalettes(tt: Partial<TenantTheme> | null | undefined): { light: ThemeColors; dark: ThemeColors } {
  const l: ThemeColors = { ...BASE_LIGHT };
  const d: ThemeColors = {
    ...BASE_LIGHT,
    surfaceSecondary: "#191716",
    sheetSurface: "#171514",
    bgA: "#262320",
    bgB: "#1A1816",
    bgC: "#100F0E",
    notifPillBg: "rgba(22,18,16,0.52)",
    menuDrawerFallback: "rgba(20,18,16,0.88)",
  };

  if (tt && (tt.primaryColor || tt.secondaryColor || tt.accentColor || tt.splashBackground || tt.adaptiveIconBackground)) {
    const pri = tt.primaryColor || "#D4AF37";
    const sec = tt.secondaryColor || "";
    const acc = tt.accentColor || "";
    const brandBg = tt.splashBackground || tt.adaptiveIconBackground || "";

    // Priority: non-gold primaryColor -> non-gold secondaryColor -> splash/icon brand colour -> chromatic accent
    const isGoldHue = (h: number) => h >= 28 && h <= 66;
    const [ph, ps] = rgbToHsl(...parseHex(pri));
    let hueHex = pri;
    if (isGoldHue(ph) || ps < 0.14) {
      for (const cand of [sec, brandBg, acc]) {
        if (!hasBrandChroma(cand)) continue;
        const [ch] = rgbToHsl(...parseHex(cand!));
        if (!isGoldHue(ch)) {
          hueHex = cand!;
          break;
        }
      }
      // Fallback for neutral slate like Midnight Luxe (`#334155`) when nothing brighter matched
      if (hueHex === pri) {
        for (const cand of [sec, brandBg, acc]) {
          if (!cand) continue;
          const [ch, cs] = rgbToHsl(...parseHex(cand));
          if (cs >= 0.18 && !isGoldHue(ch) && cand.toLowerCase() !== "#111827") {
            hueHex = cand;
            break;
          }
        }
      }
    }

    const [h, s] = rgbToHsl(...parseHex(hueHex));
    const goldLike = isGoldHue(h);
    const satLight = goldLike ? Math.min(0.20, Math.max(0.11, s * 0.32)) : Math.min(0.50, Math.max(0.18, s * 0.78));
    const satDark = goldLike ? Math.min(0.16, satLight * 0.8) : Math.min(0.42, satLight * 0.88);

    const bgA = hslToHex(h, satLight, goldLike ? 0.25 : 0.23);
    const bgB = hslToHex(h, satLight, goldLike ? 0.19 : 0.17);
    const bgC = hslToHex(h, satLight, goldLike ? 0.13 : 0.11);

    const dBgA = hslToHex(h, satDark, 0.15);
    const dBgB = hslToHex(h, satDark, 0.10);
    const dBgC = hslToHex(h, satDark, 0.065);

    const [tr, tg, tb] = hslToRgb(h, satLight * 0.9, 0.11);
    const notifPillBg = `rgba(${tr},${tg},${tb},0.47)`;
    const notifPillFallback = `rgba(${tr},${tg},${tb},0.90)`;
    const menuDrawerFallback = `rgba(${tr},${tg},${tb},0.88)`;

    const [dr, dg, db] = hslToRgb(h, satDark * 0.9, 0.08);
    const dNotifPillBg = `rgba(${dr},${dg},${db},0.52)`;
    const dNotifPillFallback = `rgba(${dr},${dg},${db},0.92)`;

    const softTintText = mixHex("#FFFFFF", pri, 0.26);
    const brand = {
      brand: pri,
      brandPrimary: pri,
      brandSecondary: softTintText,
      brandDeep: softTintText,
      onBrandTertiary: "#FFFFFF",
    };

    Object.assign(l, brand, {
      bgA,
      bgB,
      bgC,
      surfaceSecondary: bgC,
      sheetSurface: hslToHex(h, satLight * 0.85, 0.13),
      notifPillBg,
      notifPillFallback,
      menuDrawerFallback,
    });
    Object.assign(d, brand, {
      bgA: dBgA,
      bgB: dBgB,
      bgC: dBgC,
      surfaceSecondary: dBgC,
      sheetSurface: dBgB,
      notifPillBg: dNotifPillBg,
      notifPillFallback: dNotifPillFallback,
      menuDrawerFallback: dNotifPillFallback,
    });
  }

  return { light: Object.freeze(l) as ThemeColors, dark: Object.freeze(d) as ThemeColors };
}

let palettes = buildPalettes(tenantConfig.theme);

/** Live colour tokens used across the app. Updated in place whenever the scheme or tenant brand changes. */
export const colors: ThemeColors = { ...palettes.light };
let themeVersion = 0;
let brandVersion = 0;
let currentScheme: ColorScheme = "light";
let lastThemeSig = JSON.stringify(tenantConfig.theme || null);
const listeners = new Set<() => void>();

function syncLiveColors() {
  Object.assign(colors, currentScheme === "dark" ? palettes.dark : palettes.light);
  themeVersion++;
}

function applyScheme(s: ColorScheme) {
  currentScheme = s;
  syncLiveColors();
}

/** Called at runtime when `/tenant/{id}/config` loads or when the customer switches jeweller. */
export function applyBrandTheme(tt: Partial<TenantTheme> | null | undefined) {
  const sig = JSON.stringify(tt || null);
  if (sig === lastThemeSig) return;
  lastThemeSig = sig;
  palettes = buildPalettes(tt);
  brandVersion++;
  syncLiveColors();
  listeners.forEach((fn) => fn());
}

export function getScheme() {
  return currentScheme;
}

/**
 * Theme-aware StyleSheet: the factory re-runs (once) after every light/dark or brand theme switch,
 * so module-level styles always use the current colours without restarting the app.
 */
export function themed<T extends NamedStyles<T> | NamedStyles<any>>(factory: () => T & NamedStyles<any>): T {
  let cache: T | null = null;
  let ver = -1;
  const get = (): T => {
    if (!cache || ver !== themeVersion) {
      cache = StyleSheet.create(factory() as any) as unknown as T;
      ver = themeVersion;
    }
    return cache;
  };
  return new Proxy({} as T, {
    get: (_t, k) => (get() as any)[k],
    has: (_t, k) => k in get(),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_t, k) => ({ value: (get() as any)[k], enumerable: true, configurable: true }),
  });
}

type ThemeCtxValue = {
  scheme: ColorScheme;
  colors: ThemeColors;
  brandRev: number;
  toggle: () => void;
  setMode: (s: ColorScheme) => void;
  ready: boolean;
};

// Reactive theme context
const ThemeCtx = createContext<ThemeCtxValue>({
  scheme: "light",
  colors: palettes.light,
  brandRev: 0,
  toggle: () => {},
  setMode: () => {},
  ready: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setScheme] = useState<ColorScheme>("light");
  const [brandRev, setBrandRev] = useState(brandVersion);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onBrand = () => setBrandRev(brandVersion);
    listeners.add(onBrand);
    return () => { listeners.delete(onBrand); };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("theme_preference")
      .then((v) => {
        const s: ColorScheme = v === "dark" ? "dark" : "light";
        applyScheme(s);
        setScheme(s);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setMode = useCallback((next: ColorScheme) => {
    applyScheme(next);
    AsyncStorage.setItem("theme_preference", next).catch(() => {});
    setScheme(next);
  }, []);

  const toggle = useCallback(() => setMode(currentScheme === "dark" ? "light" : "dark"), [setMode]);

  const value = useMemo(
    () => ({
      scheme,
      colors: scheme === "dark" ? palettes.dark : palettes.light,
      brandRev,
      toggle,
      setMode,
      ready,
    }),
    [scheme, brandRev, toggle, setMode, ready],
  );

  return React.createElement(ThemeCtx.Provider, { value }, children);
}

export function useTheme() {
  return useContext(ThemeCtx);
}

export const fonts = {
  regular: "Inter-400",
  medium: "Inter-500",
  semibold: "Inter-600",
  bold: "Inter-700",
  black: "Inter-800",
  displayMedium: "Playfair-500",
  display: "Playfair-600",
  displayBold: "Playfair-700",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 14, lg: 20, pill: 999 };

export const cardShadow = Platform.select({
  web: { boxShadow: "0 8px 24px -10px rgba(0,0,0,0.28)" } as any,
  default: {},
});

export const defaultScheme = "light" satisfies ColorScheme;

export function makeStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
