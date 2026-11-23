import { LinearGradient } from "expo-linear-gradient";
import { Star } from "lucide-react-native";
import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";

const PALETTE = {
  gold: { face: ["#FFF3B0", "#FFD54A", "#F2B200", "#C98A00"], rim: ["#FFE07A", "#B37800"], star: "#E65100", glow: "rgba(255,193,7,0.45)" },
  silver: { face: ["#FFFFFF", "#E6E9EE", "#C3C8D0", "#9AA1AB"], rim: ["#F2F4F7", "#8E959F"], star: "#7B8494", glow: "rgba(200,206,214,0.55)" },
} as const;

/** Animated 3D coin (slow spin + light sweep) used next to the live gold / silver rates. */
export function Coin3D({ metal = "gold", size = 40 }: { metal?: "gold" | "silver"; size?: number }) {
  const p = PALETTE[metal];
  const spin = useSharedValue(0);
  const shine = useSharedValue(-1);

  useEffect(() => {
    // Full turn every ~3.6s with a short rest, staggered for silver so both coins don't move in sync
    spin.value = withDelay(
      metal === "silver" ? 900 : 0,
      withRepeat(withSequence(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.cubic) }), withTiming(1, { duration: 1200 }), withTiming(0, { duration: 0 })), -1, false),
    );
    shine.value = withDelay(
      metal === "silver" ? 1500 : 600,
      withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 2500 }), withTiming(-1, { duration: 0 })), -1, false),
    );
  }, [metal, spin, shine]);

  const coinStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 400 }, { rotateY: `${spin.value * 360}deg` }],
  }));
  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shine.value * size * 1.2 }, { rotate: "25deg" }],
    opacity: shine.value > -0.95 && shine.value < 0.95 ? 0.85 : 0,
  }));

  const rim = Math.max(2, size * 0.07);
  return (
    <View style={{ width: size + 8, height: size + 8, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: size + 6, height: size + 6, borderRadius: (size + 6) / 2, backgroundColor: p.glow, opacity: 0.55 }} />
      <Animated.View style={[{ width: size, height: size }, coinStyle]}>
        <LinearGradient colors={p.rim as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: size / 2, padding: rim }}>
          <LinearGradient
            colors={p.face as any}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={{ flex: 1, borderRadius: size / 2, alignItems: "center", justifyContent: "center", overflow: "hidden" }}
          >
            <View style={{ position: "absolute", width: size * 0.72, height: size * 0.72, borderRadius: size, borderWidth: 1, borderColor: "rgba(255,255,255,0.55)" }} />
            <Star size={size * 0.42} color={p.star} fill={p.star} strokeWidth={1} />
            <Animated.View
              pointerEvents="none"
              style={[{ position: "absolute", top: -size * 0.2, width: size * 0.22, height: size * 1.4, backgroundColor: "rgba(255,255,255,0.75)" }, shineStyle]}
            />
          </LinearGradient>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}
