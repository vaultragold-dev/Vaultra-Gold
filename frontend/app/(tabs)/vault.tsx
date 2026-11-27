import { useRouter } from "expo-router";
import { Coins, Download, Lock, Store, TrendingUp, Vault as VaultIcon, Wallet } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassBackdrop } from "@/src/components/GlassBackdrop";
import { Glass, LiquidGlass } from "@/src/components/Glass";
import { api } from "@/src/api";
import { ScreenHeader } from "@/src/components/Header";
import { GoalsSection } from "@/src/components/Goals";
import { RedeemSheet } from "@/src/components/Product";
import { RedeemGramsSheet } from "@/src/components/RedeemGramsSheet";
import { useToast } from "@/src/components/Toast";
import { TxnRow } from "@/src/components/TxnRow";
import { Button, Chip, ChipRow, Row, Sheet, StatusBadge } from "@/src/components/ui";
import { dateTime, grams, inr, TENANT_NAME, TXN_LABEL } from "@/src/format";
import { useApp } from "@/src/store/AppContext";
import { cardShadow, colors, fonts, radius, themed } from "@/src/theme";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "gold", label: "Gold 24K" },
  { id: "silver", label: "Silver" },
  { id: "buy", label: "Buy" },
  { id: "sip", label: "SIP" },
  { id: "redemption", label: "Redeem" },
];

