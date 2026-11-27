import { BlurView } from "expo-blur";
import React from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, themed } from "@/src/theme";

export type GlassLayer = 1 | 2 | "2deep" | 3 | "3active";

function layerTokens(layer: GlassLayer) {
  if (layer === 1) return { bg: colors.layer1FillB, border: colors.layer1Border, topLine: "rgba(255,255,255,0.34)" };
  if (layer === "2deep") return { bg: colors.layer2DeepFill, border: colors.layer2DeepBorder, topLine: "rgba(255,255,255,0.16)" };
  if (layer === "3active") return { bg: colors.layer3ActiveFill, border: colors.layer3ActiveBorder, topLine: "rgba(255,255,255,0.52)" };
  if (layer === 3) return { bg: colors.layer3Fill, border: colors.layer3Border, topLine: "rgba(255,255,255,0.32)" };
  return { bg: colors.layer2FillB, border: colors.layer2Border, topLine: "rgba(255,255,255,0.28)" };
}

/**
 * Layer 3 transparent white-icon squircle tile or pill (`layer={3}` = 4%, `layer="3active"` = 13%).
 * Zero iOS drop-shadows and zero nested BlurView = crystal-clear transparency with 0 flicker.
 */
export function Glass({
  style,
  contentStyle,
  children,
  intensity = 24,
  radius = 16,
  active = false,
  layer,
  blur = false,
  testID,
}: {
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  intensity?: number;
  radius?: number;
  active?: boolean;
  layer?: GlassLayer;
  blur?: boolean;
  testID?: string;
}) {
  const android = Platform.OS === "android";
  const resolved: GlassLayer = layer ?? (active ? "3active" : 3);
  const { bg, border } = layerTokens(resolved);

  return (
    <View
      testID={testID}
      style={[
        styles.wrap,
        { borderRadius: radius, borderColor: border, backgroundColor: bg },
        style,
      ]}
    >
      {blur && !android ? (
        <BlurView intensity={intensity} tint={colors.glassTint as any} style={StyleSheet.absoluteFill} />
      ) : null}
      {children ? <View style={[styles.content, contentStyle]}>{children}</View> : null}
    </View>
  );
}

/**
 * 3-Layer Ultra-Clear Transparent Glass Container (3% / 6% / 4% / 13%):
 * Single GPU-composited translucent surface with crisp 1px rim & 1px specular top catchlight.
 * No offscreen iOS shadow rasterization and no nested BlurView -> 100% flicker-free on live price ticks.
 */
export function LiquidGlass({
  style,
  innerStyle,
  children,
  radius = 24,
  intensity = 22,
  layer = 2,
  blur = false,
  fillColors,
  testID,
}: {
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  radius?: number;
  intensity?: number;
  layer?: GlassLayer;
  blur?: boolean;
  rimColors?: [string, string, string];
  fillColors?: [string, string];
  showArc?: boolean;
  testID?: string;
}) {
  const android = Platform.OS === "android";
  const { bg, border, topLine } = layerTokens(layer);
  const surfaceBg = fillColors ? fillColors[1] : bg;

  return (
    <View
      testID={testID}
      style={[
        styles.shell,
        { borderRadius: radius, borderColor: border, backgroundColor: surfaceBg },
        style,
      ]}
    >
      {blur && !android ? (
        <BlurView intensity={intensity} tint={colors.glassTint as any} style={StyleSheet.absoluteFill} />
      ) : null}
      {/* Crisp 1px top-edge glass catchlight */}
      <View pointerEvents="none" style={[styles.topCatchlight, { backgroundColor: topLine }]} />
      <View style={[styles.inner, innerStyle]}>{children}</View>
    </View>
  );
}

const styles = themed(() => ({
  wrap: {
    overflow: "hidden",
    borderWidth: 1,
  },
  content: { position: "relative", zIndex: 1, flex: 1, alignItems: "center", justifyContent: "center" },
  shell: {
    overflow: "hidden",
    borderWidth: 1,
  },
  topCatchlight: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 0,
    height: StyleSheet.hairlineWidth,
  },
  inner: {
    flex: 1,
  },
}));
