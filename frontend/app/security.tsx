import { Fingerprint, KeyRound, ShieldCheck } from "lucide-react-native";
import React from "react";
import { Pressable, Switch, Text, View } from "react-native";

import { GlassBackdrop } from "@/src/components/GlassBackdrop";
import { ScreenHeader } from "@/src/components/Header";
import { Card } from "@/src/components/ui";
import { t } from "@/src/i18n";
import { useAppLock } from "@/src/store/AppLock";
import { colors, fonts, themed } from "@/src/theme";

export default function Security() {
  const { hasPin, bioEnabled, bioSupported, setBioEnabled, startChangePin } = useAppLock();
  return (
    <View style={styles.root} testID="security-screen">
      <GlassBackdrop />
      <ScreenHeader title={t("app_lock")} subtitle={t("mpin_hint")} showBack />
      <View style={{ padding: 16, gap: 16 }}>
        <Card>
          <View style={styles.row}>
            <View style={styles.icon}><ShieldCheck size={20} color={colors.brandDeep} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>MPIN</Text>
              <Text style={styles.sub}>{hasPin ? "4-digit MPIN is active" : "Not set"}</Text>
            </View>
            <Text style={[styles.badge, { color: hasPin ? colors.success : colors.warning }]}>{hasPin ? t("on") : t("off")}</Text>
          </View>
          <Pressable style={[styles.row, styles.divider]} onPress={startChangePin} testID="security-change-pin">
            <View style={styles.icon}><KeyRound size={20} color={colors.brandDeep} /></View>
            <Text style={[styles.title, { flex: 1 }]}>{hasPin ? t("change_mpin") : t("set_mpin")}</Text>
          </Pressable>
          <View style={[styles.row, styles.divider]}>
            <View style={styles.icon}><Fingerprint size={20} color={colors.brandDeep} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t("enable_biometric")}</Text>
              <Text style={styles.sub}>{bioSupported ? "Uses the fingerprint / face unlock set up on this phone" : "Not available on this device"}</Text>
            </View>
            <Switch value={bioEnabled} disabled={!bioSupported} onValueChange={(v) => setBioEnabled(v)} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} testID="security-bio-switch" />
          </View>
        </Card>
      </View>
    </View>
  );
}

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: "transparent" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider, marginTop: 8, paddingTop: 8 },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onSurface },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: { fontFamily: fonts.bold, fontSize: 12 },
}));
