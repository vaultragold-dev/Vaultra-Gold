import { useRouter } from "expo-router";
import { Coins, Scale, Check } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { api } from "@/src/api";
import { LiquidGlass } from "@/src/components/Glass";
import { useToast } from "@/src/components/Toast";
import { Button, Row, Sheet } from "@/src/components/ui";
import { grams, inr } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, radius, themed } from "@/src/theme";

const QUICK = [500, 1000, 2000, 5000];

/** `select` - set from the home Gold / Silver rate cards (n changes on every tap so the same metal can be re-selected). */
export function BuyWidget({ select }: { select?: { metal: "gold" | "silver"; n: number } } = {}) {
  const router = useRouter();
  const toast = useToast();
  const { price, token, user, tenant, refresh } = useApp();
  const [mode, setMode] = useState<"rupees" | "grams">("rupees");
  const [metal, setMetal] = useState<"gold" | "silver">(select?.metal ?? "gold");
  useEffect(() => {
    if (select?.metal) {
      setMetal(select.metal);
      setQuote(null);
    }
  }, [select?.metal, select?.n]);
  const [val, setVal] = useState("2000");
  const [quote, setQuote] = useState<any>(null);
  const [showPay, setShowPay] = useState(false);
  const [payStage, setPayStage] = useState<"select" | "processing" | "success">("select");
  const [lastTxn, setLastTxn] = useState<any>(null);

  const liveRate = price?.has_live === false ? 0 : metal === "gold" ? price?.buy ?? 0 : price?.silver?.buy ?? 0;
  const paused = !!price?.offline || price?.booking_enabled === false || !!price?.rates_hidden;

  // Screen always shows the live rate; the price is locked on the server only when the customer taps Proceed
  const rate = showPay && quote ? quote.buy : liveRate;
  const n = parseFloat(val) || 0;
  // GST-inclusive: customer pays exactly the amount; 3% GST is taken out of the grams
  const total = mode === "rupees" ? n : n * rate;
  const amt = total * 0.97;
  const g = rate ? Math.floor((amt / rate) * 10000) / 10000 : 0;
  const minInv = price?.min_investment ?? 500;
  const maxInv = price?.max_investment ?? 200000;
  const metalLabel = metal === "gold" ? "24K Gold" : "Silver";

  const proceedToBuy = async () => {
    if (!token) { router.push("/login"); return; }
    if (user?.kyc_status !== "approved" && price?.kyc_required_to_buy !== false) {
      toast("info", "KYC Required", "Please complete and submit your KYC in Profile before buying Gold or Silver");
      router.push("/profile");
      return;
    }
    if (n <= 0 || !liveRate) { toast("info", "Enter an amount first"); return; }
    if (total < minInv) { toast("info", `Minimum investment is ₹${minInv.toLocaleString("en-IN")}`); return; }
    if (total > maxInv) { toast("info", "Purchase limit exceeded", `Maximum per order is ₹${maxInv.toLocaleString("en-IN")}. Daily limit ₹${(price?.daily_limit ?? maxInv).toLocaleString("en-IN")}.`); return; }
    // Freeze a fresh price at the moment the customer taps Proceed (2 minutes)
    try {
      const q = await api(metal === "gold" ? "/quote" : "/quote/silver", { method: "POST", body: { tenant }, auth: "none" });
      setQuote(q);
    } catch (e: any) {
      toast("error", e?.message || "Could not get the price. Please retry");
      return;
    }
    setShowPay(true);
    setPayStage("select");
  };

  const confirmPurchase = async () => {
    setPayStage("processing");
    try {
      const endpoint = metal === "gold" ? "/orders/buy" : "/orders/buy-silver";
      const order = await api(endpoint, {
        method: "POST",
        body: { quote_id: quote.id, mode, value: n, method: "upi" },
      });
      if (order.provider === "razorpay" && order.checkout_url) {
        // Real payment: the store's own Razorpay checkout; gold is credited only after the payment is verified
        setShowPay(false);
        setPayStage("select");
        router.push({ pathname: "/checkout", params: { url: order.checkout_url, id: order.id } });
        return;
      }
      const r = await api(`/orders/${order.id}/mock-confirm`, { method: "POST", body: { method: "upi", success: true } });
      setLastTxn(r.transaction || order);
      setPayStage("success");
      await refresh();
    } catch (e: any) {
      toast("error", "Purchase failed", e.message);
      setShowPay(false);
      setPayStage("select");
    }
  };

  return (
    <LiquidGlass layer={1} radius={28} style={styles.root} innerStyle={styles.outerPad} testID="buy-widget">
      <LiquidGlass layer={2} radius={22} innerStyle={styles.innerCard}>
      <View style={styles.head}>
        <View>
          <Text style={styles.headLabel}>{price?.offline ? (liveRate > 0 ? "LAST" : "") : paused ? "" : "LIVE"} {metal === "gold" ? "24K" : "SILVER"} BUY RATE</Text>
          <Text style={styles.headRate} testID="buy-rate">{rate > 0 ? inr(rate) : "—"}<Text style={styles.perG}>/g</Text></Text>
          <Text style={styles.gstNote}>{price?.offline ? (rate > 0 ? "Showing last live rate" : "Waiting for live rates") : paused ? "Booking is paused by the store" : "GST included"}</Text>
        </View>
      </View>

      {/* Metal Toggle */}
      <View style={styles.toggleRow} testID="metal-toggle">
        <Pressable style={[styles.toggleBtn, metal === "gold" && styles.toggleActive]} onPress={() => { setMetal("gold"); setQuote(null); }} testID="toggle-gold">
          <Coins size={14} color="#FFFFFF" strokeWidth={1.8} />
          <Text style={[styles.toggleText, metal === "gold" && styles.toggleActiveText]}>Gold (24K)</Text>
        </Pressable>
        <Pressable style={[styles.toggleBtn, metal === "silver" && styles.toggleSilverActive]} onPress={() => { setMetal("silver"); setQuote(null); }} testID="toggle-silver">
          <Coins size={14} color="#FFFFFF" strokeWidth={1.8} />
          <Text style={[styles.toggleText, metal === "silver" && styles.toggleActiveText]}>Silver</Text>
        </Pressable>
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeRow}>
        <Pressable style={[styles.modeBtn, mode === "rupees" && styles.modeActive]} onPress={() => setMode("rupees")} testID="buy-mode-rupees">
          <Text style={styles.modeLabel}>₹</Text>
          <Text style={[styles.modeText, mode === "rupees" && styles.modeActiveText]}>Buy in Rupees (₹)</Text>
        </Pressable>
        <Pressable style={[styles.modeBtn, mode === "grams" && styles.modeActive]} onPress={() => setMode("grams")} testID="buy-mode-grams">
          <Scale size={14} color="#FFFFFF" strokeWidth={1.8} />
          <Text style={[styles.modeText, mode === "grams" && styles.modeActiveText]}>Buy in Grams (g)</Text>
        </Pressable>
      </View>

      {/* Input (Layer 2 Deep Recessed) */}
      <View style={styles.inputRow}>
        <Text style={styles.rupeeSign}>{mode === "rupees" ? "₹" : "g"}</Text>
        <TextInput testID="buy-input" value={val} onChangeText={(t) => setVal(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={colors.mutedLight} />
        <View style={styles.equiv}>
          <Text style={styles.eqLabel}>{mode === "rupees" ? "You get" : "You pay"}</Text>
          <Text style={styles.eqVal} testID="buy-equivalent">{mode === "rupees" ? grams(g) : inr(total)}</Text>
        </View>
      </View>

      {/* Quick amounts */}
      <View style={styles.quickRow}>
        {QUICK.map((q) => {
          const on = mode === "rupees" && Number(val) === q;
          return (
            <Pressable key={q} onPress={() => { setMode("rupees"); setVal(String(q)); }} style={[styles.chip, on && styles.chipActive]} testID={`quick-${q}`}>
              <Text style={styles.chipText}>+₹{q.toLocaleString("en-IN")}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Breakdown */}
      {liveRate > 0 ? (
      <View style={styles.breakdown}>
        <View style={styles.row}><Text style={styles.bk}>You pay</Text><Text style={styles.bkr}>{inr(total)}</Text></View>
        <View style={styles.divider} />
        <View style={styles.row}><Text style={styles.total}>You get</Text><Text style={styles.totalR} testID="buy-net-grams">{grams(g)}</Text></View>
      </View>
      ) : null}

      {/* CTA */}
      {paused ? (
        <View style={styles.pausedBox} testID="rates-paused-notice">
          <Text style={styles.pausedTitle}>{price?.rates_hidden ? "Rates not available" : price?.booking_enabled === false ? "Booking turned off" : "Live rates paused"}</Text>
          <Text style={styles.pausedSub}>{price?.booking_enabled === false || price?.rates_hidden ? "The store has paused new bookings for now. Please check back later." : "Buying will resume automatically as soon as live rates are back."}</Text>
        </View>
      ) : null}
      <Pressable testID="buy-proceed-button" disabled={paused} onPress={proceedToBuy} style={({ pressed }) => [styles.ctaWrap, paused && { opacity: 0.45 }, pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] }]}>
        <View style={styles.cta}>
          <Text style={styles.ctaText} testID="buy-proceed-text">{price?.offline ? "Rates paused" : paused ? "Booking paused" : `Proceed to Buy ${metalLabel}  →`}</Text>
        </View>
      </Pressable>
      </LiquidGlass>

      {/* Payment Sheet - Inline */}
      <Sheet visible={showPay} onClose={payStage === "processing" ? () => {} : () => { setShowPay(false); setPayStage("select"); }} title={payStage === "success" ? undefined : "Confirm Purchase"} testID="buy-payment-sheet">
        {payStage === "select" ? (
          <View>
            <View style={styles.payBox}>
              <Text style={styles.payLabel}>You are buying</Text>
              <Text style={styles.payGrams}>{grams(g)} of {metalLabel}</Text>
              <Text style={styles.payRate}>@ {inr(rate)}/g</Text>
            </View>
            <Row label="You pay" value={inr(total)} />
            <Row label={`${metalLabel} credited`} value={grams(g)} bold />
            <Text style={styles.payNote}>Price includes GST · Paid via UPI · {metalLabel} is credited to your vault instantly</Text>
            <Button testID="confirm-buy-button" title={`Pay ${inr(total)} & Buy ${metalLabel}`} size="lg" onPress={confirmPurchase} style={{ marginTop: 16 }} />
          </View>
        ) : payStage === "processing" ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.brandPrimary} />
            <Text style={styles.procTitle}>Processing purchase…</Text>
            <Text style={styles.procSub}>Please don&apos;t close this screen</Text>
          </View>
        ) : lastTxn ? (
          <View style={styles.center}>
            <Animated.View entering={ZoomIn.springify()} style={styles.successIcon}>
              <Check size={34} color="#FFFFFF" strokeWidth={3} />
            </Animated.View>
            <Text style={styles.procTitle}>{metalLabel} added to your vault!</Text>
            <Text style={styles.successGrams}>+{grams(lastTxn.grams)}</Text>
            <View style={{ alignSelf: "stretch", marginTop: 16 }}>
              <Row label="Rate" value={`${inr(lastTxn.rate ?? rate)}/g`} />
              <Row label="Total paid" value={inr(lastTxn.total)} bold />
            </View>
            <Button testID="buy-done-button" title="Done" variant="dark" onPress={() => { setShowPay(false); setPayStage("select"); }} style={{ alignSelf: "stretch", marginTop: 16 }} />
          </View>
        ) : null}
      </Sheet>
    </LiquidGlass>
  );
}