export default function VaultScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { token, vault, refresh, tenant, price } = useApp();
  const [filter, setFilter] = useState("all");
  const [txns, setTxns] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [coinOpen, setCoinOpen] = useState(false);
  const [gramsOpen, setGramsOpen] = useState(false);
  const [redeem, setRedeem] = useState<any>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const bottomChrome = Math.max(insets.bottom, 12) + 72; // room for the floating glass tab bar

  const loadTxns = useCallback(async () => {
    if (!token) return;
    try {
      const typeParam = ["gold", "silver"].includes(filter) ? "all" : filter;
      const res = await api(`/transactions?type=${typeParam}`);
      if (filter === "gold") {
        setTxns(res.filter((x: any) => x.metal === "gold" || (!x.metal && !x.type?.includes("silver"))));
      } else if (filter === "silver") {
        setTxns(res.filter((x: any) => x.metal === "silver" || x.type?.includes("silver")));
      } else {
        setTxns(res);
      }
    } catch {
      setTxns([]);
    }
  }, [token, filter]);

  useEffect(() => {
    loadTxns();
  }, [loadTxns, vault]);

  if (!token) {
    return (
      <View style={styles.root}>
        <GlassBackdrop />
        <ScreenHeader title="Vault & Ledger" showBack />
        <View style={styles.center} testID="vault-signed-out">
          <View style={styles.emptyIcon}>
            <Lock size={32} color={colors.brandSecondary} />
          </View>
          <Text style={styles.emptyTitle}>Your secure gold vault</Text>
          <Text style={styles.emptySub}>Sign in to view holdings, passbook and redeem physical gold.</Text>
          <Button title="Sign In with Phone" onPress={() => router.push("/login")} testID="vault-signin-button" style={{ alignSelf: "stretch" }} />
        </View>
      </View>
    );
  }

  const u = vault?.user;
  const up = (vault?.unrealized_pnl ?? 0) >= 0;
  const noRate = price?.has_live === false;

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    await loadTxns();
    setRefreshing(false);
  };

  const openInvoice = () => {
    const t = (txns || []).find((x) => x.type !== "reversal");
    if (!t) {
      toast("info", "No invoices yet", "Buy gold to generate your first invoice");
      return;
    }
    setInvoice(t);
  };

  return (
    <View style={styles.root} testID="vault-screen">
      <GlassBackdrop />
      <ScreenHeader title="Vault & Ledger" subtitle={TENANT_NAME[tenant] || ""} showBack />
      <ScrollView
        stickyHeaderIndices={[2]}
        contentContainerStyle={{ paddingBottom: bottomChrome + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} />}
      >
        <LiquidGlass
          layer={1}
          radius={28}
          style={{ margin: 16 }}
          innerStyle={styles.vaultShell}
          testID="portfolio-card"
        >
          <LiquidGlass layer="2deep" radius={22} showArc={false} innerStyle={styles.portfolio}>
            <View style={styles.pHead}>
              <VaultIcon size={16} color="#FFFFFF" strokeWidth={1.8} />
              <Text style={styles.pLabel}>VAULT HOLDINGS</Text>
              {u?.wallet_id ? (
                <View style={styles.walletPill}>
                  <Text style={styles.walletPillText}>ID: {u.wallet_id}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.pGrams} testID="portfolio-grams">
              {grams(u?.gold_grams)}
            </Text>
            <Text style={styles.pValue} testID="portfolio-value">
              {noRate ? "Rates paused" : inr(vault?.current_value)} <Text style={styles.pValueSub}>{noRate ? "value shown when live rates return" : "current value"}</Text>
            </Text>
            {(u?.silver_grams ?? 0) > 0 ? (
              <Text style={[styles.pValueSub, { color: "rgba(255,255,255,0.78)", marginTop: 4 }]} testID="portfolio-silver">Silver in vault: {grams(u?.silver_grams)}</Text>
            ) : null}
            <View style={styles.pStats}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pStatLabel}>Avg. buy price</Text>
                <Text style={styles.pStatValue} testID="portfolio-avg-price">{inr(u?.avg_buy_price)}/g</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pStatLabel}>Invested</Text>
                <Text style={styles.pStatValue}>{inr(u?.invested)}</Text>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={styles.pStatLabel}>Unrealized P&L</Text>
                <Text style={[styles.pStatValue, { color: noRate ? colors.mutedLight : up ? colors.success : colors.error }]} testID="portfolio-pnl">
                  {noRate ? "—" : `${up ? "+" : ""}${vault?.unrealized_pct ?? 0}%`}
                </Text>
              </View>
            </View>
          </LiquidGlass>

          {/* Layer 3: 4 Transparent White-Icon Squircle Action Tiles (Image 1 match!) */}
          <View style={styles.actions}>
            {[
              { id: "redeem-grams", label: "Redeem", Icon: Coins, active: true, onPress: () => setGramsOpen(true) },
              { id: "redeem", label: "Coins", Icon: Coins, active: false, onPress: () => setCoinOpen(true) },
              { id: "buy", label: "Buy", Icon: TrendingUp, active: false, onPress: () => router.push("/") },
              { id: "invoice", label: "Invoice", Icon: Download, active: false, onPress: openInvoice },
            ].map(({ id, label, Icon, active, onPress }) => (
              <Pressable key={id} testID={`vault-action-${id}`} onPress={onPress} style={({ pressed }) => [styles.action, pressed && { transform: [{ scale: 0.96 }] }]}>
                <Glass layer={active ? "3active" : 3} radius={16} style={styles.actionGlass} contentStyle={styles.actionContent}>
                  <Icon size={19} color="#FFFFFF" strokeWidth={1.7} />
                  <Text style={styles.actionText} numberOfLines={1}>{label}</Text>
                </Glass>
              </Pressable>
            ))}
          </View>
        </LiquidGlass>

        <View>
          <GoalsSection />
          {(vault?.pending_pickups || []).map((p) => (
            <View key={p.id} style={styles.pickup} testID={`pending-pickup-${p.id}`}>
              <Store size={20} color={colors.brandSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pickupTitle}>{p.item} ready for pickup</Text>
                <Text style={styles.pickupSub}>{TENANT_NAME[p.tenant]} · show OTP at counter</Text>
              </View>
              <Text style={styles.pickupOtp} testID={`pickup-otp-${p.id}`}>{p.otp}</Text>
            </View>
          ))}
          <Text style={styles.passTitle}>Transaction Passbook</Text>
        </View>

        <ChipRow style={{ backgroundColor: "transparent" }}>
          {FILTERS.map((f) => (
            <Chip key={f.id} label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} testID={`passbook-filter-${f.id}`} />
          ))}
        </ChipRow>

        <View style={styles.passbook} testID="passbook-list">
          {txns === null ? (
            <ActivityIndicator color={colors.brandPrimary} style={{ marginVertical: 24 }} />
          ) : txns.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 32, gap: 8 }} testID="passbook-empty">
              <Wallet size={28} color={colors.mutedLight} />
              <Text style={styles.emptySub}>No {filter === "all" ? "" : FILTERS.find((f) => f.id === filter)?.label + " "}transactions yet</Text>
            </View>
          ) : (
            txns.map((t) => <TxnRow key={t.id} t={t} onPress={() => setInvoice(t)} />)
          )}
        </View>
      </ScrollView>

      <Sheet visible={coinOpen} onClose={() => setCoinOpen(false)} title="Redeem physical coins" testID="coin-sheet">
        <Text style={styles.emptySub}>Choose a 24K 999.9 minted coin. Collect in store or get BRINK&apos;S insured delivery.</Text>
        <View style={styles.coinGrid}>
          {[1, 2, 5, 10].map((c) => (
            <Pressable
              key={c}
              testID={`coin-option-${c}`}
              style={styles.coin}
              onPress={() => {
                setCoinOpen(false);
                setRedeem({ kind: "coin", coin: c });
              }}
            >
              <View style={styles.coinCircle}>
                <Text style={styles.coinG}>{c}g</Text>
              </View>
              <Text style={styles.coinLabel}>{inr(c * (vault?.buy_rate ?? 0), 0)}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
      <RedeemSheet target={redeem} onClose={() => setRedeem(null)} />
      <RedeemGramsSheet visible={gramsOpen} onClose={() => setGramsOpen(false)} />
      <InvoiceSheet t={invoice} onClose={() => setInvoice(null)} />
    </View>
  );
}

function InvoiceSheet({ t, onClose }: { t: any; onClose: () => void }) {
  const share = async () => {
    if (!t) return;
    const text = `${TENANT_NAME[t.tenant] || "Digital Gold"} — Tax Invoice\nInvoice: ${t.invoice_no}\nDate: ${dateTime(t.created_at)}\nStore: ${TENANT_NAME[t.tenant]}\nType: ${TXN_LABEL[t.type] || t.type}\n${t.metal === "silver" ? "Silver" : "Gold"}: ${grams(t.grams)} ${t.metal === "silver" ? "999" : "24K"} @ ${inr(t.rate)}/g\nValue: ${inr(t.amount)}\nGST (3%): ${inr(t.gst)}\nTotal: ${inr(t.total)}\nStatus: ${t.status}`;
    try {
      await Share.share({ message: text, title: t.invoice_no });
    } catch {}
  };
  return (
    <Sheet visible={!!t} onClose={onClose} title="Tax Invoice" testID="invoice-sheet">
      {t ? (
        <View style={{ paddingBottom: 8 }}>
          <View style={styles.invHead}>
            <View>
              <Text style={styles.invNo} testID="invoice-number">{t.invoice_no}</Text>
              <Text style={styles.invDate}>{dateTime(t.created_at)}</Text>
            </View>
            <StatusBadge status={t.status} />
          </View>
          <Row label="Store" value={TENANT_NAME[t.tenant]} />
          <Row label="Type" value={TXN_LABEL[t.type] || t.type} />
          <Row label={t.metal === "silver" ? "Silver (999)" : "Gold (24K 99.9%)"} value={grams(t.grams)} />
          <Row label="Rate" value={`${inr(t.rate)}/g`} />
          <Row label={t.metal === "silver" ? "Silver value" : "Gold value"} value={inr(t.amount)} />
          <Row label="GST (3%)" value={inr(t.gst)} />
          <Row label={t.type === "redemption" ? "Making charges" : "Total"} value={inr(t.total)} bold />
          {t.note ? <Text style={[styles.emptySub, { marginTop: 8 }]}>{t.note}</Text> : null}
          <Button title="Download / Share Invoice" icon={<Download size={18} color={colors.onBrandPrimary} />} onPress={share} style={{ marginTop: 16 }} testID="invoice-share-button" />
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.liquidLensBg, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: 24, letterSpacing: -0.2, color: colors.onSurface },
  emptySub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: "center" },
  vaultShell: { padding: 10, gap: 10 },
  portfolio: { padding: 18 },
  pHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  pLabel: { fontFamily: fonts.bold, fontSize: 10, color: colors.muted, letterSpacing: 1.5 },
  walletPill: { marginLeft: "auto", backgroundColor: colors.layer3Fill, borderWidth: 1, borderColor: colors.layer3Border, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  walletPillText: { fontFamily: fonts.semibold, fontSize: 10.5, color: "#FFFFFF" },
  pGrams: { fontFamily: fonts.displayBold, fontSize: 38, color: "#FFFFFF", letterSpacing: -0.4, marginTop: 8 },
  pValue: { fontFamily: fonts.displayBold, fontSize: 19, color: "#FFFFFF", marginTop: 2 },
  pValueSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  pStats: { flexDirection: "row", marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  pStatLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted },
  pStatValue: { fontFamily: fonts.displayBold, fontSize: 15, color: "#FFFFFF", marginTop: 3 },
  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1 },
  actionGlass: { height: 64 },
  actionContent: { flexDirection: "column", gap: 5, paddingVertical: 8 },
  actionText: { fontFamily: fonts.semibold, fontSize: 11, color: "#FFFFFF" },
  pickup: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 20, backgroundColor: colors.layer2FillB, borderWidth: 1, borderColor: colors.layer2Border },
  pickupTitle: { fontFamily: fonts.semibold, fontSize: 14, color: "#FFFFFF" },
  pickupSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  pickupOtp: { fontFamily: fonts.displayBold, fontSize: 19, letterSpacing: 2, color: "#FFFFFF" },
  passTitle: { fontFamily: fonts.displayBold, fontSize: 22, letterSpacing: -0.2, color: "#FFFFFF", marginHorizontal: 16, marginTop: 22, marginBottom: 4 },
  passbook: { marginHorizontal: 16, backgroundColor: colors.layer2FillB, borderRadius: 22, borderWidth: 1, borderColor: colors.layer2Border, paddingHorizontal: 16 },
  coinGrid: { flexDirection: "row", gap: 8, marginVertical: 16 },
  coin: { flex: 1, alignItems: "center", gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  coinCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#F0E2B0" },
  coinG: { fontFamily: fonts.black, fontSize: 16, color: colors.onBrandPrimary },
  coinLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.muted },
  sellInput: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: colors.brandPrimary, borderRadius: radius.md, paddingHorizontal: 16, height: 60, marginVertical: 12 },
  sellField: { flex: 1, fontFamily: fonts.bold, fontSize: 22, color: colors.onSurface, height: 56 },
  sellUnit: { fontFamily: fonts.bold, fontSize: 18, color: colors.muted, marginRight: 12 },
  maxBtn: { backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingHorizontal: 12, height: 32, justifyContent: "center" },
  maxText: { fontFamily: fonts.bold, fontSize: 12, color: colors.onBrandTertiary },
  invHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  invDate: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  invNo: { fontFamily: fonts.bold, fontSize: 16, color: colors.onSurface },
}));
