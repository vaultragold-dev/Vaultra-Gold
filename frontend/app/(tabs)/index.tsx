import { useRouter } from "expo-router";
import { ArrowRight, CircleDot, Crown, Diamond, Disc3, Gem, HelpCircle, Link2, Users, Watch } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, type ScrollViewInstance, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassBackdrop } from "@/src/components/GlassBackdrop";
import { LiquidGlass } from "@/src/components/Glass";
import { api } from "@/src/api";
import { CATEGORIES } from "@/src/assets";
import { BannerCarousel } from "@/src/components/BannerCarousel";
import { BuyWidget } from "@/src/components/BuyWidget";
import { HomeHeader } from "@/src/components/Header";
import { HomeGoalCard } from "@/src/components/Goals";
import { KaratRates } from "@/src/components/KaratRates";
import { PriceAlertBanner, PriceAlertCard } from "@/src/components/PriceAlert";
import { PriceCards } from "@/src/components/PriceCards";
import { Product, ProductCard, RedeemSheet } from "@/src/components/Product";
import { t } from "@/src/i18n";
import { useApp } from "@/src/store/AppContext";
import { homeLayout, type HomeSection } from "@/src/tenantConfig";
import { colors, fonts, themed } from "@/src/theme";

const CAT_ICONS: Record<string, any> = { CircleDot, Disc3, Gem, Link2, Crown, Diamond, Watch };

