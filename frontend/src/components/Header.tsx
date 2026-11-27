import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Bell, Coins, Menu, User } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Glass, LiquidGlass } from "@/src/components/Glass";
import { SideMenu } from "@/src/components/SideMenu";
import { grams, inr } from "@/src/format";
import { t } from "@/src/i18n";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, themed } from "@/src/theme";

export function PulseDot({ color = colors.success, size = 7 }: { color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
  );
}

export function LiveTicker({ testID = "live-gold-ticker", onSelect }: { testID?: string; onSelect?: (metal: "gold" | "silver") => void }) {
  const { price, priceError } = useApp();
  const up = (price?.change_pct ?? 0) >= 0;
  const sUp = (price?.silver?.change_pct ?? 0) >= 0;
  const bad = priceError || price?.offline || price?.rates_hidden;
  const show = !!price && price.has_live !== false;

  const fmt2 = (n?: number) => (n ? `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—");
  return (
    <LiquidGlass
      testID={testID}
      layer={1}
      radius={999}
      style={styles.tickerWrap}
      innerStyle={styles.ticker}
    >
      <PulseDot color={bad ? colors.error : colors.success} />
      {bad ? (
        <Text numberOfLines={1} style={[styles.tickerLive, { color: colors.error, flex: 1 }]}>
          {priceError ? "NO NETWORK" : price?.rates_hidden ? "RATES HIDDEN" : "RATES PAUSED"}
        </Text>
      ) : (
        <>
          <Pressable style={styles.tickSeg} onPress={() => onSelect?.("gold")} disabled={!onSelect} hitSlop={4}>
            <Text style={styles.tickerLabel} numberOfLines={1}>Gold 24K</Text>
            <Text style={styles.tickerPrice} numberOfLines={1} testID="live-gold-price">{show ? fmt2(price?.buy) : "—"}</Text>
            <Text style={[styles.tickerArrow, { color: up ? colors.success : colors.error }]}>{up ? "▲" : "▼"}</Text>
          </Pressable>
          <View style={styles.tickDivider} />
          <Pressable style={styles.tickSeg} onPress={() => onSelect?.("silver")} disabled={!onSelect} hitSlop={4}>
            <Text style={styles.tickerLabel} numberOfLines={1}>Silver</Text>
            <Text style={styles.tickerPrice} numberOfLines={1} testID="live-silver-price">{show ? fmt2(price?.silver?.buy) : "—"}</Text>
            <Text style={[styles.tickerArrow, { color: sUp ? colors.success : colors.error }]}>{sUp ? "▲" : "▼"}</Text>
          </Pressable>
        </>
      )}
    </LiquidGlass>
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
            borderRadius: Math.max(10, size * 0.30),
            overflow: "hidden",
            backgroundColor: "rgba(255,255,255,0.12)",
            borderWidth: 1,
            borderColor: colors.layer3Border,
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
      colors={["rgba(255,255,255,0.24)", "rgba(255,255,255,0.10)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.logoMark,
        {
          width: size,
          height: size,
          borderRadius: Math.max(10, size * 0.30),
          borderWidth: 1,
          borderColor: colors.layer3ActiveBorder,
        },
      ]}
    >
      <Text style={{ fontFamily: fonts.displayBold, fontSize: size * 0.42, color: "#FFFFFF" }}>
        {initials}
      </Text>
    </LinearGradient>
  );
}

export function HomeHeader({ onSelectMetal }: { onSelectMetal?: (metal: "gold" | "silver") => void } = {}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, vault, user, unreadNotifs, tenantName, price } = useApp();
  const [menu, setMenu] = useState(false);
  const g = vault?.user.gold_grams ?? 0;
  const displayName = user?.first_name || user?.name?.split(" ")[0] || "Profile";

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headRow}>
        {/* Layer 3 Transparent White-Icon Squircle Menu Button */}
        <Pressable onPress={() => setMenu(true)} hitSlop={6} testID="header-menu-button">
          <Glass layer={3} radius={14} style={styles.iconSquircle}>
            <Menu size={19} color="#FFFFFF" strokeWidth={1.8} />
          </Glass>
        </Pressable>
        <LogoMark size={34} />
        <View style={{ flex: 1 }}>
          {token && user ? <Text style={styles.eyebrow} numberOfLines={1}>{tenantName || "Digital Gold"}</Text> : null}
          <Text style={styles.brand} numberOfLines={2}>
            {token && user ? (
              <>{t("hi")}, {displayName}</>
            ) : (
              <>{tenantName || "Digital Gold"}</>
            )}
          </Text>
        </View>
        {/* Layer 3 Transparent White-Icon Notification Squircle */}
        {token ? (
          <Pressable
            testID="header-notification-bell"
            onPress={() => router.push("/notifications")}
            hitSlop={6}
            style={{ position: "relative" }}
          >
            <Glass layer={3} radius={14} style={styles.iconSquircle}>
              <Bell size={18} color="#FFFFFF" strokeWidth={1.8} />
            </Glass>
            {unreadNotifs > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadNotifs > 9 ? "9+" : unreadNotifs}</Text>
              </View>
            )}
          </Pressable>
        ) : null}
        {/* Layer 3 Active Transparent White-Icon Profile Pill */}
        <Pressable
          testID="header-profile-button"
          onPress={() => router.push(token ? "/profile" : "/login")}
        >
          <Glass layer={token ? "3active" : 3} radius={14} style={styles.profileWrap} contentStyle={styles.profileContent}>
            <User size={15} color="#FFFFFF" strokeWidth={1.9} />
            <Text style={styles.profileText} numberOfLines={1}>
              {token ? displayName : t("sign_in")}
            </Text>
          </Glass>
        </Pressable>
      </View>
      <View style={styles.pillsRow}>
        <LiveTicker onSelect={onSelectMetal} />
      </View>
      {token ? (
        <Pressable testID="vault-balance-pill" onPress={() => router.push("/vault")} style={({ pressed }) => [{ marginTop: 8 }, pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }]}>
          <LiquidGlass layer={1} radius={999} style={{ height: 38 }} innerStyle={styles.balancePill}>
            <Coins size={14} color="#FFFFFF" strokeWidth={1.8} />
            <Text style={styles.balanceLabel}>My vault</Text>
            <Text style={styles.balanceGrams}>{grams(g)}</Text>
            <Text style={styles.balanceInr} numberOfLines={1}>{price?.has_live === false ? "Rates paused" : `≈ ${inr(vault?.current_value ?? 0)}`}</Text>
          </LiquidGlass>
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
            <Glass layer={3} radius={14} style={styles.iconSquircle}>
              <ArrowLeft size={19} color="#FFFFFF" strokeWidth={1.8} />
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
  iconSquircle: { width: 42, height: 42 },
  logoMark: { alignItems: "center", justifyContent: "center" },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 9.5, letterSpacing: 1.8, color: colors.muted, textTransform: "uppercase" },
  brand: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 22, letterSpacing: -0.2, color: "#FFFFFF" },
  profileWrap: { height: 42, maxWidth: 124 },
  profileContent: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 },
  profileText: { fontFamily: fonts.semibold, fontSize: 12.5, color: "#FFFFFF" },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E11D48",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, color: "#FFFFFF" },
  pillsRow: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
  tickerWrap: { flex: 1, height: 40 },
  ticker: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 12,
  },
  tickerLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  tickerPrice: { fontFamily: fonts.bold, fontSize: 13.5, color: "#FFFFFF", letterSpacing: -0.2, flexShrink: 1, fontVariant: ["tabular-nums"] },
  tickerArrow: { fontFamily: fonts.bold, fontSize: 9 },
  tickSeg: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, flex: 1, justifyContent: "center" },
  tickDivider: { width: 1, height: 16, backgroundColor: colors.divider, marginHorizontal: 2 },
  tickerLive: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.4 },
  balancePill: {
    flex: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  balanceLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.muted, letterSpacing: 0.3 },
  balanceGrams: { fontFamily: fonts.displayBold, fontSize: 14.5, color: "#FFFFFF" },
  balanceInr: { flex: 1, textAlign: "right", fontFamily: fonts.semibold, fontSize: 12.5, color: "#FFFFFF" },
  screenTitle: { fontFamily: fonts.displayBold, fontSize: 27, letterSpacing: -0.3, color: "#FFFFFF" },
  screenSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  header: { backgroundColor: "transparent", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
}));
