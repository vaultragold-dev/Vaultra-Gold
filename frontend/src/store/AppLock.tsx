/**
 * App lock: customers must unlock with their 4-digit MPIN or fingerprint / Face ID every time
 * the app is opened (and after it has been in the background for a minute).
 * A new login (OTP) asks the customer to create an MPIN first.
 */
import { usePathname, useRouter } from "expo-router";
import { Delete, Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react-native";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, Vibration, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassBackdrop } from "@/src/components/GlassBackdrop";
import { LiquidGlass } from "@/src/components/Glass";
import { LogoMark } from "@/src/components/Header";
import { t } from "@/src/i18n";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius, themed } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const PIN_KEY = "vdg_mpin";
const BIO_KEY = "vdg_mpin_bio";
const PIN_AT_KEY = "vdg_mpin_set_at";
const LOCK_AFTER_MS = 60_000;
const MAX_ATTEMPTS = 5;

// expo-local-authentication is native-only; load lazily so web / older builds never crash.
let LocalAuth: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  LocalAuth = Platform.OS === "web" ? null : require("expo-local-authentication");
} catch {
  LocalAuth = null;
}

async function biometricAvailable() {
  try {
    if (!LocalAuth) return false;
    return (await LocalAuth.hasHardwareAsync()) && (await LocalAuth.isEnrolledAsync());
  } catch {
    return false;
  }
}

async function biometricPrompt(): Promise<boolean> {
  try {
    if (!LocalAuth) return false;
    const r = await LocalAuth.authenticateAsync({ promptMessage: t("unlock_title"), cancelLabel: "Use MPIN", disableDeviceFallback: true });
    return !!r?.success;
  } catch {
    return false;
  }
}

type LockCtx = {
  hasPin: boolean;
  bioEnabled: boolean;
  bioSupported: boolean;
  setBioEnabled: (v: boolean) => Promise<void>;
  startChangePin: () => void;
};

const Ctx = createContext<LockCtx>({ hasPin: false, bioEnabled: false, bioSupported: false, setBioEnabled: async () => {}, startChangePin: () => {} });
export const useAppLock = () => useContext(Ctx);

type Mode = "none" | "unlock" | "create" | "confirm";

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { token, booting, signOut, user } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [pin, setPin] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [bioEnabled, setBio] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);
  const [mode, setMode] = useState<Mode>("none");
  const [firstPin, setFirstPin] = useState("");
  const unlockedRef = useRef(false);
  const bgAt = useRef<number | null>(null);
  const prevToken = useRef<string | null>(null);

  // Load saved MPIN once the session is known
  useEffect(() => {
    if (booting) return;
    (async () => {
      const [p, b, sup] = await Promise.all([storage.secureGet(PIN_KEY, null), storage.getItem(BIO_KEY, false), biometricAvailable()]);
      setPin(p ? String(p) : null);
      setBio(!!b && sup);
      setBioSupported(sup);
      setLoaded(true);
    })();
  }, [booting]);

  // Decide what to show whenever the login state changes
  useEffect(() => {
    if (!loaded) return;
    if (!token) {
      // Logged out: forget the MPIN so the next account sets its own
      if (prevToken.current) {
        storage.secureRemove(PIN_KEY);
        storage.removeItem(BIO_KEY);
        storage.removeItem(PIN_AT_KEY);
        setPin(null);
        setBio(false);
      }
      unlockedRef.current = false;
      setMode("none");
    } else if (!pin) {
      // Let a brand-new customer finish the sign-up form first; ask for the MPIN right after.
      setMode(pathname === "/login" ? "none" : "create");
    } else if (!unlockedRef.current) {
      setMode("unlock");
    }
    prevToken.current = token;
  }, [token, pin, loaded, pathname]);

  // Shop / support pressed "Reset MPIN": forget the saved MPIN so the customer creates a new one
  useEffect(() => {
    const resetAt = (user as any)?.mpin_reset_at as string | null | undefined;
    if (!loaded || !token || !pin || !resetAt) return;
    (async () => {
      const setAt = String((await storage.getItem(PIN_AT_KEY, "")) || "");
      if (!setAt || new Date(resetAt).getTime() > new Date(setAt).getTime()) {
        await storage.secureRemove(PIN_KEY);
        await storage.removeItem(BIO_KEY);
        setBio(false);
        unlockedRef.current = false;
        setPin(null);
        setMode("create");
      }
    })();
  }, [user, loaded, token, pin]);

  // Re-lock after the app was in the background for a while
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background" || s === "inactive") {
        if (bgAt.current === null) bgAt.current = Date.now();
      } else if (s === "active") {
        const away = bgAt.current ? Date.now() - bgAt.current : 0;
        bgAt.current = null;
        if (away > LOCK_AFTER_MS && token && pin) {
          unlockedRef.current = false;
          setMode("unlock");
        }
      }
    });
    return () => sub.remove();
  }, [token, pin]);

  const setBioEnabled = useCallback(async (v: boolean) => {
    if (v) {
      const ok = await biometricPrompt();
      if (!ok) return;
    }
    await storage.setItem(BIO_KEY, v);
    setBio(v);
  }, []);

  const startChangePin = useCallback(() => {
    setFirstPin("");
    setMode("create");
  }, []);

  const onUnlocked = () => {
    unlockedRef.current = true;
    setMode("none");
  };

  const onForgot = async () => {
    unlockedRef.current = false;
    await signOut();
    setMode("none");
    setTimeout(() => router.push("/login"), 50);
  };

  return (
    <Ctx.Provider value={{ hasPin: !!pin, bioEnabled, bioSupported, setBioEnabled, startChangePin }}>
      <View style={{ flex: 1 }}>{children}</View>
      {mode !== "none" && token ? (
        <LockScreen
          mode={mode}
          bioEnabled={bioEnabled && mode === "unlock"}
          onSubmit={async (value, fail) => {
            if (mode === "unlock") {
              if (value === pin) onUnlocked();
              else fail(t("wrong_mpin"));
            } else if (mode === "create") {
              setFirstPin(value);
              setMode("confirm");
            } else if (mode === "confirm") {
              if (value !== firstPin) {
                fail(t("mpin_mismatch"));
                setFirstPin("");
                setMode("create");
                return;
              }
              await storage.secureSet(PIN_KEY, value);
              await storage.setItem(PIN_AT_KEY, new Date().toISOString());
              setPin(value);
              onUnlocked();
              // Offer biometric right after creating the MPIN
              if (bioSupported && !bioEnabled) {
                setTimeout(() => { setBioEnabled(true); }, 400);
              }
            }
          }}
          onBiometric={async () => {
            if (await biometricPrompt()) onUnlocked();
          }}
          onForgot={onForgot}
        />
      ) : null}
    </Ctx.Provider>
  );
}