function CatIcon({ name }: { name: string }) {
  const Icon = CAT_ICONS[name] || Gem;
  return <Icon size={24} color="#FFFFFF" strokeWidth={1.7} />;
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { refresh, token, tenant } = useApp();
  const [products, setProducts] = useState<Product[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState<any>(null);
  const bottomChrome = Math.max(insets.bottom, 12) + 72; // room for the floating glass tab bar
  const scrollRef = useRef<ScrollViewInstance>(null);
  const buyY = useRef(0);
  const scrollToBuy = () => scrollRef.current?.scrollTo({ y: Math.max(0, buyY.current - 12), animated: true });
  // Gold / Silver rate card tapped -> open the Buy box with that metal selected
  const [buySel, setBuySel] = useState<{ metal: "gold" | "silver"; n: number } | undefined>(undefined);
  const buyMetal = (metal: "gold" | "silver") => {
    setBuySel((s) => ({ metal, n: (s?.n ?? 0) + 1 }));
    scrollToBuy();
  };

  // Gold & silver rates first, then offers (banners), then trending jewellery; the rest follows the theme's order.
  const TOP: HomeSection[] = ["prices", "banners", "trending"];
  const order: HomeSection[] = [...TOP, ...homeLayout.filter((k) => !TOP.includes(k))];

  useEffect(() => {
    api<Product[]>(`/products?jeweller_id=${tenant}`, { auth: "none" }).then(setProducts).catch(() => {});
  }, [tenant]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (token) await refresh();
    setRefreshing(false);
  };

  const sections: Record<HomeSection, React.ReactNode> = {
    prices: <PriceCards onSelect={buyMetal} />,
    karats: <KaratRates />,
    sip: (
      <Pressable onPress={() => router.push("/sip")} testID="home-sip-promo" style={({ pressed }) => [styles.sipWrap, pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] }]}>
        <LiquidGlass layer={1} radius={26} innerStyle={styles.sipOuter}>
          <LiquidGlass layer={2} radius={20} innerStyle={styles.sipPromo}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sipEyebrow}>{t("sip_eyebrow")}</Text>
              <Text style={styles.sipTitle}>{t("sip_title")}</Text>
              <Text style={styles.sipSub}>{t("sip_sub")}</Text>
            </View>
            <View style={styles.sipArrow}>
              <ArrowRight size={19} color="#FFFFFF" strokeWidth={1.9} />
            </View>
          </LiquidGlass>
        </LiquidGlass>
      </Pressable>
    ),
    banners: (
      <>
        <PriceAlertBanner />
        <Animated.View entering={FadeInDown.delay(50).duration(400)} style={{ marginTop: 8 }}>
          <BannerCarousel onBuy={scrollToBuy} />
        </Animated.View>
      </>
    ),
    buy: (
      <>
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={{ marginTop: 20 }} onLayout={(e) => { buyY.current = e.nativeEvent.layout.y; }}>
          <BuyWidget select={buySel} />
        </Animated.View>
        <PriceAlertCard />
        <HomeGoalCard />
      </>
    ),
    categories: (
      <>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t("shop_by_category")}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.id}
              testID={`category-${c.id}`}
              onPress={() => router.push({ pathname: "/jewellery", params: { category: c.id } })}
              style={styles.cat}
            >
              <View style={styles.catImg}>
                <CatIcon name={c.icon} />
              </View>
              <Text style={styles.catLabel} numberOfLines={1}>
                {c.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </>
    ),
    trending: (
      <LiquidGlass layer={1} radius={26} style={styles.trendingWrap} innerStyle={styles.trendingInner}>
        <View style={styles.trendingHead}>
          <Text style={styles.sectionTitle}>{t("trending_jewellery")}</Text>
          <Pressable onPress={() => router.push("/jewellery")} style={styles.seeAll} testID="see-all-jewellery">
            <Text style={styles.seeAllText}>{t("see_all")}</Text>
            <ArrowRight size={14} color="#FFFFFF" strokeWidth={1.8} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, gap: 10, paddingBottom: 4 }}>
          {products.slice(0, 4).map((p) => (
            <ProductCard key={p.id} p={p} width={186} onRedeem={(x) => setTarget({ kind: "product", product: x })} />
          ))}
        </ScrollView>
      </LiquidGlass>
    ),
    promos: (
      <>
        <Pressable onPress={() => router.push("/referral")} testID="home-refer-promo" style={({ pressed }) => [{ marginHorizontal: 16, marginTop: 14 }, pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] }]}>
          <LiquidGlass layer={2} radius={22} innerStyle={styles.referPromo}>
            <View style={styles.referIcon}>
              <Users size={19} color="#FFFFFF" strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.referTitle}>{t("refer_title")}</Text>
              <Text style={styles.referSub}>{t("refer_sub")}</Text>
            </View>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={1.8} />
          </LiquidGlass>
        </Pressable>
        <Pressable onPress={() => router.push("/faq")} testID="home-faq-link" style={({ pressed }) => [{ marginHorizontal: 16, marginTop: 10 }, pressed && { opacity: 0.92 }]}>
          <LiquidGlass layer={2} radius={20} innerStyle={styles.faqRow}>
            <View style={styles.faqIcon}>
              <HelpCircle size={18} color="#FFFFFF" strokeWidth={1.8} />
            </View>
            <Text style={styles.faqText}>{t("faq")}</Text>
            <ArrowRight size={16} color="rgba(255,255,255,0.72)" strokeWidth={1.8} />
          </LiquidGlass>
        </Pressable>
      </>
    ),
  };

  return (
    <View style={styles.root} testID="home-screen">
      <GlassBackdrop />
      <HomeHeader onSelectMetal={buyMetal} />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: bottomChrome + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section order comes from the white-label theme (tenantConfig.homeLayout) */}
        {order.map((k) => (
          <React.Fragment key={k}>{sections[k]}</React.Fragment>
        ))}
      </ScrollView>
      <RedeemSheet target={target} onClose={() => setTarget(null)} />
    </View>
  );
}

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: "transparent" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 22, marginBottom: 12 },
  trendingWrap: { marginHorizontal: 16, marginTop: 18 },
  trendingInner: { paddingTop: 12, paddingBottom: 10 },
  trendingHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, marginBottom: 10 },
  sectionTitle: { fontFamily: fonts.displayBold, fontSize: 20, letterSpacing: -0.2, color: "#FFFFFF" },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36 },
  seeAllText: { fontFamily: fonts.semibold, fontSize: 12.5, color: "rgba(255,255,255,0.85)" },
  cat: { alignItems: "center", width: 74 },
  catImg: { width: 62, height: 62, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.layer3Border, backgroundColor: colors.layer3Fill },
  catLabel: { fontFamily: fonts.semibold, fontSize: 11.5, color: "#FFFFFF", marginTop: 7 },
  sipWrap: { marginHorizontal: 16, marginTop: 16 },
  sipOuter: { padding: 8 },
  sipPromo: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sipEyebrow: { fontFamily: fonts.bold, fontSize: 10, color: colors.muted, letterSpacing: 1.5 },
  sipTitle: { fontFamily: fonts.displayBold, fontSize: 19, color: "#FFFFFF", letterSpacing: -0.2, marginTop: 3 },
  sipSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 4 },
  sipArrow: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.layer3ActiveFill, borderWidth: 1, borderColor: colors.layer3ActiveBorder, alignItems: "center", justifyContent: "center" },
  referPromo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  referIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.layer3Fill, borderWidth: 1, borderColor: colors.layer3Border, alignItems: "center", justifyContent: "center" },
  referTitle: { fontFamily: fonts.displayBold, fontSize: 17.5, color: "#FFFFFF" },
  referSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  faqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  faqIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.layer3Fill, borderWidth: 1, borderColor: colors.layer3Border, alignItems: "center", justifyContent: "center" },
  faqText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: "#FFFFFF" },
}));
