import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  BadgeCheck, Bell, ChevronDown, ChevronRight, ChevronUp, Gem, HelpCircle, Languages, LockKeyhole, LogIn, MapPin, Moon, Phone, Power, RefreshCw, Sun, Users, Vault, X,
} from "lucide-react-native";
import React from "react";
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, SlideInLeft } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogoMark } from "@/src/components/Header";
import { maskPhone, TENANT_NAME } from "@/src/format";
import { LANGUAGES, t, useLang } from "@/src/i18n";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, useTheme, themed } from "@/src/theme";

type Item = { key: string; label: string; icon: any; to?: string; auth?: boolean; hint?: string };

/**
 * Left Liquid Glass Header Drawer (User-approved 8% frosted glass drawer + 32% grouped cards):
 * Matches iOS 26 / visionOS grouped glass menu design (`SharePlay` pill + grouped `Copy / Print / Duplicate` blocks
 * with crisp horizontal hairline dividers and right-aligned white outline icons).
 */
export function SideMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token, user, vault, tenant, tenantName, tenantPhone, tenantLocked, setTenant, signOut } = useApp();
  const { scheme, toggle: toggleTheme } = useTheme();
  const [pickOpen, setPickOpen] = React.useState(false);
  const [langOpen, setLangOpen] = React.useState(false);
  const { lang, setLang } = useLang();
  const stores = Object.entries(TENANT_NAME).filter(([id]) => id !== "all");
  const kyc = vault?.user.kyc_status;
  const name = user?.name || [user?.first_name].filter(Boolean).join(" ") || "Customer";
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const android = Platform.OS === "android";

  const coreItems: Item[] = [
    { key: "vault", label: t("my_vault"), icon: Vault, to: "/vault" },
    { key: "jewellery", label: t("catalogue"), icon: Gem, to: "/jewellery" },
    { key: "sip", label: t("auto_sip"), icon: RefreshCw, to: "/sip" },
  ];

  const accountItems: Item[] = [
    { key: "refer", label: t("refer_earn"), icon: Users, to: "/referral" },
    { key: "store", label: t("store_locator"), icon: MapPin, to: "/store-locator" },
    { key: "notifs", label: t("notifications"), icon: Bell, to: "/notifications", auth: true },
    { key: "kyc", label: t("kyc_status"), icon: BadgeCheck, to: "/profile", auth: true, hint: kyc === "approved" ? t("verified") : kyc === "pending" ? t("in_review") : t("pending") },
    { key: "security", label: t("app_lock"), icon: LockKeyhole, to: "/security", auth: true },
  ];

  const go = (to: string) => {
    onClose();
    setTimeout(() => router.push(to as any), 10);
  };

  const renderGroupRow = (it: Item, idx: number) => {
    const Icon = it.icon;
    return (
      <Pressable
        key={it.key}
        onPress={() => go(it.to!)}
        style={({ pressed }) => [styles.groupRow, idx > 0 && styles.rowDiv, pressed && styles.rowPressed]}
        testID={`side-menu-${it.key}`}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={styles.rowLabel} numberOfLines={1}>{it.label}</Text>
          {it.hint ? (
            <Text style={[styles.hint, it.hint === t("verified") && { color: colors.success }]}>· {it.hint}</Text>
          ) : null}
        </View>
        <Icon size={18} color="#FFFFFF" strokeWidth={1.7} />
      </Pressable>
    );
  };

  const visibleAccount = accountItems.filter((i) => !i.auth || token);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={onClose} testID="side-menu-backdrop" />
        </Animated.View>

        <Animated.View
          entering={SlideInLeft.duration(260)}
          style={[styles.panel, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}
          testID="side-menu"
        >
          {/* 8% Liquid Glass Drawer Surface (BlurView + subtle frosted sheen, zero opaque slab) */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.drawerGlassWrap]}>
            {android ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.menuDrawerFallback }]} />
            ) : (
              <>
                <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFill} />
                <LinearGradient
                  colors={[colors.menuDrawerFillA, colors.menuDrawerFillB]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </>
            )}
          </View>

          {/* Header Brand + Close Pill */}
          <View style={styles.brandHeader}>
            <LogoMark size={38} />
            <View style={{ flex: 1 }}>
              <Text style={styles.brandName} numberOfLines={1}>{tenantName || "Digital Gold"}</Text>
              <Text style={styles.brandSub}>Official Store App</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8} testID="side-menu-close">
              <X size={18} color="#FFFFFF" strokeWidth={1.9} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 14, paddingBottom: 12, gap: 10 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            testID="side-menu-scroll"
          >
            {/* Standalone Pill Card 1: Profile / Welcome */}
            <Pressable style={({ pressed }) => [styles.groupCard, styles.profileRow, pressed && styles.rowPressed]} onPress={() => go(token ? "/profile" : "/login")} testID="side-menu-profile">
              <View style={styles.avatar}>
                {token ? <Text style={styles.avatarText}>{initials}</Text> : <LogIn size={18} color="#FFFFFF" strokeWidth={1.8} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName} numberOfLines={1}>{token ? name : "Welcome"}</Text>
                <Text style={styles.profilePhone} numberOfLines={1}>{token ? maskPhone(user?.phone) : "Sign in to view your vault"}</Text>
                {token && user?.wallet_id ? (
                  <Text style={styles.walletId}>ID: {user.wallet_id}</Text>
                ) : null}
              </View>
              <ChevronRight size={18} color="#FFFFFF" strokeWidth={1.8} />
            </Pressable>

            {/* Standalone Pill Card 2: Store Switcher (like SharePlay pill in reference photo) */}
            {!tenantLocked && stores.length > 1 ? (
              <View style={styles.groupCard}>
                <Pressable style={({ pressed }) => [styles.groupRow, pressed && styles.rowPressed]} onPress={() => setPickOpen((v) => !v)} testID="side-menu-store-picker">
                  <View style={{ flex: 1 }}>
                    <Text style={styles.storeLabel}>YOUR JEWELLER</Text>
                    <Text style={styles.storeName} numberOfLines={1}>{tenantName || "Choose jeweller"}</Text>
                  </View>
                  {pickOpen ? <ChevronUp size={18} color="#FFFFFF" strokeWidth={1.8} /> : <ChevronDown size={18} color="#FFFFFF" strokeWidth={1.8} />}
                </Pressable>
                {pickOpen
                  ? stores.map(([id, storeTitle]) => (
                      <Pressable
                        key={id}
                        style={[styles.groupRow, styles.rowDiv, id === tenant && { backgroundColor: "rgba(255,255,255,0.12)" }]}
                        onPress={() => {
                          if (id !== tenant) {
                            if (token) signOut(); // accounts belong to one jeweller
                            setTenant(id);
                          }
                          setPickOpen(false);
                          onClose();
                        }}
                        testID={`store-option-${id}`}
                      >
                        <Text style={[styles.rowLabel, id === tenant && { fontFamily: fonts.bold }]}>{storeTitle}</Text>
                        {id === tenant ? <BadgeCheck size={17} color={colors.success} /> : null}
                      </Pressable>
                    ))
                  : null}
              </View>
            ) : null}

            {/* Grouped Card 1: Vault / Catalogue / SIP */}
            <View style={styles.groupCard}>
              {coreItems.map(renderGroupRow)}
            </View>

            {/* Grouped Card 2: Refer / Store / Notifs / KYC / App Lock */}
            <View style={styles.groupCard}>
              {visibleAccount.map(renderGroupRow)}
            </View>

            {/* Grouped Card 3: Theme / Language / Help */}
            <View style={styles.groupCard}>
              <Pressable onPress={() => { onClose(); setTimeout(toggleTheme, 250); }} style={({ pressed }) => [styles.groupRow, pressed && styles.rowPressed]} testID="side-menu-theme-toggle">
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.rowLabel}>{t("dark_mode")}</Text>
                  <Text style={[styles.hint, { color: scheme === "dark" ? colors.success : colors.muted }]}>· {scheme === "dark" ? t("on") : t("off")}</Text>
                </View>
                {scheme === "dark" ? <Sun size={18} color="#FFFFFF" strokeWidth={1.7} /> : <Moon size={18} color="#FFFFFF" strokeWidth={1.7} />}
              </Pressable>

              <Pressable onPress={() => setLangOpen((v) => !v)} style={({ pressed }) => [styles.groupRow, styles.rowDiv, pressed && styles.rowPressed]} testID="side-menu-language">
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.rowLabel}>{t("language")}</Text>
                  <Text style={[styles.hint, { color: "rgba(255,255,255,0.78)" }]}>· {LANGUAGES.find((l) => l.code === lang)?.native}</Text>
                </View>
                <Languages size={18} color="#FFFFFF" strokeWidth={1.7} />
              </Pressable>
              {langOpen
                ? LANGUAGES.map((l) => (
                    <Pressable
                      key={l.code}
                      style={[styles.groupRow, styles.rowDiv, l.code === lang && { backgroundColor: "rgba(255,255,255,0.12)" }]}
                      onPress={() => { setLangOpen(false); onClose(); setTimeout(() => setLang(l.code), 250); }}
                      testID={`lang-option-${l.code}`}
                    >
                      <Text style={[styles.rowLabel, l.code === lang && { fontFamily: fonts.bold }]}>{l.native}</Text>
                      <Text style={styles.footMuted}>{l.label}</Text>
                    </Pressable>
                  ))
                : null}

              <Pressable onPress={() => go("/faq")} style={({ pressed }) => [styles.groupRow, styles.rowDiv, pressed && styles.rowPressed]} testID="side-menu-faq">
                <Text style={styles.rowLabel}>{t("help")}</Text>
                <HelpCircle size={18} color="#FFFFFF" strokeWidth={1.7} />
              </Pressable>
            </View>

            {/* Standalone Logout Pill */}
            {token ? (
              <Pressable onPress={() => { onClose(); signOut(); }} style={({ pressed }) => [styles.groupCard, styles.groupRow, pressed && styles.rowPressed]} testID="side-menu-logout">
                <Text style={[styles.rowLabel, { color: colors.error, fontFamily: fonts.semibold }]}>{t("logout")}</Text>
                <Power size={18} color={colors.error} strokeWidth={1.9} />
              </Pressable>
            ) : null}

            {/* Footer */}
            <View style={styles.footer}>
              {tenantPhone ? (
                <Pressable onPress={() => Linking.openURL(`tel:${tenantPhone}`)} style={{ alignItems: "center" }} testID="side-menu-contact">
                  <Text style={styles.footMuted}>For any query contact on</Text>
                  <View style={styles.phoneRow}>
                    <Phone size={13} color="#FFFFFF" />
                    <Text style={styles.footPhone}>{maskPhone(tenantPhone)}</Text>
                  </View>
                </Pressable>
              ) : null}
              <Text style={styles.powered}>
                Powered by <Text style={styles.poweredBrand}>{tenantName || "Digital Gold"}</Text>
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = themed(() => ({
  root: { flex: 1, flexDirection: "row" },
  panel: {
    width: "82%",
    maxWidth: 340,
    backgroundColor: "transparent",
    borderTopRightRadius: 30,
    borderBottomRightRadius: 30,
    overflow: "hidden",
    borderRightWidth: 1,
    borderColor: colors.menuDrawerBorder,
    zIndex: 0,
  },
  drawerGlassWrap: {
    zIndex: -1,
    ...(Platform.OS === "web" ? ({ backdropFilter: "blur(28px) saturate(160%)" } as any) : null),
  },
  brandHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  brandName: { fontFamily: fonts.displayBold, fontSize: 18, color: "#FFFFFF" },
  brandSub: { fontFamily: fonts.semibold, fontSize: 9.5, letterSpacing: 1.2, textTransform: "uppercase", color: colors.muted },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.menuGroupFill,
    borderWidth: 1,
    borderColor: colors.menuGroupBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  groupCard: {
    borderRadius: 18,
    backgroundColor: colors.menuGroupFill,
    borderWidth: 1,
    borderColor: colors.menuGroupBorder,
    overflow: "hidden",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.42)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.displayBold, fontSize: 17, color: "#FFFFFF", letterSpacing: 0.4 },
  profileName: { fontFamily: fonts.displayBold, fontSize: 16, color: "#FFFFFF" },
  profilePhone: { fontFamily: fonts.regular, fontSize: 12, color: "rgba(255,255,255,0.78)", marginTop: 1 },
  walletId: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.goldSheen, marginTop: 2 },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  rowDiv: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.menuGroupDivider },
  rowPressed: { backgroundColor: "rgba(255,255,255,0.14)" },
  rowLabel: { fontFamily: fonts.medium, fontSize: 14.5, color: "#FFFFFF" },
  hint: { fontFamily: fonts.semibold, fontSize: 11, color: colors.warning },
  storeLabel: { fontFamily: fonts.semibold, fontSize: 9.5, letterSpacing: 1.1, color: "rgba(255,255,255,0.68)" },
  storeName: { fontFamily: fonts.semibold, fontSize: 14, color: "#FFFFFF", marginTop: 1 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: 12, marginTop: "auto", alignItems: "center", gap: 6 },
  footMuted: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  footPhone: { fontFamily: fonts.semibold, fontSize: 14, color: "#FFFFFF", letterSpacing: 0.3 },
  powered: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  poweredBrand: { fontFamily: fonts.bold, color: "#FFFFFF" },
}));
