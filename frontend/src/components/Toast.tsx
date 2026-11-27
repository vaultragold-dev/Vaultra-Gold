import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { CheckCircle2, Info, XCircle } from "lucide-react-native";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts, themed } from "@/src/theme";

type Kind = "success" | "error" | "info";
type ToastItem = { id: number; kind: Kind; title: string; message?: string };

const ToastCtx = createContext<(kind: Kind, title: string, message?: string) => void>(() => {});

/**
 * Top Liquid Glass Frosted Notification Pill (47% theme-tinted frost + real BlurView):
 * Keeps crystal glass depth while cleanly blurring out header text behind it so every notification is sharp & readable.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const insets = useSafeAreaInsets();

  const show = useCallback((kind: Kind, title: string, message?: string) => {
    const id = ++idRef.current;
    setItems((s) => [...s.slice(-1), { id, kind, title, message }]);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(
        kind === "error" ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    }
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 3200);
  }, []);

  const android = Platform.OS === "android";

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
        {items.map((t) => {
          const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? XCircle : Info;
          const tint = t.kind === "success" ? colors.success : t.kind === "error" ? colors.error : "#FFFFFF";
          const badgeTint =
            t.kind === "success"
              ? "rgba(110,231,183,0.18)"
              : t.kind === "error"
                ? "rgba(253,164,175,0.18)"
                : colors.layer3ActiveFill;
          return (
            <Animated.View
              key={t.id}
              entering={FadeInUp.springify().damping(16)}
              exiting={FadeOutUp}
              style={[
                styles.toast,
                { backgroundColor: android ? colors.notifPillFallback : colors.notifPillBg },
              ]}
              testID={`toast-${t.kind}`}
            >
              {!android ? (
                <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
              ) : null}
              <View style={[styles.iconBox, { backgroundColor: badgeTint, borderColor: tint }]}>
                <Icon size={18} color={tint} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} testID="toast-title">{t.title}</Text>
                {t.message ? <Text style={styles.msg}>{t.message}</Text> : null}
              </View>
            </Animated.View>
          );
        })}
      </View>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

const styles = themed(() => ({
  wrap: { position: "absolute", left: 16, right: 16, gap: 8, alignItems: "stretch", zIndex: 9999, elevation: 30 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.notifPillBorder,
    overflow: "hidden",
    paddingVertical: 12,
    paddingHorizontal: 14,
    maxWidth: 520,
    alignSelf: "center",
    width: "100%",
    ...(Platform.OS === "web" ? ({ backdropFilter: "blur(28px) saturate(165%)" } as any) : null),
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 10 },
      default: { boxShadow: "0px 14px 30px -8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.36)" } as any,
    }),
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 13.5 },
  msg: { color: "rgba(255,255,255,0.88)", fontFamily: fonts.regular, fontSize: 12, marginTop: 2, lineHeight: 16 },
}));
