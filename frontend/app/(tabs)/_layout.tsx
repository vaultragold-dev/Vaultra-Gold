import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Gem, Home, RefreshCw, Vault } from "lucide-react-native";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { t } from "@/src/i18n";
import { colors, fonts, themed } from "@/src/theme";

/** Floating Layer 1 Ultra-Clear Spatial Glass Dock (matches user reference bottom bar). */
function GlassBar() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.barOuter]}>
      {Platform.OS !== "android" ? (
        <BlurView intensity={20} tint={colors.glassTint as any} style={StyleSheet.absoluteFill} />
      ) : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.layer1FillB }]} />
    </View>
  );
}

/** Layer 3 Active transparent white-icon pill (15% white glass + crisp pure-white stroke icon). */
function TabIcon({ Icon, focused }: { Icon: any; color: any; focused: boolean }) {
  return (
    <View style={[styles.iconLens, focused && styles.iconLensOn]}>
      <Icon
        size={19}
        color={focused ? "#FFFFFF" : "rgba(255,255,255,0.68)"}
        strokeWidth={focused ? 2.0 : 1.7}
      />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "transparent" },
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "rgba(255,255,255,0.64)",
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 10.5, lineHeight: 13, letterSpacing: 0.3, marginTop: 1 },
        tabBarBackground: () => <GlassBar />,
        tabBarItemStyle: { paddingTop: 4, paddingBottom: 3 },
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: Math.max(insets.bottom, 12),
          height: 68,
          paddingBottom: 5,
          paddingHorizontal: 6,
          borderRadius: 34,
          borderTopWidth: 0,
          borderWidth: 0,
          backgroundColor: "transparent",
          ...(Platform.OS === "android"
            ? { elevation: 0 }
            : { shadowColor: "#000", shadowOpacity: 0.30, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } }),
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("home"), tabBarIcon: ({ color, focused }) => <TabIcon Icon={Home} color={color} focused={focused} /> }} />
      <Tabs.Screen name="vault" options={{ title: t("vault"), tabBarIcon: ({ color, focused }) => <TabIcon Icon={Vault} color={color} focused={focused} /> }} />
      <Tabs.Screen name="jewellery" options={{ title: t("jewellery"), tabBarIcon: ({ color, focused }) => <TabIcon Icon={Gem} color={color} focused={focused} /> }} />
      <Tabs.Screen name="sip" options={{ title: t("sip"), tabBarIcon: ({ color, focused }) => <TabIcon Icon={RefreshCw} color={color} focused={focused} /> }} />
    </Tabs>
  );
}

const styles = themed(() => ({
  barOuter: {
    borderRadius: 34,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.layer1Border,
    ...(Platform.OS === "web" ? ({ backdropFilter: "blur(22px) saturate(135%)" } as any) : null),
  },
  iconLens: {
    width: 50,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  iconLensOn: {
    backgroundColor: colors.layer3ActiveFill,
    borderWidth: 1,
    borderColor: colors.layer3ActiveBorder,
  },
}));