function LockScreen({ mode, bioEnabled, onSubmit, onBiometric, onForgot }: {
  mode: Mode;
  bioEnabled: boolean;
  onSubmit: (pin: string, fail: (msg: string) => void) => void;
  onBiometric: () => void;
  onForgot: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { tenantName } = useApp();
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    setValue("");
    setErr((e) => (mode === "create" ? e : ""));
  }, [mode]);

  useEffect(() => {
    if (bioEnabled) {
      const id = setTimeout(onBiometric, 350);
      return () => clearTimeout(id);
    }
  }, [bioEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = (d: string) => {
    if (value.length >= 4) return;
    const next = value + d;
    setValue(next);
    setErr("");
    if (next.length === 4) {
      setTimeout(() => {
        onSubmit(next, (msg) => {
          Vibration.vibrate(120);
          setValue("");
          if (mode === "unlock") {
            const a = attempts + 1;
            setAttempts(a);
            if (a >= MAX_ATTEMPTS) {
              onForgot();
              return;
            }
            setErr(`${msg} · ${MAX_ATTEMPTS - a} ${t("attempts_left")}`);
          } else {
            setErr(msg);
          }
        });
      }, 120);
    }
  };

  const title = mode === "unlock" ? t("unlock_title") : t("secure_vault");
  const sub = mode === "unlock" ? t("enter_mpin") : mode === "create" ? t("set_mpin") : t("confirm_mpin");
  const rows = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], [bioEnabled ? "bio" : "", "0", "del"]];

  // Keypad sized dynamically from the real screen width & remaining vertical space so it ALWAYS renders
  // a perfectly centred 3 x 4 grid on every iOS & Android phone (320px iPhone SE, budget Androids,
  // "Display size: Large/Largest", notch / Dynamic Island, 3-button nav bar, tablets, split screen).
  const { width: W, height: H } = useWindowDimensions();
  const availH = Math.max(360, H - insets.top - insets.bottom);
  const veryCompact = availH < 560;
  const compact = availH < 680;
  const padW = Math.min(W, 400); // tablets: keep the keypad phone-sized and centred
  const sideMargin = W < 360 ? 20 : 28;
  const colGap = Math.round(Math.max(10, Math.min(26, padW * 0.058)));
  const byWidth = (padW - sideMargin * 2 - colGap * 2) / 3;
  // Estimate header + footer budget so 4 keypad rows never clip off-screen
  const topPad = veryCompact ? 8 : compact ? 14 : 26;
  const botPad = veryCompact ? 8 : compact ? 12 : 18;
  const headerEst = veryCompact ? 175 : compact ? 225 : (mode === "unlock" ? 265 : 295);
  const footerEst = mode === "unlock" ? 44 : (veryCompact ? 8 : 28);
  const keypadBudgetH = Math.max(210, availH - topPad - botPad - headerEst - footerEst);
  const rawRowGap = veryCompact ? 8 : compact ? 10 : 14;
  const byHeight = (keypadBudgetH - rawRowGap * 3) / 4;
  const keySize = Math.round(Math.max(46, Math.min(76, byWidth, byHeight)));
  const rowGap = Math.round(Math.max(8, Math.min(16, keySize * 0.2)));
  const keypadWidth = keySize * 3 + colGap * 2;

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} testID="app-lock">
      <GlassBackdrop />
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "space-between",
          paddingTop: insets.top + topPad,
          paddingBottom: insets.bottom + botPad,
        }}
      >
        <View style={{ alignItems: "center", paddingHorizontal: 20 }}>
          <LogoMark size={veryCompact ? 38 : compact ? 46 : 56} />
          <Text style={[styles.store, veryCompact && { fontSize: 13, marginTop: 6 }]} numberOfLines={1} maxFontSizeMultiplier={1.15}>{tenantName || "Digital Gold"}</Text>
          {!veryCompact ? (
            <View style={[styles.iconWrap, compact && { width: 38, height: 38, borderRadius: 13, marginTop: 12 }]}>
              {mode === "unlock" ? <LockKeyhole size={compact ? 18 : 20} color="#FFFFFF" strokeWidth={1.8} /> : <ShieldCheck size={compact ? 18 : 20} color="#FFFFFF" strokeWidth={1.8} />}
            </View>
          ) : null}
          <Text style={[styles.title, veryCompact && { fontSize: 19, marginTop: 8 }]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.15}>{title}</Text>
          <Text style={[styles.sub, veryCompact && { fontSize: 13 }]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.15}>{sub}</Text>
          {mode !== "unlock" && !compact ? <Text style={styles.hint} numberOfLines={2} maxFontSizeMultiplier={1.15}>{t("mpin_hint")}</Text> : null}
          <View style={[styles.dots, veryCompact ? { marginTop: 12, gap: 14 } : compact ? { marginTop: 16 } : null]}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.dot, veryCompact && { width: 14, height: 14, borderRadius: 7 }, i < value.length && styles.dotOn]} />
            ))}
          </View>
          <Text style={[styles.err, veryCompact && { marginTop: 8, minHeight: 16 }]} maxFontSizeMultiplier={1.15}>{err}</Text>
        </View>

        <View style={{ alignSelf: "center", width: keypadWidth, direction: "ltr" }}>
          {rows.map((row, r) => (
            <View key={r} style={{ flexDirection: "row", justifyContent: "space-between", direction: "ltr", marginTop: r ? rowGap : 0 }}>
              {row.map((k) => (
                <Pressable
                  key={k || `blank-${r}`}
                  disabled={!k}
                  onPress={() => (k === "del" ? setValue((v) => v.slice(0, -1)) : k === "bio" ? onBiometric() : press(k))}
                  style={({ pressed }) => [
                    { width: keySize, height: keySize, borderRadius: keySize / 2 },
                    !k && { opacity: 0 },
                    pressed && k ? { transform: [{ scale: 0.94 }], opacity: 0.88 } : null,
                  ]}
                  hitSlop={4}
                  testID={`pin-key-${k || "blank"}`}
                >
                  {k ? (
                    <LiquidGlass layer={3} radius={keySize / 2} style={{ width: keySize, height: keySize }} innerStyle={styles.keyInner}>
                      {k === "del" ? (
                        <Delete size={Math.round(keySize * 0.33)} color="#FFFFFF" strokeWidth={1.8} />
                      ) : k === "bio" ? (
                        <Fingerprint size={Math.round(keySize * 0.38)} color="#FFFFFF" strokeWidth={1.8} />
                      ) : (
                        <Text style={[styles.keyText, { fontSize: Math.round(keySize * 0.38) }]} allowFontScaling={false}>{k}</Text>
                      )}
                    </LiquidGlass>
                  ) : null}
                </Pressable>
              ))}
            </View>
          ))}
        </View>

        {mode === "unlock" ? (
          <Pressable onPress={onForgot} style={{ alignSelf: "center", paddingVertical: veryCompact ? 8 : 12, paddingHorizontal: 16 }} testID="pin-forgot">
            <Text style={styles.forgot} maxFontSizeMultiplier={1.15}>{t("forgot_mpin")}</Text>
          </Pressable>
        ) : <View style={{ height: veryCompact ? 6 : compact ? 12 : 28 }} />}
      </ScrollView>
    </View>
  );
}

