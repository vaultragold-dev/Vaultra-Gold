import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Bell, Coins, Menu, User } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass } from "@/src/components/Glass";
import { SideMenu } from "@/src/components/SideMenu";
import { grams, inr } from "@/src/format";
import { t } from "@/src/i18n";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius, themed } from "@/src/theme";

export function PulseDot({ color = colors.success, size = 8 }: { color?: string; size?: number }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withTiming(2.4, { duration: 1100, easing: Easing.out(Easing.quad) }), -1, false);
  }, [s]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: 2.4 - s.value > 0 ? (2.4 - s.value) / 1.4 : 0 }));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ring]} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

export function LiveTicker({ testID = "live-gold-ticker" }: { testID?: string }) {
  const { price, priceError } = useApp();
  const up = (price?.change_pct ?? 0) >= 0;
  const sUp = (price?.silver?.change_pct ?? 0) >= 0;
  const bad = priceError || price?.offline || price?.rates_hidden;
  const show = !!price && price.has_live !== false;

  const fmt2 = (n?: number) => (n ? `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—");
  return (
    <View style={styles.ticker} testID={testID}>
      <PulseDot color={bad ? colors.error : colors.success} />
      {bad ? (
        <Text numberOfLines={1} style={[styles.tickerLive, { color: colors.error, flex: 1 }]}>
          {priceError ? "NO NETWORK" : price?.rates_hidden ? "RATES HIDDEN" : "RATES PAUSED"}
        </Text>
      ) : (
        <>
          <View style={styles.tickSeg}>
            <Text style={styles.tickerLabel} numberOfLines={1}>Gold 24K</Text>
            <Text style={styles.tickerPrice} numberOfLines={1} testID="live-gold-price">{show ? fmt2(price?.buy) : "—"}</Text>
            <Text style={[styles.tickerArrow, { color: up ? colors.success : colors.error }]}>{up ? "▲" : "▼"}</Text>
          </View>
          <View style={styles.tickDivider} />
          <View style={styles.tickSeg}>
            <Text style={styles.tickerLabel} numberOfLines={1}>Silver</Text>
            <Text style={styles.tickerPrice} numberOfLines={1} testID="live-silver-price">{show ? fmt2(price?.silver?.buy) : "—"}</Text>
            <Text style={[styles.tickerArrow, { color: sUp ? colors.success : colors.error }]}>{sUp ? "▲" : "▼"}</Text>
          </View>
        </>
      )}
    </View>
  );
}

export function LogoMark({ size = 36 }: { size?: number }) {
  const { tenantLogo, tenantName } = useApp();
  const [imgError, setImgError] = useState(false);

  if (tenantLogo && !imgError) {
    return (
      <View
        style={[
          styles.logoMark,
          {
            width: size,
            height: size,
            borderRadius: Math.max(8, size * 0.28),
            overflow: "hidden",
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: colors.goldHairline,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.12,
            shadowRadius: 3,
            elevation: 2,
          },
        ]}
      >
        <Image
          source={{ uri: tenantLogo }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={200}
          onError={() => setImgError(true)}
        />
      </View>
    );
  }

  const initials = (tenantName || "G").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <LinearGradient
      colors={[colors.goldSheen, colors.brandPrimary, colors.brandDeep]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.logoMark, { width: size, height: size, borderRadius: Math.max(8, size * 0.28) }]}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.42, color: colors.onBrandPrimary }}>
        {initials}
      </Text>
    </LinearGradient>
  );
}

export function HomeHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, vault, user, unreadNotifs, tenantName, price } = useApp();
  const [menu, setMenu] = useState(false);
  const g = vault?.user.gold_grams ?? 0;
  const displayName = user?.first_name || user?.name?.split(" ")[0] || "Profile";

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headRow}>
        <Pressable onPress={() => setMenu(true)} hitSlop={6} testID="header-menu-button">
          <Glass radius={22} intensity={70} style={styles.menuBtn}>
            <Menu size={20} color={colors.onSurface} strokeWidth={2} />
          </Glass>
        </Pressable>
        <LogoMark size={34} />
        <View style={{ flex: 1 }}>
          {token && user ? <Text style={styles.eyebrow} numberOfLines={1}>{tenantName || "Digital Gold"}</Text> : null}
          <Text style={styles.brand} numberOfLines={2}>
            {token && user ? (
              <>{t("hi")}, <Text style={{ color: colors.brandDeep }}>{displayName}</Text></>
            ) : (
              <>{tenantName || "Digital Gold"}</>
            )}
          </Text>
        </View>
        {/* Notification Bell */}
        {token ? (
          <Pressable
            testID="header-notification-bell"
            onPress={() => router.push("/notifications")}
            style={styles.bellBtn}
            hitSlop={8}
          >
            <Bell size={20} color={colors.onSurface} />
            {unreadNotifs > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadNotifs > 9 ? "9+" : unreadNotifs}</Text>
              </View>
            )}
          </Pressable>
        ) : null}
        <Pressable
          testID="header-profile-button"
          onPress={() => router.push(token ? "/profile" : "/login")}
          style={[styles.profileBtn, token ? styles.profileOn : null]}
        >
          <User size={16} color={token ? colors.onSurfaceInverse : colors.onSurface} />
          <Text style={[styles.profileText, token ? { color: colors.onSurfaceInverse } : null]} numberOfLines={1}>
            {token ? displayName : t("sign_in")}
          </Text>
        </Pressable>
      </View>
      <View style={styles.pillsRow}>
        <LiveTicker />
      </View>
      {token ? (
        <Pressable testID="vault-balance-pill" onPress={() => router.push("/vault")} style={styles.balancePill}>
          <Coins size={14} color={colors.brandPrimary} />
          <Text style={styles.balanceLabel}>My vault</Text>
          <Text style={styles.balanceGrams}>{grams(g)}</Text>
          <Text style={styles.balanceInr} numberOfLines={1}>{price?.has_live === false ? "Rates paused" : `≈ ${inr(vault?.current_value ?? 0)}`}</Text>
        </Pressable>
      ) : null}
      <SideMenu visible={menu} onClose={() => setMenu(false)} />
    </View>
  );
}

export function ScreenHeader({ title, subtitle, right, showBack = false }: { title: string; subtitle?: string; right?: React.ReactNode; showBack?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8, paddingBottom: 12 }]}>
      <View style={styles.headRow}>
        {showBack ? (
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} testID="screen-back-button">
            <Glass radius={22} intensity={70} style={styles.backBtn}>
              <ArrowLeft size={20} color={colors.onSurface} />
            </Glass>
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>{title}</Text>
          {subtitle ? <Text style={styles.screenSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = themed(() => ({
  headRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  menuBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  logoMark: { alignItems: "center", justifyContent: "center" },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1.2, color: colors.brandDeep, textTransform: "uppercase" },
  brand: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, letterSpacing: -0.3, color: colors.onSurface },
  profileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 120,
  },
  profileOn: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  profileText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onSurface },
  bellBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, color: "#FFFFFF" },
  pillsRow: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
  ticker: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.goldHairline,
    overflow: "hidden",
  },
  tickerLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  tickerPrice: { fontFamily: fonts.bold, fontSize: 14, color: colors.onSurface, letterSpacing: -0.3, flexShrink: 1 },
  tickerArrow: { fontFamily: fonts.bold, fontSize: 9 },
  tickSeg: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, flex: 1, justifyContent: "center" },
  tickDivider: { width: 1, height: 16, backgroundColor: colors.goldHairline, marginHorizontal: 2 },
  tickerLive: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.4 },
  balancePill: {
    marginTop: 8,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceInverse,
    borderWidth: 1,
    borderColor: colors.goldHairline,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  balanceLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.goldSheen },
  balanceGrams: { fontFamily: fonts.bold, fontSize: 13, color: colors.brandPrimary, letterSpacing: -0.2 },
  balanceInr: { flex: 1, textAlign: "right", fontFamily: fonts.semibold, fontSize: 12, color: colors.goldSheen },
  screenTitle: { fontFamily: fonts.black, fontSize: 26, letterSpacing: -0.8, color: colors.onSurface },
  screenSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  // headers sit on a soft tinted backdrop so the glass controls read as frosted
  header: { backgroundColor: "transparent", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.goldHairline },
}));
