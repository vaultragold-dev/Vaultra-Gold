import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { LiquidGlass } from "@/src/components/Glass";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, themed } from "@/src/theme";

const ROWS: { key: "24K" | "22K" | "18K"; label: string; purity: string }[] = [
  { key: "24K", label: "Gold 24K", purity: "99.9% · digital gold" },
  { key: "22K", label: "Gold 22K", purity: "91.6% · jewellery" },
  { key: "18K", label: "Gold 18K", purity: "75.0% · jewellery" },
];

/** Live per-gram rates: MCX 24K scaled by purity + this jeweller's margin per karat (computed by the backend). */
export function KaratRates() {
  const { price } = useApp();
  const noRate = !price || price.has_live === false;
  const fmt = (n?: number) => (noRate || !n ? "—" : `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  return (
    <LiquidGlass layer={1} radius={26} style={styles.cardWrap} innerStyle={styles.outerPad} testID="karat-rates">
      <LiquidGlass layer={2} radius={20} innerStyle={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Today&apos;s Rates</Text>
        <Text style={styles.sub}>{price?.offline ? "Paused" : price?.live ? "LIVE · PER GRAM" : "PER GRAM"}</Text>
      </View>
      {ROWS.map((r) => (
        <View key={r.key} style={styles.row} testID={`karat-rate-${r.key}`}>
          <View style={styles.badge}><Text style={styles.badgeText}>{r.key}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{r.label}</Text>
            <Text style={styles.purity}>{r.purity}</Text>
          </View>
          <Text style={styles.value}>{fmt(price?.karats?.[r.key])}<Text style={styles.per}>/g</Text></Text>
        </View>
      ))}
      <View style={[styles.row, { borderBottomWidth: 0 }]} testID="karat-rate-silver">
        <View style={styles.badge}><Text style={styles.badgeText}>Ag</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Silver 999</Text>
          <Text style={styles.purity}>99.9% fine</Text>
        </View>
        <Text style={styles.value}>{fmt(price?.silver?.buy)}<Text style={styles.per}>/g</Text></Text>
      </View>
      </LiquidGlass>
    </LiquidGlass>
  );
}

const styles = themed(() => ({
  cardWrap: { marginHorizontal: 16, marginTop: 16 },
  outerPad: { padding: 8 },
  card: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 },
  title: { fontFamily: fonts.displayBold, fontSize: 18, color: "#FFFFFF", letterSpacing: -0.2 },
  sub: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.muted, letterSpacing: 1.1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  badge: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.layer3Fill, borderWidth: 1, borderColor: colors.layer3Border, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: "#FFFFFF" },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: "#FFFFFF" },
  purity: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 1 },
  value: { fontFamily: fonts.displayBold, fontSize: 16.5, color: "#FFFFFF" },
  per: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
}));
