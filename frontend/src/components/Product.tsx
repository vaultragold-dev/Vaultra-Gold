import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Coins, ShieldCheck, Store } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/src/api";
import { IMAGES } from "@/src/assets";
import { LiquidGlass } from "@/src/components/Glass";
import { useToast } from "@/src/components/Toast";
import { Button, Row, Sheet } from "@/src/components/ui";
import { grams, inr, TENANT_NAME } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius, themed } from "@/src/theme";

export type Product = { id: string; name: string; category: string; grams: number; making_charges: number; image: string; tag: string; image_url?: string; total_price?: number; making_pct?: number };

export function ProductCard({ p, width, onRedeem }: { p: Product; width: number; onRedeem: (p: Product) => void }) {
  const router = useRouter();
  const purity = (p as any).purity || "22K";
  const imgSrc = p.image_url
    ? { uri: p.image_url.startsWith("/") ? (process.env.EXPO_PUBLIC_BACKEND_URL || "") + p.image_url : p.image_url }
    : IMAGES[p.image];

  return (
    <Pressable
      style={({ pressed }) => [{ width }, pressed && styles.cardPressed]}
      testID={`product-card-${p.id}`}
      onPress={() => router.push({ pathname: "/product-detail", params: { id: p.id } })}
    >
      <LiquidGlass
        layer={2}
        radius={24}
        innerStyle={styles.cardInner}
      >
        {/* Full-bleed 4-side-curved jewellery showcase (zero white padding/border) */}
        <View style={styles.imgFrame}>
          <Image
            source={imgSrc}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={220}
          />
          <LinearGradient
            pointerEvents="none"
            colors={["transparent", "rgba(0,0,0,0.48)"]}
            start={{ x: 0.5, y: 0.45 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.imgVignette}
          />
          {p.tag ? (
            <View style={styles.tag}>
              <Text style={styles.tagText} numberOfLines={1}>{p.tag}</Text>
            </View>
          ) : null}
          <View style={styles.weightBadge}>
            <Text style={styles.weightBadgeText} numberOfLines={1}>
              {p.grams}g · {purity}
            </Text>
          </View>
        </View>

        {/* Product Info + Liquid Gradient CTA */}
        <View style={styles.body2}>
          <Text style={styles.name} numberOfLines={2}>
            {p.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            Making {p.making_pct ?? 12}% · Hallmarked
          </Text>
          <View style={styles.valueRow}>
            <Text style={styles.valueLabel}>Price</Text>
            <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
              {p.total_price ? inr(p.total_price, 0) : "—"}
            </Text>
          </View>
          <View style={styles.cta}>
            {width >= 190 ? <Coins size={13} color="#FFFFFF" strokeWidth={1.8} /> : null}
            <Text style={styles.ctaText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              View Details →
            </Text>
          </View>
        </View>
      </LiquidGlass>
    </Pressable>
  );
}

type Target = { kind: "coin"; coin: number } | { kind: "product"; product: Product };

export function RedeemSheet({ target, onClose }: { target: Target | null; onClose: () => void }) {
  const { vault, tenant, token, refresh } = useApp();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);
  const bal = vault?.user.gold_grams ?? 0;
  const kyc = vault?.user.kyc_status;
  const need = target ? (target.kind === "coin" ? target.coin : ((target.product as any).fine_grams ?? target.product.grams)) : 0;
  const making = target ? (target.kind === "coin" ? 250 * String(target.coin).length : target.product.making_charges) : 0;
  const name = target ? (target.kind === "coin" ? `${target.coin}g 24K Gold Coin` : target.product.name) : "";

  const close = () => {
    setDone(null);
    onClose();
  };

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const body = target.kind === "coin" ? { kind: "coin", coin_grams: target.coin, tenant } : { kind: "product", product_id: target.product.id, tenant };
      const r = await api("/redeem", { method: "POST", body });
      setDone(r.pickup);
      refresh();
      toast("success", "Redemption booked", `Pickup OTP ${r.pickup.otp} · ${TENANT_NAME[tenant] || ""}`);
    } catch (e: any) {
      toast("error", "Redemption failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={!!target} onClose={close} title={done ? "Pickup confirmed" : "Redeem vault gold"} testID="redeem-sheet">
      {done ? (
        <View style={{ paddingBottom: 8 }}>
          <View style={styles.otpBox}>
            <Text style={styles.otpLabel}>Show this OTP at the store counter</Text>
            <Text style={styles.otp} testID="redeem-pickup-otp">{done.otp}</Text>
            <Text style={styles.otpSub}>
              {done.item} · {TENANT_NAME[done.tenant]}
            </Text>
          </View>
          <Button title="Done" variant="dark" onPress={close} testID="redeem-done-button" />
        </View>
      ) : !token ? (
        <View style={{ paddingBottom: 8, gap: 12 }}>
          <Text style={styles.body}>Sign in to redeem your vault gold for jewellery and coins.</Text>
          <Button title="Sign In" onPress={() => { close(); router.push("/login"); }} testID="redeem-signin-button" />
        </View>
      ) : (
        <View style={{ paddingBottom: 8 }}>
          <View style={styles.itemRow}>
            <View style={styles.itemIcon}>
              <Coins size={22} color={colors.brandSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{name}</Text>
              <Text style={styles.body}>In-store pickup · {TENANT_NAME[tenant] || ""}</Text>
            </View>
          </View>
          <Row label="24K gold required" value={grams(need)} />
          <Row label="Your vault balance" value={grams(bal)} testID="redeem-balance" />
          <Row label="Making & minting charges" value={inr(making, 0)} />
          <Row label="Balance after" value={grams(Math.max(0, bal - need))} bold />
          <View style={styles.note}>
            <ShieldCheck size={16} color={colors.success} />
            <Text style={styles.noteText}>Hallmarked & insured. Collect in store with your 6-digit OTP.</Text>
          </View>
          {kyc !== "approved" ? (
            <Button title="Complete KYC to redeem" variant="dark" onPress={() => { close(); router.push("/profile"); }} testID="redeem-kyc-button" />
          ) : bal < need ? (
            <Button title={`Add ${grams(need - bal)} more gold`} variant="outline" onPress={() => { close(); router.push("/"); }} testID="redeem-buy-more-button" />
          ) : (
            <Button title="Confirm Redemption" loading={busy} onPress={confirm} icon={<Store size={18} color={colors.onBrandPrimary} />} testID="redeem-confirm-button" />
          )}
        </View>
      )}
    </Sheet>
  );
}

const styles = themed(() => ({
  cardPressed: { opacity: 0.93, transform: [{ scale: 0.975 }] },
  cardInner: { padding: 6, flex: 1 },
  imgFrame: {
    width: "100%",
    aspectRatio: 1.04,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.surfaceInverse,
  },
  imgVignette: { position: "absolute", left: 0, right: 0, bottom: 0, height: "46%" },
  tag: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(15,18,28,0.62)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,243,196,0.34)",
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.goldSheen, letterSpacing: 0.5 },
  weightBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.48)",
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  weightBadgeText: { fontFamily: fonts.bold, fontSize: 9.5, color: "#FFFFFF", letterSpacing: 0.2 },
  body2: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 6, flex: 1 },
  name: { fontFamily: fonts.displayBold, fontSize: 14.5, lineHeight: 19, height: 38, color: colors.onSurface, letterSpacing: -0.1 },
  meta: { fontFamily: fonts.medium, fontSize: 10.5, lineHeight: 15, color: colors.muted, marginTop: 3 },
  valueRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 8, marginBottom: 10, gap: 4 },
  valueLabel: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.muted },
  value: { flexShrink: 1, fontFamily: fonts.displayBold, fontSize: 16, color: colors.onSurface, textAlign: "right", letterSpacing: -0.2 },
  cta: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: colors.layer3ActiveFill,
    borderWidth: 1,
    borderColor: colors.layer3ActiveBorder,
  },
  ctaText: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 11.5, letterSpacing: -0.1, color: "#FFFFFF", textAlign: "center" },
  itemRow: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 12 },
  itemIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  itemName: { fontFamily: fonts.bold, fontSize: 16, color: colors.onSurface },
  body: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  note: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: colors.successTint, padding: 12, borderRadius: radius.md, marginVertical: 12 },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.success },
  otpBox: { backgroundColor: colors.surfaceInverse, borderRadius: radius.md, padding: 20, alignItems: "center", marginBottom: 16 },
  otpLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.mutedLight },
  otp: { fontFamily: fonts.black, fontSize: 40, letterSpacing: 8, color: colors.brandPrimary, marginVertical: 8 },
  otpSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.mutedLight },
}));
