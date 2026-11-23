import { useLocalSearchParams, useRouter } from "expo-router";
import { X } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";

import { GlassBackdrop } from "@/src/components/GlassBackdrop";
import { api } from "@/src/api";
import { useToast } from "@/src/components/Toast";
import { Button } from "@/src/components/ui";
import { useApp } from "@/src/store/AppContext";
import { colors, fonts, themed } from "@/src/theme";

/** Razorpay hosted checkout (activates when RAZORPAY keys are configured on the backend). */
export default function Checkout() {
  const { url, id } = useLocalSearchParams<{ url: string; id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { refresh } = useApp();
  const handled = useRef(false);

  const check = async (attempt = 0) => {
    try {
      const r = await api(`/orders/${id}`);
      if (r.order.status === "paid") {
        await refresh();
        toast("success", "Purchase successful", "Gold added to your vault");
        router.back();
      } else if (attempt < 4) {
        // Bank confirmation can take a few seconds; the webhook will also credit it
        setTimeout(() => check(attempt + 1), 2500);
      } else {
        toast("info", "Payment is being confirmed", "Your vault will update automatically in a few minutes");
        router.back();
      }
    } catch (e: any) {
      toast("error", "Could not verify payment", e.message);
    }
  };

  useEffect(() => {
    if (Platform.OS === "web" && url) WebBrowser.openBrowserAsync(url);
  }, [url]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="checkout-screen">
      <GlassBackdrop />
      <View style={styles.bar}>
        <Text style={styles.title}>Razorpay Secure Checkout</Text>
        <Pressable onPress={() => router.back()} style={styles.close} testID="checkout-close">
          <X size={22} color={colors.onSurface} />
        </Pressable>
      </View>
      {Platform.OS === "web" ? (
        <View style={styles.center}>
          <Text style={styles.sub}>Complete the payment in the opened tab, then verify.</Text>
          <Button title="I've completed payment" onPress={() => check()} testID="checkout-verify" />
        </View>
      ) : (
        <WebView
          source={{ uri: url }}
          style={{ flex: 1 }}
          originWhitelist={["https://*", "upi://*", "intent://*"]}
          onShouldStartLoadWithRequest={(req) => {
            // UPI apps (GPay / PhonePe / Paytm) must open outside the WebView
            if (/^(upi|intent|phonepe|paytmmp|tez|gpay):/i.test(req.url)) {
              Linking.openURL(req.url).catch(() => toast("info", "UPI app not found", "Choose another payment method"));
              return false;
            }
            return true;
          }}
          onNavigationStateChange={(nav) => {
            if (!nav.url.includes("/api/payments/result") || handled.current) return;
            handled.current = true;
            const status = (nav.url.match(/status=([a-z]+)/) || [])[1];
            if (status === "cancelled" || status === "failed") {
              toast(status === "cancelled" ? "info" : "error", status === "cancelled" ? "Payment cancelled" : "Payment failed", "No gold was added");
              setTimeout(() => router.back(), 1200);
            } else {
              check();
            }
          }}
        />
      )}
    </View>
  );
}

const styles = themed(() => ({
  root: { flex: 1, backgroundColor: "transparent" },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, height: 52, borderBottomWidth: 1, borderBottomColor: colors.divider },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.onSurface },
  close: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: "center" },
}));
