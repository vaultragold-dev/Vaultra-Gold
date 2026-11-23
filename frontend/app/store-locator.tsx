import { Clock, MapPin, MessageCircle, Navigation, Phone } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { GlassBackdrop } from "@/src/components/GlassBackdrop";
import { LogoMark, ScreenHeader } from "@/src/components/Header";
import { Card } from "@/src/components/ui";
import { t } from "@/src/i18n";
import { useApp } from "@/src/store/AppContext";
import { tenantConfig } from "@/src/tenantConfig";
import { colors, fonts, radius, themed } from "@/src/theme";

type StoreInfo = { name: string; address: string; city: string; state: string; pincode: string; phone: string; lat?: number | null; lng?: number | null; hours?: string };

let WebView: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebView = Platform.OS === "web" ? null : require("react-native-webview").WebView;
} catch {
  WebView = null;
}

export default function StoreLocator() {
  const insets = useSafeAreaInsets();
  const { tenant, tenantName, tenantPhone } = useApp();
  const [info, setInfo] = useState<StoreInfo | null>(((tenantConfig as any).storeInfo as StoreInfo) || null);
  const [loading, setLoading] = useState(!info);

  useEffect(() => {
    api<{ storeInfo?: StoreInfo; business_name?: string }>(`/tenant/${tenant}/config`, { auth: "none" })
      .then((r) => { if (r.storeInfo) setInfo(r.storeInfo); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenant]);

  const name = info?.name || tenantName || "Our store";
  const fullAddress = [info?.address, info?.city, info?.state, info?.pincode].filter(Boolean).join(", ");
  const hasPin = info?.lat != null && info?.lng != null;
  const query = hasPin ? `${info!.lat},${info!.lng}` : `${name}, ${fullAddress}`;
  const phone = (info?.phone || tenantPhone || "").replace(/\D/g, "");
  const embed = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;

  const openDirections = () => {
    const q = encodeURIComponent(query);
    const url = Platform.select({
      ios: `maps://?daddr=${q}`,
      android: hasPin ? `google.navigation:q=${q}` : `geo:0,0?q=${q}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    })!;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${q}`));
  };

  return (
    <View style={styles.root} testID="store-locator-screen">
      <GlassBackdrop />
      <ScreenHeader title={t("store_locator")} subtitle={t("visit_store")} showBack />
      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 16 }}>
          <View style={styles.mapWrap}>
            {WebView && fullAddress ? (
              <WebView source={{ html: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><iframe src="${embed}" width="100%" height="100%" style="border:0;position:absolute;inset:0" loading="lazy"></iframe></body></html>` }} style={{ flex: 1 }} scrollEnabled={false} />
            ) : Platform.OS === "web" && fullAddress ? (
              React.createElement("iframe", { src: embed, style: { border: 0, width: "100%", height: "100%" } })
            ) : (
              <View style={styles.mapFallback}>
                <MapPin size={36} color={colors.brandDeep} />
              </View>
            )}
          </View>

          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <LogoMark size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{name}</Text>
                <Text style={styles.sub}>{info?.city || ""}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <MapPin size={18} color={colors.brandDeep} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t("address")}</Text>
                <Text style={styles.value} selectable>{fullAddress || "—"}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <Clock size={18} color={colors.brandDeep} />
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{t("store_hours")}</Text>
                <Text style={styles.value}>{info?.hours || "10:00 AM – 8:00 PM (Mon–Sat)"}</Text>
              </View>
            </View>
            {phone ? (
              <View style={styles.row}>
                <Phone size={18} color={colors.brandDeep} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Phone</Text>
                  <Text style={styles.value}>+91 {phone.slice(-10)}</Text>
                </View>
              </View>
            ) : null}
          </Card>

          <Pressable style={styles.primaryBtn} onPress={openDirections} testID="store-directions">
            <Navigation size={18} color={colors.onBrandPrimary} />
            <Text style={styles.primaryText}>{t("directions")}</Text>
          </Pressable>
          {phone ? (
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable style={styles.ghostBtn} onPress={() => Linking.openURL(`tel:+91${phone.slice(-10)}`)} testID="store-call">
                <Phone size={18} color={colors.brandDeep} />
                <Text style={styles.ghostText}>{t("call_store")}</Text>
              </Pressable>
              <Pressable style={styles.ghostBtn} onPress={() => Linking.openURL(`https://wa.me/91${phone.slice(-10)}`)} testID="store-whatsapp">
                <MessageCircle size={18} color="#16A34A" />
                <Text style={styles.ghostText}>{t("whatsapp")}</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: "transparent" },
  mapWrap: { height: 220, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: colors.goldHairline, backgroundColor: colors.brandTertiary },
  mapFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.bold, fontSize: 17, color: colors.onSurface },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  row: { flexDirection: "row", gap: 12, marginTop: 16, alignItems: "flex-start" },
  label: { fontFamily: fonts.semibold, fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  value: { fontFamily: fonts.medium, fontSize: 14, color: colors.onSurface, marginTop: 2, lineHeight: 20 },
  primaryBtn: { height: 52, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryText: { fontFamily: fonts.bold, fontSize: 15, color: colors.onBrandPrimary },
  ghostBtn: { flex: 1, height: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.goldHairline, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ghostText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onSurface },
}));
