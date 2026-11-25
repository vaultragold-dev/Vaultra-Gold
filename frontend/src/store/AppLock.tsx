/**
 * App lock: customers must unlock with their 4-digit MPIN or fingerprint / Face ID every time
 * the app is opened (and after it has been in the background for a minute).
 * A new login (OTP) asks the customer to create an MPIN first.
 */
import { usePathname, useRouter } from "expo-router";
import { Delete, Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react-native";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, StyleSheet, Text, Vibration, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassBackdrop } from "@/src/components/GlassBackdrop";
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
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", bioEnabled ? "bio" : "", "0", "del"];

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 20 }]} testID="app-lock">
      <GlassBackdrop />
      <View style={{ alignItems: "center" }}>
        <LogoMark size={56} />
        <Text style={styles.store}>{tenantName || "Digital Gold"}</Text>
        <View style={styles.iconWrap}>
          {mode === "unlock" ? <LockKeyhole size={22} color={colors.brandDeep} /> : <ShieldCheck size={22} color={colors.brandDeep} />}
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
        {mode !== "unlock" ? <Text style={styles.hint}>{t("mpin_hint")}</Text> : null}
        <View style={styles.dots}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.dot, i < value.length && styles.dotOn]} />
          ))}
        </View>
        <Text style={styles.err}>{err}</Text>
      </View>

      <View style={styles.pad}>
        {keys.map((k, i) => (
          <Pressable
            key={i}
            disabled={!k}
            onPress={() => (k === "del" ? setValue((v) => v.slice(0, -1)) : k === "bio" ? onBiometric() : press(k))}
            style={({ pressed }) => [styles.key, !k && { opacity: 0 }, pressed && k ? { backgroundColor: colors.brandTertiary } : null]}
            testID={`pin-key-${k || "blank"}`}
          >
            {k === "del" ? <Delete size={24} color={colors.onSurface} /> : k === "bio" ? <Fingerprint size={28} color={colors.brandDeep} /> : <Text style={styles.keyText}>{k}</Text>}
          </Pressable>
        ))}
      </View>

      {mode === "unlock" ? (
        <Pressable onPress={onForgot} style={{ alignSelf: "center", padding: 12 }} testID="pin-forgot">
          <Text style={styles.forgot}>{t("forgot_mpin")}</Text>
        </Pressable>
      ) : <View style={{ height: 44 }} />}
    </View>
  );
}

const styles = themed(() => ({
  root: { zIndex: 999, elevation: 999, backgroundColor: colors.bgA, justifyContent: "space-between" },
  store: { fontFamily: fonts.bold, fontSize: 15, color: colors.onSurface, marginTop: 10 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginTop: 22, borderWidth: 1, borderColor: colors.goldHairline },
  title: { fontFamily: fonts.black, fontSize: 22, color: colors.onSurface, marginTop: 12, letterSpacing: -0.4 },
  sub: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, marginTop: 4 },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 6, textAlign: "center", paddingHorizontal: 40 },
  dots: { flexDirection: "row", gap: 18, marginTop: 24 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.brandDeep },
  dotOn: { backgroundColor: colors.brandDeep },
  err: { fontFamily: fonts.semibold, fontSize: 13, color: colors.error, marginTop: 14, minHeight: 18, textAlign: "center" },
  pad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", paddingHorizontal: 36, rowGap: 14, columnGap: 22 },
  key: { width: 72, height: 72, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  keyText: { fontFamily: fonts.semibold, fontSize: 26, color: colors.onSurface },
  forgot: { fontFamily: fonts.semibold, fontSize: 13, color: colors.brandDeep },
}));