const styles = themed(() => ({
  pausedBox: { backgroundColor: colors.errorTint, borderRadius: 12, padding: 12, marginTop: 12 },
  pausedTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.error },
  pausedSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.onSurface, marginTop: 2 },

  root: { marginHorizontal: 16 },
  outerPad: { padding: 10 },
  innerCard: { paddingBottom: 2 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 14, gap: 8 },
  headLabel: { fontFamily: fonts.bold, fontSize: 10, color: colors.muted, letterSpacing: 1.4 },
  headRate: { fontFamily: fonts.displayBold, fontSize: 30, color: "#FFFFFF", letterSpacing: -0.4, marginTop: 3 },
  perG: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  gstNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 3 },
  toggleRow: { flexDirection: "row", gap: 8, paddingHorizontal: 14, marginBottom: 10 },
  toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: 14, borderWidth: 1, borderColor: colors.layer3Border, backgroundColor: colors.layer3Fill },
  toggleActive: { borderColor: colors.layer3ActiveBorder, backgroundColor: colors.layer3ActiveFill },
  toggleSilverActive: { borderColor: colors.layer3ActiveBorder, backgroundColor: colors.layer3ActiveFill },
  toggleText: { fontFamily: fonts.semibold, fontSize: 13, color: "rgba(255,255,255,0.78)" },
  toggleActiveText: { color: "#FFFFFF", fontFamily: fonts.bold },
  modeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 14 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: 14, borderWidth: 1, borderColor: colors.layer3Border, backgroundColor: colors.layer3Fill },
  modeActive: { borderColor: colors.layer3ActiveBorder, backgroundColor: colors.layer3ActiveFill },
  modeLabel: { fontFamily: fonts.bold, fontSize: 14, color: "#FFFFFF" },
  modeText: { fontFamily: fonts.medium, fontSize: 12.5, color: "rgba(255,255,255,0.78)" },
  modeActiveText: { color: "#FFFFFF", fontFamily: fonts.bold },
  inputRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 14, marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.layer2DeepBorder, backgroundColor: colors.layer2DeepFill, height: 60, paddingHorizontal: 14 },
  rupeeSign: { fontFamily: fonts.displayBold, fontSize: 24, color: "#FFFFFF", marginRight: 6 },
  input: { flex: 1, minWidth: 0, fontFamily: fonts.displayBold, fontSize: 28, color: "#FFFFFF", letterSpacing: -0.2 },
  equiv: { alignItems: "flex-end" },
  eqLabel: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.muted, letterSpacing: 0.3 },
  eqVal: { fontFamily: fonts.displayBold, fontSize: 17, color: "#FFFFFF" },
  quickRow: { flexDirection: "row", gap: 8, paddingHorizontal: 14, marginTop: 10 },
  chip: { flex: 1, height: 34, borderRadius: 12, borderWidth: 1, borderColor: colors.layer3Border, backgroundColor: colors.layer3Fill, alignItems: "center", justifyContent: "center" },
  chipActive: { borderColor: colors.layer3ActiveBorder, backgroundColor: colors.layer3ActiveFill },
  chipText: { fontFamily: fonts.semibold, fontSize: 12, color: "#FFFFFF" },
  breakdown: { marginHorizontal: 14, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.layer2DeepFill, borderRadius: 16, borderWidth: 1, borderColor: colors.layer2DeepBorder },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  bk: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  bkr: { fontFamily: fonts.semibold, fontSize: 13, color: "#FFFFFF" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginVertical: 6 },
  total: { fontFamily: fonts.bold, fontSize: 14.5, color: "#FFFFFF" },
  totalR: { fontFamily: fonts.displayBold, fontSize: 19, color: "#FFFFFF" },
  ctaWrap: { marginHorizontal: 14, marginVertical: 14, borderRadius: 16, overflow: "hidden" },
  cta: { height: 50, borderRadius: 16, backgroundColor: colors.layer3ActiveFill, borderWidth: 1, borderColor: colors.layer3ActiveBorder, alignItems: "center", justifyContent: "center" },
  ctaText: { fontFamily: fonts.bold, fontSize: 15, color: "#FFFFFF", letterSpacing: 0.2 },
  payBox: { backgroundColor: colors.brandTertiary, borderRadius: 18, padding: 16, marginBottom: 16, alignItems: "center" },
  payLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  payGrams: { fontFamily: fonts.displayBold, fontSize: 27, color: colors.onBrandTertiary, marginTop: 4 },
  payRate: { fontFamily: fonts.medium, fontSize: 13, color: colors.onBrandTertiary },
  payNote: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, textAlign: "center", marginTop: 12 },
  center: { alignItems: "center", paddingVertical: 24 },
  procTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.onSurface, marginTop: 16 },
  procSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4 },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  successGrams: { fontFamily: fonts.black, fontSize: 34, color: colors.brandSecondary, letterSpacing: -1, marginTop: 4 },
}));
