/**
 * Brand splash that continues the native splash pixel-for-pixel (same image, same size, same colour)
 * and stays until the app is really ready — so customers never see the logo jump between
 * small/large or a blank frame, on any phone.
 */
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet } from "react-native";

import { tenantConfig } from "@/src/tenantConfig";

// Must match app.json / app.config.js -> expo-splash-screen "imageWidth"
export const SPLASH_IMAGE_WIDTH = 240;

const theme = (tenantConfig.theme || {}) as { splashBackground?: string; accentColor?: string };
const SPLASH_BG = theme.splashBackground || theme.accentColor || "#000000";
const MIN_VISIBLE_MS = 700;

// Keep the native splash until our identical copy is on screen
SplashScreen.preventAutoHideAsync().catch(() => {});

export function BrandSplash({ ready }: { ready: boolean }) {
  const [gone, setGone] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const shownAt = useRef(Date.now());

  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
    const id = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.06, duration: 320, useNativeDriver: true }),
      ]).start(() => setGone(true));
    }, wait);
    return () => clearTimeout(id);
  }, [ready, opacity, scale]);

  if (gone) return null;
  return (
    <Animated.View
      pointerEvents={ready ? "none" : "auto"}
      style={[StyleSheet.absoluteFill, { backgroundColor: SPLASH_BG, alignItems: "center", justifyContent: "center", zIndex: 9999, elevation: 9999, opacity }]}
      onLayout={() => {
        shownAt.current = Date.now();
        SplashScreen.hideAsync().catch(() => {});
      }}
      testID="brand-splash"
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Image
          source={require("../../assets/images/splash-image.png")}
          style={{ width: SPLASH_IMAGE_WIDTH, height: SPLASH_IMAGE_WIDTH }}
          resizeMode="contain"
          fadeDuration={0}
        />
      </Animated.View>
    </Animated.View>
  );
}
