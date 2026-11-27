import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { api } from "@/src/api";
import { BANNERS as DEFAULT_BANNERS, IMAGES } from "@/src/assets";
import { useApp } from "@/src/store/AppContext";
import { tenantConfig } from "@/src/tenantConfig";
import { colors, fonts, radius, themed } from "@/src/theme";

type Banner = { id: string; image?: string; image_url?: string; eyebrow?: string; title?: string; subtitle?: string; link?: string };
const LINK_ROUTES: Record<string, string> = { buy: "/", sip: "/sip", jewellery: "/jewellery", catalogue: "/jewellery", refer: "/referral", referral: "/referral", vault: "/vault", store: "/store-locator" };

function toAbsUrl(u?: string): string {
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const base = (
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    tenantConfig?.apiBaseUrl ||
    "https://master.vaultragold.com"
  ).trim().replace(/\/+$/, "").replace(/\/api$/, "");
  return `${base}${u.startsWith("/") ? "" : "/"}${u}`;
}

export function BannerCarousel({ onBuy }: { onBuy?: () => void } = {}) {
  const { width: winW } = useWindowDimensions();
  const screenW = Math.min(winW, 720);
  const cardWidth = screenW - 32; // 16px margin on each side
  const spacing = 12;
  const interval = cardWidth + spacing;
  const ref = useRef<ScrollViewInstance>(null);
  const [idx, setIdx] = useState(0);
  const { tenant } = useApp();
  const router = useRouter();
  const [BANNERS, setBanners] = useState<Banner[]>(DEFAULT_BANNERS);

  useEffect(() => {
    api<{ banners: Banner[] }>(`/content?jeweller_id=${tenant}`, { auth: "none" })
      .then((r) => setBanners(r.banners?.length ? r.banners : DEFAULT_BANNERS))
      .catch(() => {});
  }, [tenant]);

  useEffect(() => {
    if (BANNERS.length <= 1) return;
    const id = setInterval(() => {
      setIdx((i) => {
        const next = (i + 1) % BANNERS.length;
        ref.current?.scrollTo({ x: next * interval, animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(id);
  }, [interval, BANNERS.length]);

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const newIdx = Math.max(0, Math.min(BANNERS.length - 1, Math.round(x / interval)));
    setIdx(newIdx);
  };

  return (
    <View testID="hero-banner-carousel">
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled={false}
        snapToInterval={interval}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onEnd}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {BANNERS.map((b, i) => {
          const src = b.image_url ? { uri: toAbsUrl(b.image_url) } : IMAGES[b.image || "banner-1"];
          return (
            <Pressable
              key={b.id}
              style={[
                styles.banner,
                { width: cardWidth },
                i < BANNERS.length - 1 ? { marginRight: spacing } : null,
              ]}
              testID={`banner-${b.id}`}
              disabled={!b.link || !LINK_ROUTES[b.link]}
              onPress={() => {
                if (!b.link || !LINK_ROUTES[b.link]) return;
                if (b.link === "buy") {
                  if (onBuy) onBuy();
                  else router.navigate("/");
                  return;
                }
                router.push(LINK_ROUTES[b.link] as any);
              }}
            >
              <Image
                source={src}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
              {b.image_url ? null : (
                <LinearGradient
                  colors={["transparent", "rgba(17,24,39,0.88)"]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0.15 }}
                  end={{ x: 0, y: 1 }}
                />
              )}
              <View style={[styles.bannerBody, b.image_url ? { display: "none" } : null]}>
                {b.eyebrow ? (
                  <View style={styles.eyebrow}>
                    <Text style={styles.eyebrowText}>{b.eyebrow}</Text>
                  </View>
                ) : null}
                {b.title ? <Text style={styles.title}>{b.title}</Text> : null}
                {b.subtitle ? <Text style={styles.subtitle}>{b.subtitle}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.dots}>
        {BANNERS.map((b, i) => (
          <View key={b.id} style={[styles.dot, i === idx && styles.dotOn]} testID={`banner-dot-${i}`} />
        ))}
      </View>
    </View>
  );
}

const styles = themed(() => ({
  banner: {
    aspectRatio: 2.0,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    backgroundColor: colors.surfaceInverse,
  },
  bannerBody: { position: "absolute", left: 16, right: 16, bottom: 16 },
  eyebrow: {
    alignSelf: "flex-start",
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  eyebrowText: { fontFamily: fonts.bold, fontSize: 10, color: colors.onBrandPrimary, letterSpacing: 0.8 },
  title: { fontFamily: fonts.black, fontSize: 20, lineHeight: 24, letterSpacing: -0.6, color: colors.onSurfaceInverse },
  subtitle: { fontFamily: fonts.medium, fontSize: 13, color: "#F3E7C1", marginTop: 4 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  dotOn: { width: 20, backgroundColor: colors.brandPrimary },
}));