const styles = themed(() => ({
  root: { zIndex: 999, elevation: 999, backgroundColor: colors.bgA, justifyContent: "space-between" },
  store: { fontFamily: fonts.semibold, fontSize: 11.5, letterSpacing: 1.8, textTransform: "uppercase", color: colors.muted, marginTop: 10 },
  iconWrap: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.layer3ActiveFill, alignItems: "center", justifyContent: "center", marginTop: 16, borderWidth: 1, borderColor: colors.layer3ActiveBorder },
  title: { fontFamily: fonts.displayBold, fontSize: 25, color: "#FFFFFF", marginTop: 12, letterSpacing: -0.2 },
  sub: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, marginTop: 4 },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 6, textAlign: "center", paddingHorizontal: 40 },
  dots: { flexDirection: "row", gap: 18, marginTop: 22 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.55)" },
  dotOn: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  err: { fontFamily: fonts.semibold, fontSize: 13, color: colors.error, marginTop: 12, minHeight: 18, textAlign: "center" },
  keyInner: { alignItems: "center", justifyContent: "center" },
  keyText: { fontFamily: fonts.displayBold, fontSize: 26, color: "#FFFFFF" },
  forgot: { fontFamily: fonts.semibold, fontSize: 13, color: "rgba(255,255,255,0.84)" },
}));
