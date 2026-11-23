import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { ArrowLeft, Copy, Gift, Link2, Share2, Users } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassBackdrop } from "@/src/components/GlassBackdrop";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { Button, Card } from "@/src/components/ui";
import { inr, shortDate } from "@/src/format";
import { t } from "@/src/i18n";
import { useApp } from "@/src/store/AppContext";
import { tenantConfig } from "@/src/tenantConfig";
import { cardShadow, colors, fonts, radius, themed } from "@/src/theme";

type ReferralData = {
  referral_code: string;
  referral_balance: number;
  referral_count: number;
  referred?: boolean;
  referrals: { name: string; joined: string }[];
};

export default function ReferralScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { token, tenantName, tenant } = useApp();
  const [reward, setReward] = useState(50);
  useEffect(() => {
    api<{ amount: number }>(`/referral-reward?tenant=${tenant}`, { auth: "none" }).then((r) => setReward(r.amount)).catch(() => {});
  }, [tenant]);
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendCode, setFriendCode] = useState("");
  const [applying, setApplying] = useState(false);
  const { refresh } = useApp();

  const load = () =>
    api<ReferralData>("/referral")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    load();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Store link carries the code so the friend's sign-up form is pre-filled
  const pkg = tenantConfig.packageName || tenantConfig.bundleId || "";
  const inviteLink = data
    ? pkg
      ? `https://play.google.com/store/apps/details?id=${pkg}&referrer=${encodeURIComponent(`ref=${data.referral_code}`)}`
      : `${(tenantConfig.apiBaseUrl || "https://master.vaultragold.com").replace(/\/+$/, "")}/?ref=${data.referral_code}`
    : "";

  const copyLink = async () => {
    if (!inviteLink) return;
    await Clipboard.setStringAsync(inviteLink);
    toast("success", "Copied!", "Invite link copied to clipboard");
  };

  const applyFriendCode = async () => {
    const code = friendCode.trim().toUpperCase();
    if (code.length < 4) return toast("error", "Enter a valid referral code");
    if (code === data?.referral_code) return toast("error", "You cannot use your own code");
    setApplying(true);
    try {
      await api("/me", { method: "PATCH", body: { referral_code: code } });
      await load();
      refresh();
      const fresh = await api<ReferralData>("/referral").catch(() => null);
      if (fresh?.referred) toast("success", "Referral applied!", `₹${reward} reward added to your account`);
      else toast("error", "Code not valid", "Please check the code with your friend");
      setFriendCode("");
    } catch (e: any) {
      toast("error", "Could not apply code", e.message);
    } finally {
      setApplying(false);
    }
  };

  const copyCode = async () => {
    if (!data) return;
    await Clipboard.setStringAsync(data.referral_code);
    toast("success", "Copied!", "Referral code copied to clipboard");
  };

  const shareLink = async () => {
    if (!data) return;
    try {
      await Share.share({
        message: `Join ${tenantName || "us"} and get ₹${reward} reward! Use my referral code: ${data.referral_code}\n\nDownload the app: ${inviteLink}\n\nBuy & save 24K gold from ₹500.`,
        title: `Invite to ${tenantName || "Digital Gold"}`,
      });
    } catch {}
  };

  if (!token) {
    return (
      <View style={styles.root}>
        <GlassBackdrop />
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Refer & Earn</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.center}>
          <Users size={48} color={colors.brandSecondary} />
          <Text style={styles.emptyTitle}>Sign in to start earning</Text>
          <Text style={styles.emptySub}>Invite friends and earn ₹{reward} for each successful referral.</Text>
          <Button title="Sign In" onPress={() => router.push("/login")} style={{ alignSelf: "stretch", marginTop: 16 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="referral-screen">
      <GlassBackdrop />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} testID="referral-back-button">
          <ArrowLeft size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}>
        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
        ) : data ? (
          <>
            {/* Hero Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroIconWrap}>
                <Gift size={32} color={colors.onBrandPrimary} />
              </View>
              <Text style={styles.heroTitle}>Invite Friends, Earn ₹{reward} Each!</Text>
              <Text style={styles.heroSub}>
                Share your unique code. When your friend signs up, you both get ₹{reward} reward!
              </Text>
            </View>

            {/* Referral Code Card */}
            <Card>
              <Text style={styles.codeLabel}>YOUR REFERRAL CODE</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText} testID="referral-code" selectable>{data.referral_code}</Text>
                <Pressable onPress={copyCode} style={styles.copyBtn} testID="referral-copy-button">
                  <Copy size={18} color={colors.brandSecondary} />
                  <Text style={styles.copyText}>Copy</Text>
                </Pressable>
              </View>

              <Text style={[styles.codeLabel, { marginTop: 16 }]}>{t("your_link")}</Text>
              <Pressable onPress={copyLink} style={[styles.codeBox, { paddingVertical: 10 }]} testID="referral-link">
                <Link2 size={16} color={colors.brandSecondary} />
                <Text style={styles.linkText} numberOfLines={1}>{inviteLink}</Text>
                <Copy size={16} color={colors.brandSecondary} />
              </Pressable>

              <Button
                title={t("share_link")}
                size="lg"
                icon={<Share2 size={18} color={colors.onBrandPrimary} />}
                onPress={shareLink}
                style={{ marginTop: 16 }}
                testID="referral-share-button"
              />
            </Card>

            {!data.referred ? (
              <Card>
                <Text style={styles.howTitle}>{t("have_code")}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <TextInput
                    value={friendCode}
                    onChangeText={(v) => setFriendCode(v.toUpperCase())}
                    placeholder="e.g. VDG12AB3"
                    placeholderTextColor={colors.mutedLight}
                    autoCapitalize="characters"
                    style={styles.codeInput}
                    testID="referral-apply-input"
                  />
                  <Button title={t("apply")} loading={applying} onPress={applyFriendCode} style={{ minWidth: 96 }} testID="referral-apply-button" />
                </View>
              </Card>
            ) : null}

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{data.referral_count}</Text>
                <Text style={styles.statLabel}>Friends Joined</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{inr(data.referral_balance, 0)}</Text>
                <Text style={styles.statLabel}>Total Earned</Text>
              </View>
            </View>

            {/* How it works */}
            <Card>
              <Text style={styles.howTitle}>How it works</Text>
              {[
                { step: "1", title: "Share your code", desc: "Send your unique referral code or link to friends" },
                { step: "2", title: "Friend signs up", desc: "Your friend enters your code during registration" },
                { step: "3", title: `You both earn ₹${reward}`, desc: `₹${reward} reward credited to both accounts instantly` },
              ].map((item) => (
                <View key={item.step} style={styles.stepRow}>
                  <View style={styles.stepCircle}>
                    <Text style={styles.stepNum}>{item.step}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>{item.title}</Text>
                    <Text style={styles.stepDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </Card>

            {/* Referral History */}
            {data.referrals.length > 0 ? (
              <Card>
                <Text style={styles.howTitle}>Your Referrals</Text>
                {data.referrals.map((r, i) => (
                  <View key={i} style={[styles.refRow, i < data.referrals.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                    <View style={styles.refAvatar}>
                      <Text style={styles.refAvatarText}>{r.name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.refName}>{r.name}</Text>
                      <Text style={styles.refDate}>Joined {shortDate(r.joined)}</Text>
                    </View>
                    <Text style={styles.refReward}>+₹{reward}</Text>
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        ) : (
          <Text style={styles.emptySub}>Could not load referral data. Pull to retry.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: "transparent" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  headerTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.onSurface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  emptyTitle: { fontFamily: fonts.black, fontSize: 22, color: colors.onSurface, textAlign: "center" },
  emptySub: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: "center" },
  heroCard: {
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.md,
    padding: 24,
    alignItems: "center",
    ...cardShadow,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: { fontFamily: fonts.black, fontSize: 22, color: colors.onSurfaceInverse, textAlign: "center", letterSpacing: -0.5 },
  heroSub: { fontFamily: fonts.regular, fontSize: 14, color: colors.mutedLight, textAlign: "center", marginTop: 8, lineHeight: 20 },
  codeLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.muted, letterSpacing: 1 },
  codeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    padding: 16,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: "#F0E2B0",
    borderStyle: "dashed",
  },
  codeText: { fontFamily: fonts.black, fontSize: 26, letterSpacing: 3, color: colors.onBrandTertiary },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, height: 36, borderWidth: 1, borderColor: colors.border },
  copyText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.brandSecondary },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  statValue: { fontFamily: fonts.black, fontSize: 28, color: colors.brandSecondary, letterSpacing: -1 },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginTop: 4 },
  howTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.onSurface, marginBottom: 16 },
  stepRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 16 },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: { fontFamily: fonts.bold, fontSize: 14, color: colors.onBrandPrimary },
  stepTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface },
  stepDesc: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  refRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  refAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  refAvatarText: { fontFamily: fonts.bold, fontSize: 16, color: colors.onBrandTertiary },
  refName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
  refDate: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  refReward: { fontFamily: fonts.bold, fontSize: 14, color: colors.success },
  linkText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.onSurfaceTertiary, marginHorizontal: 8 },
  codeInput: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, fontFamily: fonts.bold, fontSize: 15, letterSpacing: 1, color: colors.onSurface, backgroundColor: colors.surface },
}));
