/**
 * Brand splash shown right after the phone's own (system) splash.
 *  - "poster" mode: the full splash image uploaded in App Studio, edge to edge - same as the App Studio preview.
 *  - "icon" mode: the logo on the brand colour, smoothly growing from the system-splash size to a large size.
 * It stays until the app is ready, so there is no blank frame and no sudden size jump.
 */
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, useWindowDimensions } from "react-native";

import { tenantConfig } from "@/src/tenantConfig";

// Must match app.json / app.config.js -> expo-splash-screen "imageWidth"
export const SPLASH_IMAGE_WIDTH = 240;

const theme = (tenantConfig.theme || {}) as { splashBackground?: string; accentColor?: string };
const SPLASH_BG = theme.splashBackground || theme.accentColor || "#000000";
const MODE = ((tenantConfig.assets as any)?.splashMode === "poster" ? "poster" : "icon") as "poster" | "icon";
const MIN_VISIBLE_MS = MODE === "poster" ? 1400 : 900;

// Keep the system splash until our copy is on screen
SplashScreen.preventAutoHideAsync().catch(() => {});

export function BrandSplash({ ready }: { ready: boolean }) {
  const { width: W, height: H } = useWindowDimensions();
  const [gone, setGone] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const target = Math.min(W * 1.2, 560); // logo ends at ~55% of the screen width
  const grow = useRef(new Animated.Value(SPLASH_IMAGE_WIDTH / target)).current;
  const posterIn = useRef(new Animated.Value(MODE === "poster" ? 0 : 1)).current;
  const shownAt = useRef(Date.now());

  const onShown = () => {
    shownAt.current = Date.now();
    SplashScreen.hideAsync().catch(() => {});
    Animated.parallel([
      Animated.timing(grow, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(posterIn, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
    const id = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => setGone(true));
    }, wait);
    return () => clearTimeout(id);
  }, [ready, opacity]);

  if (gone) return null;
  return (
    <Animated.View
      pointerEvents={ready ? "none" : "auto"}
      style={[StyleSheet.absoluteFill, { backgroundColor: SPLASH_BG, alignItems: "center", justifyContent: "center", zIndex: 9999, elevation: 9999, opacity }]}
      onLayout={onShown}
      testID="brand-splash"
    >
      {MODE === "poster" ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: posterIn }]}>
          <Image source={require("../../assets/images/splash-full.png")} style={{ width: W, height: H }} resizeMode="cover" fadeDuration={0} />
        </Animated.View>
      ) : (
        <Animated.View style={{ transform: [{ scale: grow }] }}>
          <Image source={require("../../assets/images/splash-image.png")} style={{ width: target, height: target }} resizeMode="contain" fadeDuration={0} />
        </Animated.View>
      )}
    </Animated.View>
  );
}
