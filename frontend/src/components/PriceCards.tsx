import { useRouter } from "expo-router";
import { Coins, RefreshCw, Store, Vault } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";

import { Glass, LiquidGlass } from "@/src/components/Glass";
import { t } from "@/src/i18n";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, themed } from "@/src/theme";

/**
 * 3-Layer Spatial Glass Live Rates & Quick Actions Panel (Exact match to user reference):
 *  - Layer 1: Outer ultra-clear glass shell (3%)
 *  - Layer 2 Deep: Clean flicker-free recessed Gold 24K & Silver 999 cards (NO animated coin/ring)
 *  - Layer 3: 4 Transparent White-Icon Squircle Tiles (Buy / SIP / Vault / Store)
 */
export function PriceCards({ onSelect }: { onSelect?: (metal: "gold" | "silver") => void } = {}) {
  const router = useRouter();
  const { price } = useApp();
  const live = !!price?.live;
  const paused = !!price?.offline || !!price?.rates_hidden;
  const goldUp = (price?.change_pct ?? 0) >= 0;
  const silverUp = (price?.silver?.change_pct ?? 0) >= 0;
  const fmtGold = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const fmtSilver = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const quickTiles = [
    { id: "buy", label: "Buy", Icon: Coins, active: true, onPress: () => onSelect?.("gold") },
    { id: "sip", label: "SIP", Icon: RefreshCw, active: false, onPress: () => router.push("/sip") },
    { id: "vault", label: "Vault", Icon: Vault, active: false, onPress: () => router.push("/vault") },
    { id: "store", label: "Store", Icon: Store, active: false, onPress: () => router.push("/jewellery") },
  ];

  return (
    <LiquidGlass layer={1} radius={28} style={styles.outerWrap} innerStyle={styles.outerInner} testID="price-cards">
      {/* Layer 2 Deep: Gold 24K & Silver 999 Recessed Metric Cards (zero animations = zero flicker) */}
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.press, pressed && styles.pressed]}
          onPress={() => onSelect?.("gold")}
          disabled={!onSelect}
          testID="price-card-gold-buy"
        >
          <LiquidGlass layer="2deep" radius={20} innerStyle={styles.cardInner}>
            <View style={styles.topRow}>
              <View style={styles.dotLabel}>
                <View style={[styles.staticDot, { backgroundColor: live ? "#FFFFFF" : colors.mutedLight }]} />
                <Text style={styles.metalTag} testID="gold-rate-source" numberOfLines={1}>
                  GOLD 24K
                </Text>
              </View>
              {!paused ? (
                <Text style={[styles.trendText, { color: goldUp ? colors.success : colors.error }]} numberOfLines={1}>
                  {goldUp ? "▲" : "▼"}{Math.abs(price?.change_pct ?? 0).toFixed(1)}%
                </Text>
              ) : null}
            </View>

            <Text style={styles.price} testID="gold-price-card" numberOfLines={1}>
              {price && price.has_live !== false ? fmtGold(price.buy) : "—"}
              <Text style={styles.perGram}>/g</Text>
            </Text>

            <View style={styles.buyPillActive}>
              <Text style={styles.buyPillText}>{paused ? t("rates_paused") : "Buy Gold →"}</Text>
            </View>
          </LiquidGlass>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.press, pressed && styles.pressed]}
          onPress={() => onSelect?.("silver")}
          disabled={!onSelect}
          testID="price-card-silver-buy"
        >
          <LiquidGlass layer="2deep" radius={20} innerStyle={styles.cardInner}>
            <View style={styles.topRow}>
              <View style={styles.dotLabel}>
                <View style={[styles.staticDot, { backgroundColor: live ? "#FFFFFF" : colors.mutedLight }]} />
                <Text style={styles.metalTag} numberOfLines={1}>
                  SILVER 999
                </Text>
              </View>
              {!paused ? (
                <Text style={[styles.trendText, { color: silverUp ? colors.success : colors.error }]} numberOfLines={1}>
                  {silverUp ? "▲" : "▼"}{Math.abs(price?.silver?.change_pct ?? 0).toFixed(1)}%
                </Text>
              ) : null}
            </View>

            <Text style={styles.price} testID="silver-price-card" numberOfLines={1}>
              {price?.silver && price.has_live !== false ? fmtSilver(price.silver.buy) : "—"}
              <Text style={styles.perGram}>/g</Text>
            </Text>

            <View style={styles.buyPill}>
              <Text style={styles.buyPillText}>{paused ? t("rates_paused") : "Buy Silver →"}</Text>
            </View>
          </LiquidGlass>
        </Pressable>
      </View>

      {/* Layer 3: 4 Transparent White-Icon Squircle Tiles (Buy / SIP / Vault / Store) */}
      <View style={styles.tileRow}>
        {quickTiles.map(({ id, label, Icon, active, onPress }) => (
          <Pressable
            key={id}
            onPress={onPress}
            testID={`quick-tile-${id}`}
            style={({ pressed }) => [styles.tilePress, pressed && styles.pressed]}
          >
            <Glass layer={active ? "3active" : 3} radius={16} style={styles.tileBox} contentStyle={styles.tileContent}>
              <Icon size={20} color="#FFFFFF" strokeWidth={1.7} />
              <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
            </Glass>
          </Pressable>
        ))}
      </View>
    </LiquidGlass>
  );
}

const styles = themed(() => ({
  outerWrap: { marginHorizontal: 16, marginTop: 4, marginBottom: 4 },
  outerInner: { padding: 10, gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  press: { flex: 1 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  cardInner: { padding: 13, gap: 10, justifyContent: "space-between" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
  dotLabel: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  staticDot: { width: 5, height: 5, borderRadius: 2.5, opacity: 0.85 },
  metalTag: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.8, color: "rgba(255,255,255,0.74)" },
  trendText: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: -0.1, fontVariant: ["tabular-nums"] },
  price: { fontFamily: fonts.displayBold, fontSize: 22, letterSpacing: -0.3, color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  perGram: { fontFamily: fonts.medium, fontSize: 11.5, color: "rgba(255,255,255,0.68)" },
  buyPillActive: {
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: colors.layer3ActiveFill,
    borderWidth: 1,
    borderColor: colors.layer3ActiveBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  buyPill: {
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: colors.layer3Fill,
    borderWidth: 1,
    borderColor: colors.layer3Border,
    alignItems: "center",
    justifyContent: "center",
  },
  buyPillText: { fontFamily: fonts.semibold, fontSize: 11.5, color: "#FFFFFF", letterSpacing: 0.1 },
  tileRow: { flexDirection: "row", gap: 8 },
  tilePress: { flex: 1 },
  tileBox: { height: 66 },
  tileContent: { flexDirection: "column", gap: 5, paddingVertical: 8 },
  tileLabel: { fontFamily: fonts.semibold, fontSize: 11.5, color: "#FFFFFF", letterSpacing: 0.2 },
}));
