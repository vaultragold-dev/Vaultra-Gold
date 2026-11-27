import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, Coins, Shield, Star, Truck } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassBackdrop } from "@/src/components/GlassBackdrop";
import { LiquidGlass } from "@/src/components/Glass";
import { api } from "@/src/api";
import { IMAGES } from "@/src/assets";
import { useToast } from "@/src/components/Toast";
import { RedeemSheet } from "@/src/components/Product";
import { Button } from "@/src/components/ui";
import { grams, inr } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { cardShadow, colors, fonts, radius, themed } from "@/src/theme";

type ProductDetail = {
  id: string;
  name: string;
  category: string;
  grams: number;
  making_charges: number;
  image: string;
  tag: string;
  gold_value: number;
  total_price: number;
  live_rate: number;
  description: string;
  features: string[];
};

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { price, token } = useApp();
  const { width } = useWindowDimensions();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    api<ProductDetail>(`/products/${id}`, { auth: "none" })
      .then((p) => { setProduct(p); setLoading(false); })
      .catch(() => { setLoading(false); toast("error", "Product not found"); });
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <GlassBackdrop />
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <GlassBackdrop />
        <View style={styles.center}>
          <Text style={styles.errorText}>Product not found</Text>
          <Button title="Go Back" variant="outline" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const imgW = Math.min(width, 600);
  const purity = ((product as any).purity as "24K" | "22K" | "18K") || "22K";
  const karatRate = price ? (purity === "24K" ? price.buy : (price as any).karats?.[purity] ?? 0) : 0;
  const goldValue = karatRate ? product.grams * karatRate : product.gold_value;
  const pct = (product as any).making_pct as number | undefined;
  const making = pct != null ? goldValue * pct / 100 : product.making_charges;
  const totalPrice = goldValue + making;

  const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";
  const uploaded = (product as any).image_url as string | undefined;
  const imgSrc = (img: string) => (uploaded ? { uri: uploaded.startsWith("/") ? BASE_URL + uploaded : uploaded } : IMAGES[img]);

  return (
    <View style={styles.root} testID="product-detail-screen">
      <GlassBackdrop />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="product-back-button">
          <ArrowLeft size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{product.name}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        {/* Full-bleed 4-side-curved Liquid Glass Image Showcase (no white padding/border) */}
        <View style={styles.heroWrap}>
          <LiquidGlass radius={26} intensity={68} showArc={false} innerStyle={{ padding: 6 }}>
            <View style={[styles.imageContainer, { height: Math.min(imgW - 44, 380) }]}>
              <Image
                source={imgSrc(product.image)}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={300}
              />
              <LinearGradient
                pointerEvents="none"
                colors={["transparent", "rgba(0,0,0,0.45)"]}
                start={{ x: 0.5, y: 0.55 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.heroVignette}
              />
              {product.tag ? (
                <View style={styles.tagBadge}>
                  <Text style={styles.tagText}>{product.tag}</Text>
                </View>
              ) : null}
              <View style={styles.heroWeight}>
                <Text style={styles.heroWeightText}>{grams(product.grams, 1)} · {purity}</Text>
              </View>
            </View>
          </LiquidGlass>
        </View>

        {/* Product Info */}
        <View style={styles.info}>
          <Text style={styles.productName}>{product.name}</Text>
          <View style={styles.categoryRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{product.category.toUpperCase()}</Text>
            </View>
            <View style={styles.purityBadge}>
              <Text style={styles.purityText}>{purity} · {{ "24K": "99.9", "22K": "91.67", "18K": "75" }[purity]}% Pure</Text>
            </View>
          </View>

          <Text style={styles.description}>{product.description}</Text>

          {/* Liquid Glass Pricing Card */}
          <LiquidGlass radius={22} intensity={64} style={{ marginBottom: 24 }} innerStyle={styles.priceCard}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Weight</Text>
              <Text style={styles.priceValue}>{grams(product.grams, 1)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Gold Value ({purity} Live Rate)</Text>
              <Text style={styles.priceValue}>{inr(goldValue, 0)}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Making Charges{pct != null ? ` (${pct}%)` : ""}</Text>
              <Text style={styles.priceValue}>{inr(making, 0)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Total Price</Text>
              <Text style={styles.totalValue}>{inr(totalPrice, 0)}</Text>
            </View>
            <Text style={styles.rateHint}>
              Live {purity} rate: {karatRate ? inr(karatRate) : "—"}/g
            </Text>
          </LiquidGlass>

          {/* Features */}
          <Text style={styles.featuresTitle}>Product Highlights</Text>
          {product.features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Check size={14} color={colors.success} />
              </View>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}

          {/* Trust badges */}
          <View style={styles.trustRow}>
            <View style={styles.trustItem}>
              <Shield size={20} color={colors.brandSecondary} />
              <Text style={styles.trustText}>BIS{"\n"}Hallmarked</Text>
            </View>
            <View style={styles.trustItem}>
              <Star size={20} color={colors.brandSecondary} />
              <Text style={styles.trustText}>LBMA{"\n"}Certified</Text>
            </View>
            <View style={styles.trustItem}>
              <Truck size={20} color={colors.brandSecondary} />
              <Text style={styles.trustText}>Insured{"\n"}Delivery</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom CTA */}
      <View style={[styles.bottomCta, { paddingBottom: insets.bottom + 16 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaPrice}>{inr(totalPrice, 0)}</Text>
          <Text style={styles.ctaSub}>or {grams((product as any).fine_grams ?? product.grams, 2)} vault gold (24K)</Text>
        </View>
        <Button
          title="Redeem Now"
          onPress={() => {
            if (!token) {
              router.push("/login");
              return;
            }
            setTarget({ kind: "product", product });
          }}
          icon={<Coins size={18} color={colors.onBrandPrimary} />}
          style={{ flex: 1 }}
          testID="product-redeem-button"
        />
      </View>

      <RedeemSheet target={target} onClose={() => setTarget(null)} />
    </View>
  );
}

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontFamily: fonts.medium, fontSize: 16, color: colors.muted },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  headerTitle: { flex: 1, fontFamily: fonts.displayBold, fontSize: 18, color: colors.onSurface, textAlign: "center" },
  heroWrap: { paddingHorizontal: 16, paddingTop: 12, marginBottom: 16 },
  imageContainer: {
    width: "100%",
    borderRadius: 20,
    backgroundColor: colors.surfaceInverse,
    overflow: "hidden",
  },
  heroVignette: { position: "absolute", left: 0, right: 0, bottom: 0, height: "38%" },
  tagBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(15,18,28,0.62)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,243,196,0.35)",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: { fontFamily: fonts.bold, fontSize: 11, color: colors.goldSheen, letterSpacing: 0.5 },
  heroWeight: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroWeightText: { fontFamily: fonts.bold, fontSize: 11, color: "#FFFFFF", letterSpacing: 0.2 },
  info: { paddingHorizontal: 16 },
  productName: { fontFamily: fonts.displayBold, fontSize: 26, letterSpacing: -0.3, color: colors.onSurface, marginBottom: 8 },
  categoryRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  categoryBadge: {
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  categoryText: { fontFamily: fonts.bold, fontSize: 11, color: colors.onBrandTertiary, letterSpacing: 0.5 },
  purityBadge: {
    backgroundColor: colors.successTint,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  purityText: { fontFamily: fonts.bold, fontSize: 11, color: colors.success, letterSpacing: 0.3 },
  description: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.muted, marginBottom: 20 },
  priceCard: {
    padding: 16,
  },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  priceLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  priceValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  totalLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.onSurface },
  totalValue: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.brandDeep, letterSpacing: -0.2 },
  rateHint: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 8, textAlign: "center" },
  featuresTitle: { fontFamily: fonts.displayBold, fontSize: 19, color: colors.onSurface, marginBottom: 12 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.successTint,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface },
  trustRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 24,
    marginBottom: 16,
    paddingVertical: 16,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
  },
  trustItem: { alignItems: "center", gap: 6 },
  trustText: { fontFamily: fonts.medium, fontSize: 11, color: colors.onBrandTertiary, textAlign: "center" },
  bottomCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.sheetSurface,
    borderTopWidth: 1,
    borderTopColor: colors.layer1Border,
    ...cardShadow,
  },
  ctaPrice: { fontFamily: fonts.displayBold, fontSize: 24, color: colors.onSurface, letterSpacing: -0.2 },
  ctaSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
}));
